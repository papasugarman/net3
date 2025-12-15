// SecureListener.js
const net = require('net');
const crypto = require("crypto");
const aenc = require("./lib/aenc.js");
const senc = require("./lib/senc.js");
const hash = require("./lib/hash.js");
const sign = require("./lib/sign.js");
const util = require("./lib/util.js");

// Global connections variable (as requested)
var connections = [];

class SecureListener {
    constructor(keys,host = "0.0.0.0", port = 15160, timeout = 5000) {
        this.HOST = host;
        this.PORT = port;
        this.TIMEOUT = timeout;
        this.keys = null;
        this.templates = new Object();
        this.listener = null;

        this.keys=keys;
        var connJ = require("./templates/conn.json");
        var authJ = require("./templates/auth.json");
        this.templates.connection = connJ;
        this.templates.auth = authJ;
        this.templates.auth.id.mine = this.keys.id;
    }

    async startListening() {

        this.listener = net.createServer((socket) => {
            this.handleNewConnection(socket);
        });

        this.listener.timeout = this.TIMEOUT;
        this.listener.listen(this.PORT, this.HOST, () => {
            console.log(`Listening on port ${this.PORT}`);
        });
    }

    handleNewConnection(socket) {
        var pass = 0;
        var connKeys = new Object();
        var connectionId = null; // Track the connection ID for this socket
        
        // Get peer's IP and port information
        const peerIP = socket.remoteAddress;
        const peerPort = socket.remotePort;
        const peerFamily = socket.remoteFamily; // 'IPv4' or 'IPv6'
        
        console.log(`Client connected from ${peerIP}:${peerPort} (${peerFamily})`);
        
        // Store peer info in connKeys for later use
        connKeys.peerIP = peerIP;
        connKeys.peerPort = peerPort;
        connKeys.peerFamily = peerFamily;

        socket.on('data', async (data) => {
            if (data == "") return;

            //console.log(`Pass ${pass}`);

            try {
                if (pass == 0) {
                    if (this.validateConnJSON(data.toString().trim())) {
                        connKeys = await aenc.keyGen();
                        socket.write(JSON.stringify({ pub: connKeys.pub }) + "\n");
                    }
                    else throw Error("Initial connection JSON didn't meet expectations");
                }//0

                if (pass == 1) {
                    var cypher = JSON.parse(data.toString().trim()).cypher;
                    connKeys.secret = await aenc.getSecret(cypher, connKeys.priv);
                    socket.write(senc.encrypt(JSON.stringify({ status: "OK" }), connKeys.secret) + "\n");
                }//1

                if (pass == 2) {
                    var received = senc.decrypt(data.toString().trim(), connKeys.secret);
                    received = JSON.parse(received);
                    if (received.id.yours != this.keys.id) {
                        socket.write(senc.encrypt(JSON.stringify({ status: "NOKAY", reason: "Not intended party" }), connKeys.secret) + "\n");
                        socket.end();
                    }
                    /*
                    if(!validateIncoming(received.id.mine)){
                        socket.write(senc.encrypt(JSON.stringify({status:"NOKAY",reason:"Barred party"}),connKeys.secret)+"\n");
                        socket.end();
                    }
                    */
                    connKeys.otherParty = received.id.mine;
                    connectionId = connKeys.otherParty; // Store the connection ID
                    var challenge = crypto.randomBytes(32);
                    connKeys.challenge = challenge.toString("hex");
                    socket.write(senc.encrypt(JSON.stringify({ challenge: connKeys.challenge }), connKeys.secret) + "\n");
                }//2

                if (pass == 3) {
                    var received = senc.decrypt(data.toString().trim(), connKeys.secret);
                    received = JSON.parse(received);
                    if (util.hexToBase58(hash.createFoldedHash(received.pub)) != connKeys.otherParty) {
                        socket.write(senc.encrypt(JSON.stringify({ status: "NOKAY", reason: "Pub doesn't match stated ID" }), connKeys.secret) + "\n");
                        throw Error("Connecting party's Pub was wrong.");
                    }
                    if (!await sign.verify(received.signed, connKeys.challenge, received.pub)) {
                        socket.write(senc.encrypt(JSON.stringify({ status: "NOKAY", reason: "Signed challange failed" }), connKeys.secret) + "\n");
                        throw Error("Connecting party couldn't prove ID");
                    }
                    socket.write(senc.encrypt(JSON.stringify({ status: "OK" }), connKeys.secret) + "\n");
                }//3

                if (pass == 4) {
                    var received = senc.decrypt(data.toString().trim(), connKeys.secret);
                    received = JSON.parse(received);
                    var signed = await sign.sign(received.challenge, this.keys.priv);
                    socket.write(senc.encrypt(JSON.stringify({ pub: this.keys.pub, signed: signed }), connKeys.secret) + "\n");
                }//4

                if (pass == 5) {
                    var received = senc.decrypt(data.toString().trim(), connKeys.secret);
                    received = JSON.parse(received);
                    if (!received.status || received.status != "OK")
                        throw Error("I failed proving my ID " + received.reason);
                    //console.log("Now Connected to "+connKeys.otherParty);
                    this.regNewConnection(connKeys.otherParty, socket, connKeys.secret);
                }//5

                if (pass >= 6) {
                    var received = senc.decrypt(data.toString().trim(), connKeys.secret);
                    received = JSON.parse(received);
                    
                    // Check if there's a pending send waiting for this response
                    var connection = connections[connKeys.otherParty];
                    if (connection && connection.pendingResolve) {
                        // Clear the timeout
                        if (connection.responseTimeout) {
                            clearTimeout(connection.responseTimeout);
                            delete connection.responseTimeout;
                        }
                        
                        // Resolve the promise with the received message
                        connection.pendingResolve(received);
                        delete connection.pendingResolve;
                        delete connection.pendingReject;
                    } else {
                        // Handle unsolicited messages
                        await this.handleMsg(received, connKeys.otherParty);
                    }
                } //6

                pass++;
            }
            catch (e) {
                console.log("Protocol error: " + e);
                socket.end();
            }
        });

        socket.on('end', () => {
            console.log('Client disconnected.');
            // Clean up the connection from the connections array
            if (connectionId && connections[connectionId]) {
                // Clean up any pending timeouts
                if (connections[connectionId].responseTimeout) {
                    clearTimeout(connections[connectionId].responseTimeout);
                }
                // Reject any pending promises
                if (connections[connectionId].pendingReject) {
                    connections[connectionId].pendingReject(new Error("Connection closed"));
                }
                delete connections[connectionId];
                console.log(`Removed connection for ID: ${connectionId}`);
            }
        });

        socket.on('error', (err) => {
            console.error("Socket error:", err);
            // Clean up the connection from the connections array
            if (connectionId && connections[connectionId]) {
                // Clean up any pending timeouts
                if (connections[connectionId].responseTimeout) {
                    clearTimeout(connections[connectionId].responseTimeout);
                }
                // Reject any pending promises
                if (connections[connectionId].pendingReject) {
                    connections[connectionId].pendingReject(new Error(`Socket error: ${err.message}`));
                }
                delete connections[connectionId];
                console.log(`Removed connection for ID: ${connectionId} due to error`);
            }
        });
    }

    async send(id, msg) {
        var connection = connections[id];
        if (connection != undefined) {
            return new Promise((resolve, reject) => {
                // Store the resolve function for this connection
                connection.pendingResolve = resolve;
                connection.pendingReject = reject;
                
                // Set a timeout for the response
                connection.responseTimeout = setTimeout(() => {
                    delete connection.pendingResolve;
                    delete connection.pendingReject;
                    reject(new Error("Response timeout"));
                }, this.TIMEOUT);
                
                connection.socket.write(senc.encrypt(JSON.stringify(msg), connection.secret) + "\n");
            });
        }
        throw new Error("Connection not found for id: " + id);
    }

    regNewConnection(id, socket, secret) {
        console.log("Now connected to :", id);
        connections[id] = { 
            socket: socket, 
            secret: secret,
            peerIP: socket.remoteAddress,
            peerPort: socket.remotePort,
            peerFamily: socket.remoteFamily,
            connectedAt: new Date()
        };
    }

    async handleMsg(received, fromId) {
        console.log("The peer "+fromId+" said: ", received);
        
        // Send acknowledgment back to the peer
        var connection = connections[fromId];
        if (connection != undefined) {
            connection.socket.write(senc.encrypt(JSON.stringify({"status": 1}), connection.secret) + "\n");
        }
    }

    getConnectionInfo(id) {
        var connection = connections[id];
        if (connection) {
            return {
                id: id,
                peerIP: connection.peerIP,
                peerPort: connection.peerPort,
                peerFamily: connection.peerFamily,
                connectedAt: connection.connectedAt,
                isConnected: !connection.socket.destroyed
            };
        }
        return null;
    }

    getAllConnections() {
        return Object.keys(connections).map(id => this.getConnectionInfo(id));
    }

    async stopListening() {
        //also close each socket separetly
        if (this.listener) {
            this.listener.close();
        }
    }


    ////////////////////////////////////
    validateConnJSON(j) {
        if (JSON.stringify(this.templates.connection) == j)
            return true;
        return false;
    }
}

/*module.exports = SecureListener;*/

// Example usage:

(async () => {
    var keys = require("./account.json");

    const listener = new SecureListener(keys,"0.0.0.0", 15160, 5000);
    
    await listener.startListening();
    /*
    setInterval(async function() {
        try {
            const response = await listener.send("QCbUpzoiUNc4BLHJW6DBQP", {msg: "cmd"});
            console.log("Received reply:", response);
        } catch (error) {
            console.error("Send failed:", error.message);
        }
    }, 3500);
    */
})();