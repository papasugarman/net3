// SecureListenerWS.js - WebSocket version
const WebSocket = require('ws');
const crypto = require("crypto");
const aenc = require("./lib/aenc.js");
const senc = require("./lib/senc.js");
const hash = require("./lib/hash.js");
const sign = require("./lib/sign.js");
const util = require("./lib/util.js");
const replies = require("./replies.js");

// Global connections variable (as requested)
var connections = [];

class SecureListenerWS {
    constructor(keys, host = "0.0.0.0", port = 15160, timeout = 5000) {
        this.HOST = host;
        this.PORT = port;
        this.TIMEOUT = timeout;
        this.keys = null;
        this.templates = new Object();
        this.wss = null;

        this.keys = keys;
        var connJ = require("./templates/conn.json");
        var authJ = require("./templates/auth.json");
        this.templates.connection = connJ;
        this.templates.auth = authJ;
        this.templates.auth.id.mine = this.keys.id;
    }

    async startListening(path = null) {
        if (path) {
            // Create HTTP server with path-based routing
            const http = require('http');
            const server = http.createServer((req, res) => {
                res.writeHead(404);
                res.end('Not found');
            });

            this.wss = new WebSocket.Server({
                noServer: true
            });

            server.on('upgrade', (request, socket, head) => {
                const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

                if (pathname === path) {
                    this.wss.handleUpgrade(request, socket, head, (ws) => {
                        this.wss.emit('connection', ws, request);
                    });
                } else {
                    socket.destroy();
                }
            });

            server.listen(this.PORT, this.HOST, () => {
                console.log(`WebSocket server listening on ${this.HOST}:${this.PORT}${path}`);
            });

            this.httpServer = server;
        } else {
            // Original behavior without path
            this.wss = new WebSocket.Server({
                host: this.HOST,
                port: this.PORT
            });

            this.wss.on('listening', () => {
                console.log(`WebSocket server listening on ${this.HOST}:${this.PORT}`);
            });
        }

        this.wss.on('connection', (ws, req) => {
            this.handleNewConnection(ws, req);
        });

        this.wss.on('error', (error) => {
            console.error('WebSocket server error:', error);
        });
    }

    async startListeningOnSharedServer(sharedHttpServer, path) {
        // Use a shared HTTP server for multiple WebSocket paths
        this.httpServer = sharedHttpServer;
        this.isSharedServer = true;
        this.path = path;

        this.wss = new WebSocket.Server({
            noServer: true
        });

        // Add upgrade handler for this specific path
        this.upgradeHandler = (request, socket, head) => {
            const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

            if (pathname === path) {
                this.wss.handleUpgrade(request, socket, head, (ws) => {
                    this.wss.emit('connection', ws, request);
                });
            }
            // Don't destroy socket - let other handlers try
        };

        this.httpServer.on('upgrade', this.upgradeHandler);

        this.wss.on('connection', (ws, req) => {
            this.handleNewConnection(ws, req);
        });

        this.wss.on('error', (error) => {
            console.error('WebSocket server error:', error);
        });

        console.log(`  ✓ WebSocket endpoint registered at ${path}`);
    }

    handleNewConnection(ws, req) {
        var pass = 0;
        var connKeys = new Object();
        var connectionId = null; // Track the connection ID for this WebSocket

        // Get peer's IP and port information
        const peerIP = req.socket.remoteAddress;
        const peerPort = req.socket.remotePort;
        const peerFamily = req.socket.remoteFamily; // 'IPv4' or 'IPv6'

        console.log(`Client connected from ${peerIP}:${peerPort} (${peerFamily})`);

        // Store peer info in connKeys for later use
        connKeys.peerIP = peerIP;
        connKeys.peerPort = peerPort;
        connKeys.peerFamily = peerFamily;

        ws.on('message', async (data) => {
            const message = data.toString();
            if (message == "") return;

            //console.log(`Pass ${pass}`);

            try {
                if (pass == 0) {
                    if (this.validateConnJSON(message.trim())) {
                        connKeys = await aenc.keyGen();
                        ws.send(JSON.stringify({ pub: connKeys.pub }));
                    }
                    else throw Error("Initial connection JSON didn't meet expectations");
                }//0

                if (pass == 1) {
                    var cypher = JSON.parse(message.trim()).cypher;
                    connKeys.secret = await aenc.getSecret(cypher, connKeys.priv);
                    ws.send(senc.encrypt(JSON.stringify({ status: "OK" }), connKeys.secret));
                }//1

                if (pass == 2) {
                    var received = senc.decrypt(message.trim(), connKeys.secret);
                    received = JSON.parse(received);
                    if (received.id.yours != this.keys.id) {
                        ws.send(senc.encrypt(JSON.stringify({ status: "NOKAY", reason: "Not intended party" }), connKeys.secret));
                        ws.close();
                    }
                    connKeys.otherParty = received.id.mine;
                    connectionId = connKeys.otherParty; // Store the connection ID
                    var challenge = crypto.randomBytes(32);
                    connKeys.challenge = challenge.toString("hex");
                    ws.send(senc.encrypt(JSON.stringify({ challenge: connKeys.challenge }), connKeys.secret));
                }//2

                if (pass == 3) {
                    var received = senc.decrypt(message.trim(), connKeys.secret);
                    received = JSON.parse(received);
                    if (util.hexToBase58(hash.createFoldedHash(received.pub)) != connKeys.otherParty) {
                        ws.send(senc.encrypt(JSON.stringify({ status: "NOKAY", reason: "Pub doesn't match stated ID" }), connKeys.secret));
                        throw Error("Connecting party's Pub was wrong.");
                    }
                    if (!await sign.verify(received.signed, connKeys.challenge, received.pub)) {
                        ws.send(senc.encrypt(JSON.stringify({ status: "NOKAY", reason: "Signed challange failed" }), connKeys.secret));
                        throw Error("Connecting party couldn't prove ID");
                    }
                    ws.send(senc.encrypt(JSON.stringify({ status: "OK" }), connKeys.secret));
                }//3

                if (pass == 4) {
                    var received = senc.decrypt(message.trim(), connKeys.secret);
                    received = JSON.parse(received);
                    var signed = await sign.sign(received.challenge, this.keys.priv);
                    ws.send(senc.encrypt(JSON.stringify({ pub: this.keys.pub, signed: signed }), connKeys.secret));
                }//4

                if (pass == 5) {
                    var received = senc.decrypt(message.trim(), connKeys.secret);
                    received = JSON.parse(received);
                    if (!received.status || received.status != "OK")
                        throw Error("I failed proving my ID " + received.reason);
                    //console.log("Now Connected to "+connKeys.otherParty);
                    this.regNewConnection(connKeys.otherParty, ws, connKeys.secret);
                }//5

                if (pass >= 6) {
                    var received = senc.decrypt(message.trim(), connKeys.secret);
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
                        await this.handleMsg(received, connKeys.otherParty,this.keys.id);
                    }
                } //6

                pass++;
            }
            catch (e) {
                console.log("Protocol error: " + e);
                ws.close();
            }
        });

        ws.on('close', () => {
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

        ws.on('error', (err) => {
            console.error("WebSocket error:", err);
            // Clean up the connection from the connections array
            if (connectionId && connections[connectionId]) {
                // Clean up any pending timeouts
                if (connections[connectionId].responseTimeout) {
                    clearTimeout(connections[connectionId].responseTimeout);
                }
                // Reject any pending promises
                if (connections[connectionId].pendingReject) {
                    connections[connectionId].pendingReject(new Error(`WebSocket error: ${err.message}`));
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

                connection.ws.send(senc.encrypt(JSON.stringify(msg), connection.secret));
            });
        }
        throw new Error("Connection not found for id: " + id);
    }

    regNewConnection(id, ws, secret) {
        console.log("Now connected to :", id);
        connections[id] = {
            ws: ws,
            secret: secret,
            peerIP: ws._socket.remoteAddress,
            peerPort: ws._socket.remotePort,
            peerFamily: ws._socket.remoteFamily,
            connectedAt: new Date()
        };
    }

    async handleMsg(received, fromId,thisId) {
        console.log("The peer "+fromId+" said: ", received);

        // Send acknowledgment back to the peer
        var connection = connections[fromId];
        if (connection != undefined) {
            var reply=await replies.reply(received,fromId,thisId);
            //console.log(reply);
            connection.ws.send(senc.encrypt(JSON.stringify(reply), connection.secret));
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
                isConnected: connection.ws.readyState === WebSocket.OPEN
            };
        }
        return null;
    }

    getAllConnections() {
        return Object.keys(connections).map(id => this.getConnectionInfo(id));
    }

    async stopListening() {
        if (this.wss) {
            // Close all client connections
            this.wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.close();
                }
            });
            // Close the server
            this.wss.close();
        }

        // Remove upgrade handler if using shared server
        if (this.isSharedServer && this.httpServer && this.upgradeHandler) {
            this.httpServer.removeListener('upgrade', this.upgradeHandler);
        }

        // Close HTTP server only if it's not shared
        if (this.httpServer && !this.isSharedServer) {
            this.httpServer.close();
        }
    }

    ////////////////////////////////////
    validateConnJSON(j) {
        if (JSON.stringify(this.templates.connection) == j)
            return true;
        return false;
    }
}

module.exports = SecureListenerWS;

// Example usage (commented out for module export):
/*
(async () => {
    var keys = require("./account.json");

    const listener = new SecureListenerWS(keys, "0.0.0.0", 15160, 5000);

    await listener.startListening();

    // Example: Send messages to connected clients periodically
    setInterval(async function() {
        try {
            const response = await listener.send("QCbUpzoiUNc4BLHJW6DBQP", {msg: "cmd"});
            console.log("Received reply:", response);
        } catch (error) {
            console.error("Send failed:", error.message);
        }
    }, 3500);
})();
*/
