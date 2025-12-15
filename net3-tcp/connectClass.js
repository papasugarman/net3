// SecureConnection.js
const net = require('net');
const crypto = require("crypto");
const aenc = require("./lib/aenc.js");
const senc = require("./lib/senc.js");
const hash = require("./lib/hash.js");
const sign = require("./lib/sign.js");
const util = require("./lib/util.js");

class SecureConnection {
    constructor() {
        this.TIMEOUT = 5000;
        this.HOST = "127.0.0.1";
        this.PORT = 15160;
        
        this.keys = null;
        this.templates = new Object();
        this.connKeys = new Object();
        this.pass = 0;
        this.client = null;
        this.connectedAt = null; // Track when connection was established
        
        this.connectResolve = null;
        this.connectReject = null;
        this.pendingSends = []; // Store pending send promises (FIFO queue)
        this.waitingForResponse = false; // Flag to track if we're waiting for a response
    }

    setupClientEvents() {
        this.client.on('data', async (data) => {
            if (data == "") return;

            //console.log(`Pass ${this.pass}`);

            try {
                if (this.pass == 0) {
                    const received = JSON.parse(data.toString().trim());
                    this.connKeys = await aenc.genCypher(received.pub);
                    this.client.write(JSON.stringify({cypher: this.connKeys.cypher}) + "\n");
                }//0

                if (this.pass == 1) {
                    let received = senc.decrypt(data.toString().trim(), this.connKeys.secret);
                    received = JSON.parse(received);
                    if (!received.status || received.status != "OK")
                        throw Error("Asymmetric encryption couldn't be agreed upon");
                    this.client.write(senc.encrypt(JSON.stringify(this.templates.auth), this.connKeys.secret) + "\n");
                }//1

                if (this.pass == 2) {
                    let received = senc.decrypt(data.toString().trim(), this.connKeys.secret);
                    received = JSON.parse(received);
                    if (received.status == "NOKAY") throw Error(received.reason);
                    const signed = await sign.sign(received.challenge, this.keys.priv);
                    this.client.write(senc.encrypt(JSON.stringify({pub: this.keys.pub, signed: signed}), this.connKeys.secret) + "\n");
                }//2

                if (this.pass == 3) {
                    let received = senc.decrypt(data.toString().trim(), this.connKeys.secret);
                    received = JSON.parse(received);
                    if (!received.status || received.status != "OK")
                        throw Error("I failed proving my ID " + received.reason);
                    const challenge = crypto.randomBytes(32);
                    this.connKeys.challenge = challenge.toString("hex");
                    this.client.write(senc.encrypt(JSON.stringify({challenge: this.connKeys.challenge}), this.connKeys.secret) + "\n");
                }//3

                if (this.pass == 4) {
                    let received = senc.decrypt(data.toString().trim(), this.connKeys.secret);
                    received = JSON.parse(received);
                    if (util.hexToBase58(hash.createFoldedHash(received.pub)) != this.templates.auth.id.yours) {
                        this.client.write(senc.encrypt(JSON.stringify({status: "NOKAY", reason: "Pub doesn't match stated ID"}), this.connKeys.secret) + "\n");
                        throw Error("Connecting party's Pub was wrong.");
                    }
                    if (!await sign.verify(received.signed, this.connKeys.challenge, received.pub)) {
                        this.client.write(senc.encrypt(JSON.stringify({status: "NOKAY", reason: "Signed challange failed"}), this.connKeys.secret) + "\n");
                        throw Error("Connecting party couldn't prove ID.");
                    }
                    this.client.write(senc.encrypt(JSON.stringify({status: "OK"}), this.connKeys.secret) + "\n");
                    
                    // Set connection timestamp when handshake is complete
                    this.connectedAt = new Date();
                    console.log("Now Connected to " + this.templates.auth.id.yours + " at " + this.connectedAt.toISOString());
                    
                    // Connection established successfully
                    if (this.connectResolve) {
                        this.connectResolve();
                        this.connectResolve = null;
                        this.connectReject = null;
                    }
                }//4

                if (this.pass >= 5) {
                    // Handle peer response
                    let received = senc.decrypt(data.toString().trim(), this.connKeys.secret);
                    received = JSON.parse(received);
                    
                    // Check if we're waiting for a response to our send
                    if (this.waitingForResponse && this.pendingSends.length > 0) {
                        const {resolve} = this.pendingSends.shift();
                        this.waitingForResponse = this.pendingSends.length > 0; // Still waiting if more sends pending
                        resolve(received);
                    } else {
                        // Regular message handling - peer sent something first
                        await this.handleMsg(this.templates.auth.id.yours, received);
                    }
                }

                this.pass++;
            } catch (e) {
                console.log("Protocol Error: " + e);
                if (this.connectReject) {
                    this.connectReject(e);
                    this.connectResolve = null;
                    this.connectReject = null;
                }
                // Reject any pending sends
                while (this.pendingSends.length > 0) {
                    const {reject} = this.pendingSends.shift();
                    reject(e);
                }
                this.waitingForResponse = false;
                this.client.end();
            }
        });

        this.client.on('close', () => {
            console.log('Connection closed.');
            // Reset connection timestamp
            this.connectedAt = null;
            
            if (this.connectReject) {
                this.connectReject(new Error('Connection closed during handshake'));
                this.connectResolve = null;
                this.connectReject = null;
            }
            // Reject any pending sends
            while (this.pendingSends.length > 0) {
                const {reject} = this.pendingSends.shift();
                reject(new Error('Connection closed'));
            }
            this.waitingForResponse = false;
        });

        this.client.on('error', (err) => {
            console.error("Connection error:", err);
            // Reset connection timestamp on error
            this.connectedAt = null;
            
            if (this.connectReject) {
                this.connectReject(err);
                this.connectResolve = null;
                this.connectReject = null;
            }
            // Reject any pending sends
            while (this.pendingSends.length > 0) {
                const {reject} = this.pendingSends.shift();
                reject(err);
            }
            this.waitingForResponse = false;
        });
    }

    async handleMsg(id, received) {
        console.log("Peer " + id + " said ", received);
        // Regular message handling - send acknowledgment
        this.client.write(senc.encrypt(JSON.stringify({status: "1"}), this.connKeys.secret) + "\n");
    }

    async connect(keys,intended) {
        return new Promise((resolve, reject) => {
            this.HOST = intended.host;
            this.PORT = intended.port;

            this.keys=keys;
            const connJ = require("./templates/conn.json");
            const authJ = require("./templates/auth.json");
            this.templates.connection = connJ;
            this.templates.auth = authJ;
            this.templates.auth.id.mine = this.keys.id;

            this.templates.auth.id.yours = intended.id;
            this.connKeys.otherParty = intended.id;
            
            this.connectResolve = resolve;
            this.connectReject = reject;
            
            this.client = new net.Socket();
            this.client.setTimeout(this.TIMEOUT);
            this.setupClientEvents();

            this.client.connect(this.PORT, this.HOST, async () => {
                //console.log("Connected");
                this.pass = 0;
                this.client.write(JSON.stringify(this.templates.connection) + '\n');
            });
        });
    }

    async send(msg) {
        if (!this.client || this.pass < 5) {
            throw new Error('Connection not established yet');
        }

        return new Promise((resolve, reject) => {
            this.pendingSends.push({resolve, reject});
            this.waitingForResponse = true;
            
            // Set timeout for send
            setTimeout(() => {
                const index = this.pendingSends.findIndex(p => p.reject === reject);
                if (index !== -1) {
                    this.pendingSends.splice(index, 1);
                    this.waitingForResponse = this.pendingSends.length > 0;
                    reject(new Error('Send timeout'));
                }
            }, this.TIMEOUT);
            
            this.client.write(senc.encrypt(JSON.stringify(msg), this.connKeys.secret) + "\n");
        });
    }

    disconnect() {
        if (this.client) {
            this.client.end();
        }
    }

    isConnected() {
        return this.client && !this.client.destroyed && this.pass > 4;
    }

    // Helper method to get connection duration
    getConnectionDuration() {
        if (!this.connectedAt) {
            return null;
        }
        return new Date() - this.connectedAt;
    }

    // Helper method to get formatted connection time
    getConnectionInfo() {
        if (!this.connectedAt) {
            return "Not connected";
        }
        const duration = this.getConnectionDuration();
        const seconds = Math.floor(duration / 1000);
        return `Connected since ${this.connectedAt.toISOString()} (${seconds}s ago)`;
    }
}

/*module.exports = SecureConnection;*/

// Example usage:

(async () => {
    var keys = require("./account1.json");
    const connection = new SecureConnection();
    
    try {
        const intended = {host: "127.0.0.1", port: "15160", id: "KRjhttJN14rMLzSRo5oBNC"};
        await connection.connect(keys,intended);
        
        // Send messages and get responses
        setInterval(async () => {
            try {
                console.log("Connection info:", connection.getConnectionInfo());
                console.log("Sending message");
                const response = await connection.send({msg: "hi"});
                console.log("Received response:", response);
            } catch (error) {
                console.error("Send error:", error);
            }
        }, 3000);
        
    } catch (error) {
        console.error("Connection error:", error);
    }
})();