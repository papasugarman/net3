// Browser-compatible WebSocket client for secure connections
import * as aenc from './aenc-browser.js';
import * as senc from './senc-browser.js';
import * as hash from './hash-browser.js';
import * as sign from './sign-browser.js';
import * as util from './util-browser.js';

class SecureConnectionWS {
    constructor() {
        this.TIMEOUT = 15000;
        this.HOST = "127.0.0.1";
        this.PORT = 15160;

        this.keys = null;
        this.templates = new Object();
        this.connKeys = new Object();
        this.pass = 0;
        this.ws = null;
        this.connectedAt = null; // Track when connection was established

        this.connectResolve = null;
        this.connectReject = null;
        this.pendingSends = []; // Store pending send promises (FIFO queue)
        this.waitingForResponse = false; // Flag to track if we're waiting for a response
    }

    setupWebSocketEvents() {
        this.ws.onmessage = async (event) => {
            const data = event.data;
            if (data == "") return;

            //console.log(`Pass ${this.pass}`);

            try {
                if (this.pass == 0) {
                    const received = JSON.parse(data.toString().trim());
                    this.connKeys = await aenc.genCypher(received.pub);
                    this.ws.send(JSON.stringify({ cypher: this.connKeys.cypher }));
                }//0

                if (this.pass == 1) {
                    let received = await senc.decrypt(data.toString().trim(), this.connKeys.secret);
                    received = JSON.parse(received);
                    if (!received.status || received.status != "OK")
                        throw Error("Asymmetric encryption couldn't be agreed upon");
                    this.ws.send(await senc.encrypt(JSON.stringify(this.templates.auth), this.connKeys.secret));
                }//1

                if (this.pass == 2) {
                    let received = await senc.decrypt(data.toString().trim(), this.connKeys.secret);
                    received = JSON.parse(received);
                    if (received.status == "NOKAY") throw Error(received.reason);
                    const signed = await sign.sign(received.challenge, this.keys.priv);
                    this.ws.send(await senc.encrypt(JSON.stringify({ pub: this.keys.pub, signed: signed }), this.connKeys.secret));
                }//2

                if (this.pass == 3) {
                    let received = await senc.decrypt(data.toString().trim(), this.connKeys.secret);
                    received = JSON.parse(received);
                    if (!received.status || received.status != "OK")
                        throw Error("I failed proving my ID " + received.reason);

                    // Generate random challenge using browser crypto
                    const challengeArray = crypto.getRandomValues(new Uint8Array(32));
                    this.connKeys.challenge = util.arrayToHex(challengeArray);
                    this.ws.send(await senc.encrypt(JSON.stringify({ challenge: this.connKeys.challenge }), this.connKeys.secret));
                }//3

                if (this.pass == 4) {
                    let received = await senc.decrypt(data.toString().trim(), this.connKeys.secret);
                    received = JSON.parse(received);
                    const foldedHash = await hash.createFoldedHash(received.pub);
                    if (util.hexToBase58(foldedHash) != this.templates.auth.id.yours) {
                        this.ws.send(await senc.encrypt(JSON.stringify({ status: "NOKAY", reason: "Pub doesn't match stated ID" }), this.connKeys.secret));
                        throw Error("Connecting party's Pub was wrong.");
                    }
                    if (!await sign.verify(received.signed, this.connKeys.challenge, received.pub)) {
                        this.ws.send(await senc.encrypt(JSON.stringify({ status: "NOKAY", reason: "Signed challange failed" }), this.connKeys.secret));
                        throw Error("Connecting party couldn't prove ID.");
                    }
                    this.ws.send(await senc.encrypt(JSON.stringify({ status: "OK" }), this.connKeys.secret));

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
                    let received = await senc.decrypt(data.toString().trim(), this.connKeys.secret);
                    received = JSON.parse(received);

                    // Check if we're waiting for a response to our send
                    if (this.waitingForResponse && this.pendingSends.length > 0) {
                        const { resolve } = this.pendingSends.shift();
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
                    const { reject } = this.pendingSends.shift();
                    reject(e);
                }
                this.waitingForResponse = false;
                this.ws.close();
            }
        };

        this.ws.onclose = () => {
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
                const { reject } = this.pendingSends.shift();
                reject(new Error('Connection closed'));
            }
            this.waitingForResponse = false;
        };

        this.ws.onerror = (err) => {
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
                const { reject } = this.pendingSends.shift();
                reject(err);
            }
            this.waitingForResponse = false;
        };

        this.ws.onopen = async () => {
            //console.log("Connected");
            this.pass = 0;
            this.ws.send(JSON.stringify(this.templates.connection));
        };
    }

    async handleMsg(id, received) {
        console.log("Peer " + id + " said ", received);
        // Regular message handling - send acknowledgment
        //this.ws.send(await senc.encrypt(JSON.stringify({ "status": 1 }), this.connKeys.secret));
    }

    async connect(keys, intended) {
        return new Promise(async (resolve, reject) => {
            this.HOST = intended.host;
            this.PORT = intended.port;

            this.keys = keys;

            // Hardcoded templates (since we can't use require in browser)
            this.templates.connection = {
                "protocol": "net3",
                "version": "3.0",
                "routine": "secure",
                "algorithms": {
                    "encryption": {
                        "asymmetric": "MlKEM-1024",
                        "symmetric": "AES-256-GCM"
                    }
                }
            };

            this.templates.auth = {
                "protocol": "net3",
                "version": "3.0",
                "routine": "authenticate",
                "algorithms": {
                    "authentication": "Dilithium5"
                },
                "id": {
                    "mine": "",
                    "yours": ""
                }
            };

            this.templates.auth.id.mine = this.keys.id;
            this.templates.auth.id.yours = intended.id;
            this.connKeys.otherParty = intended.id;

            this.connectResolve = resolve;
            this.connectReject = reject;

            // Create WebSocket connection with optional path
            const wsUrl = intended.path
                ? `wss://${this.HOST}:${this.PORT}${intended.path}`
                : `wss://${this.HOST}:${this.PORT}`;
            this.ws = new WebSocket(wsUrl);

            this.setupWebSocketEvents();

            // Set connection timeout
            setTimeout(() => {
                if (this.pass < 5 && this.connectReject) {
                    this.connectReject(new Error('Connection timeout'));
                    this.connectResolve = null;
                    this.connectReject = null;
                    this.ws.close();
                }
            }, this.TIMEOUT);
        });
    }

    async send(msg) {
        if (!this.ws || this.pass < 5) {
            throw new Error('Connection not established yet');
        }

        if (this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket is not open');
        }

        return new Promise(async (resolve, reject) => {
            this.pendingSends.push({ resolve, reject });
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

            this.ws.send(await senc.encrypt(JSON.stringify(msg), this.connKeys.secret));
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }

    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN && this.pass > 4;
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

export { SecureConnectionWS };
