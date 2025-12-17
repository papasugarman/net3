# Net3 Joke Service

A secure WebSocket-based joke service using the Net3 communications protocol with post-quantum cryptography (ML-KEM and Dilithium).

## Description

This service provides jokes over a secure, authenticated WebSocket connection. It implements a custom secure protocol with:
- ML-KEM (Module-Lattice-Based Key Encapsulation Mechanism) for key exchange
- Dilithium for digital signatures
- Symmetric encryption for message transport
- Mutual authentication between client and server

## Prerequisites

- Node.js (v14 or higher recommended)
- npm

## Installation & Setup

Follow these steps to get the service running:

### 1. Install Dependencies

```bash
npm install
```

This will install:
- `ws` - WebSocket library
- `mlkem` - ML-KEM post-quantum key encapsulation
- `dilithium-crystals-js` - Dilithium post-quantum signatures
- `js-sha3` - SHA3 hashing

### 2. Generate Server Credentials

```bash
node mkCreds.js
```

This creates an `account.json` file containing:
- Public/private key pair (Dilithium)
- Server ID (derived from the public key)

**Output example:**
```
Done! Keypair successfully generated for id: QCbUpzoiUNc4BLHJW6DBQP
```

### 3. Run the WebSocket Server

```bash
node test-ws-server.js
```

The server will:
- Start listening on `ws://localhost:80/joke` (default)
- Display the server ID and key information
- Wait for incoming WebSocket connections

**Expected output:**
```
===========================================
  WebSocket Secure Server Test
===========================================

Server Identity:
  ID: QCbUpzoiUNc4BLHJW6DBQP
  Public Key: a1b2c3d4...
  Key Sizes: Pub=2592 bytes, Priv=4864 bytes

Starting WebSocket server...
WebSocket server listening on 0.0.0.0:80/joke

Server ready! Waiting for connections...
WebSocket URL: ws://localhost/joke
----------------------------------------
```

### 4. Connect with a Client

Clients must:
- Connect to the WebSocket endpoint (`ws://localhost/joke`)
- **Provide their Net3 ID** during the authentication handshake
- Complete the multi-step secure handshake (6 passes)
- Send encrypted JSON-RPC requests

**Note:** Clients need their own credentials generated with `mkCreds.js` and must implement the Net3 protocol handshake.

## Service Methods

Once connected and authenticated, clients can call these JSON-RPC methods:

- `0` - List available functions
- `1` - Get owner info (server ID, client ID, timestamp)
- `2` - Get main page (HTML)
- `3` - Get webapp (HTML)
- `getJoke` - Get a random adult joke

## Troubleshooting

### Port 80 Permission Issues (Linux/Mac)

**Problem:** `Error: listen EACCES: permission denied 0.0.0.0:80`

**Solution:** Port 80 requires root/admin privileges. Either:
```bash
sudo node test-ws-server.js
```

Or change the port in [test-ws-server.js:19](test-ws-server.js#L19):
```javascript
const listener = new SecureListenerWS(keys, "0.0.0.0", 8080, 5000); // Use 8080 instead
```

### Missing account.json

**Problem:** `Error: Cannot find module './account.json'`

**Solution:** Run step 2 first:
```bash
node mkCreds.js
```

### Connection Timeout

**Problem:** Client connection times out or hangs during handshake

**Possible causes:**
1. Client not providing the correct ID during authentication
2. Client not following the 6-pass handshake protocol
3. Firewall blocking the connection
4. Network timeout (default: 5000ms)

**Solution:**
- Verify client implements the full Net3 protocol
- Check that client uses the server's ID (`yourID` field in authentication)
- Ensure client sends proper connection template JSON
- Check firewall settings

### Protocol Errors

**Problem:** `Protocol error: ...` messages in server console

**Common causes:**
1. Client sent malformed JSON
2. Client failed cryptographic verification
3. Client ID doesn't match public key
4. Client failed signature challenge

**Solution:**
- Ensure client uses matching Net3 library version
- Verify client's `account.json` is valid
- Check that client properly encrypts/decrypts messages
- Review client logs for handshake failures

### Module Installation Issues

**Problem:** `npm install` fails or modules missing

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### WebSocket Connection Refused

**Problem:** Client cannot connect to WebSocket

**Solution:**
1. Verify server is running: `Server ready! Waiting for connections...`
2. Check correct URL path: `ws://localhost/joke` (not `ws://localhost` or `ws://localhost:80`)
3. Ensure no other service is using port 80
4. Try localhost vs 127.0.0.1 vs machine IP

## Architecture

The service uses a 6-pass authentication protocol:
1. Client sends connection template
2. Server responds with ephemeral public key (ML-KEM)
3. Client sends encrypted shared secret
4. Server sends challenge for client signature
5. Client proves identity with signed challenge
6. Server proves identity with signed challenge
7. Encrypted JSON-RPC communication begins

## Security

- Post-quantum cryptographic algorithms (ML-KEM, Dilithium)
- Mutual authentication (both parties prove identity)
- All messages encrypted with shared secret (AES-256-GCM)
- Challenge-response prevents replay attacks
- ID derived from public key (prevents impersonation)

## Files

- [test-ws-server.js](test-ws-server.js) - Main server entry point
- [mkCreds.js](mkCreds.js) - Credential generator
- [listenClassWS.js](listenClassWS.js) - WebSocket listener class
- [replies.js](replies.js) - JSON-RPC method handlers
- [account.json](account.json) - Server credentials (generated)
- `lib/` - Cryptographic utilities (aenc, senc, sign, hash)

