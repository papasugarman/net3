# net3-tcp

A secure TCP communication protocol implementing post-quantum cryptography using Dilithium signatures and ML-KEM key encapsulation.

## Overview

net3-tcp provides a secure peer-to-peer communication framework with mutual authentication and encrypted messaging. It uses post-quantum cryptographic algorithms to ensure security against both classical and quantum computing threats.

## Features

- **Post-quantum cryptography**: Uses Dilithium for digital signatures and ML-KEM for key encapsulation
- **Mutual authentication**: Both parties verify each other's identity through challenge-response protocols
- **Encrypted communication**: All messages after handshake are encrypted using symmetric encryption
- **Request-response pattern**: Built-in support for sending messages and receiving responses
- **Connection management**: Track multiple connections and their metadata

## Dependencies

- `dilithium-crystals-js` - Post-quantum digital signatures (Dilithium)
- `mlkem` - Post-quantum key encapsulation mechanism (ML-KEM)
- `js-sha3` - SHA-3 hashing functions

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate Cryptographic Keys

Generate two separate key pairs for the listener and connector:

```bash
node mkCreds.js
```

This will create an `account.json` file with a keypair and corresponding ID. Rename this file or generate another keypair for the second party:

```bash
# For the first party (listener)
node mkCreds.js
# Rename account.json to something else, e.g., account.json

# For the second party (connector)
node mkCreds.js
# Rename account.json to account1.json
```

Each generated file contains:
- `priv`: Private key (keep secret!)
- `pub`: Public key (can be shared)
- `id`: Base58-encoded identifier derived from the public key

### 3. Configure Connection Parameters

#### In listenClass.js (line 278):

Update the key file location:
```javascript
var keys = require("./account.json");  // Your listener's key file
```

#### In connectClass.js (line 257):

Update the key file location:
```javascript
var keys = require("./account1.json");  // Your connector's key file
```

And update the intended connection target (line 261):
```javascript
const intended = {
    host: "127.0.0.1",      // Server IP address
    port: "15160",          // Server port
    id: "KRjhttJN14rMLzSRo5oBNC"  // ID of the listening party (from account.json)
};
```

Replace the `id` value with the actual ID from your listener's key file.

### 4. Run the Application

Open two terminal windows:

**Terminal 1 (Listener):**
```bash
node listenClass.js
```

**Terminal 2 (Connector):**
```bash
node connectClass.js
```

The connector will establish a secure connection to the listener, and they can exchange encrypted messages.

## How It Works

### Connection Handshake

1. **Initial connection**: Connector sends connection request
2. **Key exchange**: ML-KEM key encapsulation establishes shared secret
3. **Symmetric encryption**: All further communication encrypted with shared secret
4. **Authentication phase 1**: Connector proves identity by signing a challenge
5. **Authentication phase 2**: Listener proves identity by signing a challenge
6. **Secure channel established**: Both parties can now send encrypted messages

### Message Exchange

After handshake, both parties can:
- Send messages using the `send()` method
- Receive automatic responses
- Handle unsolicited messages via the `handleMsg()` callback

## API Reference

### SecureListener

```javascript
const listener = new SecureListener(keys, host, port, timeout);
await listener.startListening();
```

**Methods:**
- `startListening()`: Begin listening for connections
- `send(id, msg)`: Send message to connected peer
- `getConnectionInfo(id)`: Get metadata about a connection
- `getAllConnections()`: List all active connections
- `stopListening()`: Close the server

### SecureConnection

```javascript
const connection = new SecureConnection();
await connection.connect(keys, intended);
```

**Methods:**
- `connect(keys, intended)`: Establish connection to listener
- `send(msg)`: Send message and wait for response
- `disconnect()`: Close the connection
- `isConnected()`: Check connection status
- `getConnectionInfo()`: Get connection duration and timestamp

## Security Considerations

- Keep private keys secure and never commit them to version control
- Use strong, unique keypairs for each identity
- Default timeout is 5000ms - adjust based on network conditions
- The protocol enforces mutual authentication before any data exchange
- All messages after handshake are encrypted

## Network Configuration

Default settings:
- **Host**: 0.0.0.0 (listener) / 127.0.0.1 (connector)
- **Port**: 15160
- **Timeout**: 5000ms

Modify these in the class constructors as needed for your network setup.

## Troubleshooting

**"Connection not found for id"**: Ensure the connector is using the correct listener ID

**"Initial connection JSON didn't meet expectations"**: Check that both parties are using compatible protocol versions

**"Pub doesn't match stated ID"**: Key file mismatch - verify both parties are using the correct key files

**Timeout errors**: Increase timeout value or check network connectivity


