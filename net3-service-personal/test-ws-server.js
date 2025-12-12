// Test WebSocket Server
// This script starts a secure WebSocket server and handles connections

const SecureListenerWS = require("./listenClassWS.js");

(async () => {
    console.log('===========================================');
    console.log('  WebSocket Secure Server Test');
    console.log('===========================================\n');

    // Load server keys (account.json)
    const keys = require("./account.json");
    console.log('Server Identity:');
    console.log(`  ID: ${keys.id}`);
    console.log(`  Public Key: ${keys.pub.substring(0, 64)}...`);
    console.log(`  Key Sizes: Pub=${keys.pub.length/2} bytes, Priv=${keys.priv.length/2} bytes\n`);

    // Create and start WebSocket server on port 80 with /joke path
    const listener = new SecureListenerWS(keys, "0.0.0.0", 80, 5000);

    console.log('Starting WebSocket server...');
    await listener.startListening('/joke');

    console.log('\nServer ready! Waiting for connections...');
    console.log('WebSocket URL: ws://localhost/joke');
    console.log('----------------------------------------\n');

    /*
    // Example: Periodically check for connections and send messages
    setInterval(async function() {
        const connections = listener.getAllConnections();

        if (connections.length > 0) {
            console.log(`\nActive connections: ${connections.length}`);

            for (const conn of connections) {
                console.log(`  - ${conn.id} (${conn.peerIP}:${conn.peerPort})`);

                // Example: Send a periodic message to each connected client
                try {
                    const response = await listener.send(conn.id, {
                        msg: "Server heartbeat",
                        timestamp: new Date().toISOString()
                    });
                    console.log(`    Response from ${conn.id}:`, response);
                } catch (error) {
                    console.error(`    Failed to send to ${conn.id}:`, error.message);
                }
            }
        }
    }, 10000); // Check every 10 seconds
*/
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n\nShutting down server...');
        await listener.stopListening();
        console.log('Server stopped');
        process.exit(0);
    });

})();
