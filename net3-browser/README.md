# Net3-Browser: Developer Guide

A comprehensive guide for web developers to integrate and use the Net3 post-quantum secure network protocol in browser applications.

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Core Concepts](#core-concepts)
4. [Setup and Installation](#setup-and-installation)
5. [API Reference](#api-reference)
6. [Connection Workflow](#connection-workflow)
7. [Example Use Cases](#example-use-cases)
8. [Cryptography Details](#cryptography-details)
9. [Error Handling](#error-handling)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

---

## Introduction

Net3-Browser is the WebSocket implementation of the Net3 protocol, a post-quantum secure public network designed for mutual authentication and encrypted communication. Unlike traditional internet protocols, Net3 provides:

- **Mutual Authentication**: Both client and server authenticate each other during handshake
- **Post-Quantum Cryptography**: NIST-approved algorithms (ML-KEM-1024 and Dilithium5)
- **Key-Based Access**: No usernames or passwords - cryptographic keys identify entities
- **End-to-End Encryption**: All traffic is encrypted using AES-256-GCM

### Why Net3-Browser?

Net3 originally runs on TCP connections, but the browser implementation uses WebSockets for easier deployment and broader compatibility. This makes it possible to build secure web applications without complex infrastructure.

---

## Getting Started

### Prerequisites

- Modern web browser with Web Crypto API support
- HTTPS connection or localhost (required for Web Crypto API)
- Basic knowledge of JavaScript and async/await patterns
- WebSocket server running Net3 protocol

### Quick Start

Here's a minimal example to get you connected:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Net3 Quick Start</title>
</head>
<body>
    <script src="./dilithium.js"></script>
    <script src="./browser/sha3.min.js"></script>

    <script type="module">
        import { SecureConnectionWS } from './browser/connectClassWS.js';
        import { initDilithium, keyGen } from './browser/sign-browser.js';
        import { createFoldedHash } from './browser/hash-browser.js';
        import { hexToBase58 } from './browser/util-browser.js';

        async function quickConnect() {
            // 1. Initialize Dilithium WASM module
            await initDilithium();

            // 2. Generate client keys
            const clientKeys = await keyGen();
            const foldedHash = await createFoldedHash(clientKeys.pub);
            clientKeys.id = hexToBase58(foldedHash);

            console.log('Client ID:', clientKeys.id);

            // 3. Create connection
            const connection = new SecureConnectionWS();

            // 4. Connect to server
            await connection.connect(clientKeys, {
                host: 'example.net3.network',
                port: 15160,
                path: '/service',
                id: 'ServerIDInBase58Format'
            });

            console.log('Connected!');

            // 5. Send a message
            const response = await connection.send({
                action: 'hello',
                message: 'Hello Net3!'
            });

            console.log('Response:', response);
        }

        quickConnect();
    </script>
</body>
</html>
```

---

## Core Concepts

### Identity System

In Net3, identities are derived from public keys:

1. **Public Key**: Generated using Dilithium5 algorithm
2. **Folded Hash**: SHA3-512 hash of public key, XORed and folded to 128 bits
3. **ID**: Base58 encoding of the folded hash

```javascript
// Generate identity
const keys = await keyGen();
const foldedHash = await createFoldedHash(keys.pub);
const id = hexToBase58(foldedHash);
```

### Naming Convention

Net3 uses a hierarchical naming system:

- Format: `/root/::name~function`
- Examples:
  - `/0/::alice` - Common user "alice" under root 0
  - `/bank/::chase~3` - Bank "chase" web app function
  - `/2/::coffee` - Service "coffee" under root 2

### Connection Lifecycle

```
┌─────────────────┐
│  Initialize     │  Initialize WASM modules
└────────┬────────┘
         │
┌────────▼────────┐
│  Generate Keys  │  Create or load identity
└────────┬────────┘
         │
┌────────▼────────┐
│  Connect        │  5-pass handshake protocol
└────────┬────────┘
         │
┌────────▼────────┐
│  Send/Receive   │  Encrypted communication
└────────┬────────┘
         │
┌────────▼────────┐
│  Disconnect     │  Close connection
└─────────────────┘
```

---

## Setup and Installation

### File Structure

Your project needs these files from the net3-browser package:

```
your-project/
├── index.html
├── dilithium.js          # Dilithium WASM loader
├── dilithium.wasm        # Dilithium binary
├── mlkem.mjs             # ML-KEM implementation
└── browser/
    ├── connectClassWS.js  # Main connection class
    ├── sign-browser.js    # Digital signatures
    ├── aenc-browser.js    # Asymmetric encryption
    ├── senc-browser.js    # Symmetric encryption
    ├── hash-browser.js    # Hashing functions
    ├── util-browser.js    # Utility functions
    └── sha3.min.js        # SHA3 library
```

### HTML Setup

Include required scripts in your HTML:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Your Net3 App</title>
</head>
<body>
    <!-- Load Dilithium WASM loader -->
    <script src="./dilithium.js"></script>

    <!-- Load SHA3 library -->
    <script src="./browser/sha3.min.js"></script>

    <!-- Your app code as ES6 module -->
    <script type="module" src="./app.js"></script>
</body>
</html>
```

### Secure Context Requirement

The Web Crypto API requires a secure context. Your app must be served via:

- `https://` - Production deployments
- `http://localhost` - Local development
- `http://127.0.0.1` - Local development

File protocol (`file://`) will NOT work.

---

## API Reference

### Signing Module (`sign-browser.js`)

#### `initDilithium()`

Initializes the Dilithium WASM module. Must be called before any other signing operations.

```javascript
import { initDilithium } from './browser/sign-browser.js';

await initDilithium();
```

**Returns**: Promise that resolves when module is loaded

**Note**: Only needs to be called once per page load. Subsequent calls return cached module.

---

#### `keyGen()`

Generates a random Dilithium5 keypair.

```javascript
import { keyGen } from './browser/sign-browser.js';

const keys = await keyGen();
// Returns: { pub: "hex...", priv: "hex...", seed: "" }
```

**Returns**: Promise resolving to object with:
- `pub` (string): Public key in hex format (1472 bytes / 2944 hex chars)
- `priv` (string): Private key in hex format (3504 bytes / 7008 hex chars)
- `seed` (string): Empty string for random generation

---

#### `keyGenFromSeed(seed)`

Generates deterministic keypair from a seed.

```javascript
import { keyGenFromSeed } from './browser/sign-browser.js';

const seed = "your-hex-seed-here";
const keys = await keyGenFromSeed(seed);
// Returns: { pub: "hex...", priv: "hex...", seed: "your-hex-seed-here" }
```

**Parameters**:
- `seed` (string): Hex-encoded seed

**Returns**: Promise resolving to keypair object

**Use Case**: Restore same identity across sessions

---

#### `sign(message, privateKey)`

Signs a message using Dilithium5.

```javascript
import { sign } from './browser/sign-browser.js';

const signature = await sign("deadbeef", keys.priv);
```

**Parameters**:
- `message` (string | Uint8Array): Message to sign (hex string or byte array)
- `privateKey` (string): Private key in hex format

**Returns**: Promise resolving to signature in hex format

---

#### `verify(signature, message, publicKey)`

Verifies a Dilithium5 signature.

```javascript
import { verify } from './browser/sign-browser.js';

const isValid = await verify(signature, "deadbeef", keys.pub);
```

**Parameters**:
- `signature` (string): Signature in hex format
- `message` (string | Uint8Array): Original message
- `publicKey` (string): Public key in hex format

**Returns**: Promise resolving to boolean (true if valid)

---

### Asymmetric Encryption Module (`aenc-browser.js`)

Uses ML-KEM-1024 for key encapsulation.

#### `keyGen()`

Generates ML-KEM-1024 keypair.

```javascript
import * as aenc from './browser/aenc-browser.js';

const kp = await aenc.keyGen();
// Returns: { pub: "hex...", priv: "hex..." }
```

---

#### `genCypher(publicKey)`

Generates shared secret and encapsulated ciphertext.

```javascript
const result = await aenc.genCypher(serverPublicKey);
// Returns: { cypher: "hex...", secret: "hex..." }
```

**Parameters**:
- `publicKey` (string): Recipient's ML-KEM public key in hex

**Returns**: Promise resolving to:
- `cypher` (string): Encapsulated ciphertext (send to recipient)
- `secret` (string): Shared secret (32 bytes hex, use for AES encryption)

---

#### `getSecret(cypher, privateKey)`

Decapsulates ciphertext to recover shared secret.

```javascript
const secret = await aenc.getSecret(cypher, myPrivateKey);
```

**Parameters**:
- `cypher` (string): Encapsulated ciphertext in hex
- `privateKey` (string): Your ML-KEM private key in hex

**Returns**: Promise resolving to shared secret (hex)

---

### Symmetric Encryption Module (`senc-browser.js`)

Uses AES-256-GCM for authenticated encryption.

#### `encrypt(text, keyHex)`

Encrypts plaintext using AES-256-GCM.

```javascript
import * as senc from './browser/senc-browser.js';

const ciphertext = await senc.encrypt(JSON.stringify(data), secretKey);
```

**Parameters**:
- `text` (string): Plaintext to encrypt
- `keyHex` (string): 256-bit key in hex format (64 hex chars)

**Returns**: Promise resolving to: `IV (32 hex) + AuthTag (32 hex) + Ciphertext`

**Format**: Random 16-byte IV + 16-byte auth tag + encrypted data (all hex-encoded)

---

#### `decrypt(ciphertext, keyHex)`

Decrypts AES-256-GCM ciphertext.

```javascript
const plaintext = await senc.decrypt(ciphertext, secretKey);
const data = JSON.parse(plaintext);
```

**Parameters**:
- `ciphertext` (string): Encrypted data (IV + AuthTag + Ciphertext in hex)
- `keyHex` (string): 256-bit key in hex format

**Returns**: Promise resolving to decrypted plaintext string

**Throws**: Error if authentication fails or decryption error

---

### Hashing Module (`hash-browser.js`)

#### `createHash(str)`

Creates SHA3-512 hash of input.

```javascript
import { createHash } from './browser/hash-browser.js';

const hash = await createHash("some text");
// Returns 128 hex characters (512 bits)
```

**Parameters**:
- `str` (string): Input to hash (treated as text, not hex bytes)

**Returns**: Promise resolving to hex hash (128 chars)

---

#### `createFoldedHash(str)`

Creates folded 128-bit hash for Net3 IDs.

```javascript
import { createFoldedHash } from './browser/hash-browser.js';

const foldedHash = await createFoldedHash(publicKey);
const id = hexToBase58(foldedHash);
```

**Algorithm**:
1. SHA3-512 hash → 512 bits
2. Split in half → XOR together → 256 bits
3. Split in half → XOR together → 128 bits

**Returns**: Promise resolving to 32-character hex string (128 bits)

---

### Utility Module (`util-browser.js`)

#### Conversion Functions

```javascript
import {
    hexToArray, arrayToHex,      // Hex ↔ Uint8Array
    hexToStr, strToHex,           // Hex ↔ String
    hexToBase64, base64ToHex,     // Hex ↔ Base64
    hexToBase58, base58ToHex      // Hex ↔ Base58
} from './browser/util-browser.js';

// Examples:
const bytes = hexToArray("deadbeef");
const hex = arrayToHex(new Uint8Array([1, 2, 3]));
const id = hexToBase58("0123456789abcdef");
```

---

#### `xor(hex1, hex2)`

XORs two equal-length hex strings.

```javascript
import { xor } from './browser/util-browser.js';

const result = xor("ff00", "0f0f");
// Returns: "f00f"
```

---

#### `appendArrays(arrays)`

Concatenates multiple Uint8Arrays.

```javascript
import { appendArrays } from './browser/util-browser.js';

const combined = appendArrays([
    new Uint8Array([1, 2]),
    new Uint8Array([3, 4])
]);
// Returns: Uint8Array([1, 2, 3, 4])
```

---

### Connection Class (`SecureConnectionWS`)

The main class for establishing Net3 connections.

#### Constructor

```javascript
import { SecureConnectionWS } from './browser/connectClassWS.js';

const connection = new SecureConnectionWS();
```

Creates a new connection instance with default timeout of 15 seconds.

---

#### `connect(keys, intended)`

Establishes secure connection with 5-pass handshake.

```javascript
await connection.connect(clientKeys, {
    host: 'example.net3.network',
    port: 15160,
    path: '/api/service',  // Optional
    id: 'ServerBase58ID'
});
```

**Parameters**:
- `keys` (object): Client keys with `{ pub, priv, id }`
- `intended` (object):
  - `host` (string): Server hostname
  - `port` (number): Server port
  - `path` (string, optional): WebSocket path
  - `id` (string): Expected server ID in Base58

**Returns**: Promise that resolves when handshake completes

**Throws**: Error if handshake fails or times out

**Handshake Protocol**:
1. **Pass 0**: Exchange protocol templates
2. **Pass 1**: ML-KEM key encapsulation
3. **Pass 2**: Client authentication (challenge/response)
4. **Pass 3**: Client verifies server
5. **Pass 4**: Server verifies client
6. **Pass 5+**: Encrypted communication

---

#### `send(msg)`

Sends encrypted message and waits for response.

```javascript
const response = await connection.send({
    action: 'getData',
    params: { id: 123 }
});
```

**Parameters**:
- `msg` (object): JavaScript object to send (will be JSON-stringified and encrypted)

**Returns**: Promise resolving to response object

**Throws**: Error if not connected, timeout, or send fails

**Important**: Messages are sent in FIFO order. Each `send()` waits for its response before the next can proceed.

---

#### `disconnect()`

Closes the WebSocket connection.

```javascript
connection.disconnect();
```

**Returns**: void

---

#### `isConnected()`

Checks if connection is established and ready.

```javascript
if (connection.isConnected()) {
    console.log('Ready to send');
}
```

**Returns**: boolean - true if WebSocket is open and handshake completed

---

#### `getConnectionInfo()`

Gets human-readable connection status.

```javascript
console.log(connection.getConnectionInfo());
// "Connected since 2025-12-15T10:30:00.000Z (45s ago)"
```

**Returns**: string - connection timestamp and duration, or "Not connected"

---

#### `getConnectionDuration()`

Gets connection duration in milliseconds.

```javascript
const ms = connection.getConnectionDuration();
// Returns: 45000 (if connected for 45 seconds)
```

**Returns**: number | null - milliseconds since connection, or null if not connected

---

#### `handleMsg(id, received)`

Override this method to handle unsolicited messages from server.

```javascript
connection.handleMsg = async function(id, received) {
    console.log(`Server ${id} sent:`, received);
    // Handle push notifications, alerts, etc.
};
```

**Parameters**:
- `id` (string): Sender's Net3 ID
- `received` (object): Decrypted message object

**Default behavior**: Logs the message to console

---

## Connection Workflow

### Complete Connection Example

```javascript
// 1. Import modules
import { SecureConnectionWS } from './browser/connectClassWS.js';
import { initDilithium, keyGen, keyGenFromSeed } from './browser/sign-browser.js';
import { createFoldedHash } from './browser/hash-browser.js';
import { hexToBase58 } from './browser/util-browser.js';

// 2. Initialize
async function initialize() {
    console.log('Initializing Dilithium...');
    await initDilithium();
    console.log('Ready!');
}

// 3. Generate or load identity
async function getClientKeys() {
    // Option A: Generate new random keys
    const keys = await keyGen();

    // Option B: Restore from seed (e.g., from localStorage)
    // const seed = localStorage.getItem('net3-seed');
    // const keys = await keyGenFromSeed(seed);

    // Calculate ID
    const foldedHash = await createFoldedHash(keys.pub);
    keys.id = hexToBase58(foldedHash);

    console.log('Client ID:', keys.id);
    return keys;
}

// 4. Connect to server
async function connectToService() {
    const keys = await getClientKeys();
    const connection = new SecureConnectionWS();

    try {
        await connection.connect(keys, {
            host: 'registry.net3.network',
            port: 15160,
            path: '/register',
            id: 'RegistryServerIDInBase58'
        });

        console.log('Connected successfully!');
        return connection;

    } catch (error) {
        console.error('Connection failed:', error);
        throw error;
    }
}

// 5. Use the connection
async function main() {
    await initialize();
    const conn = await connectToService();

    // Send request
    const response = await conn.send({
        action: 'register',
        name: 'myservice'
    });

    console.log('Server response:', response);

    // Keep connection open for bidirectional communication
    // or disconnect when done:
    // conn.disconnect();
}

main();
```

---

## Example Use Cases

### Example 1: Simple Request/Response

```javascript
import { SecureConnectionWS } from './browser/connectClassWS.js';
import { initDilithium, keyGen } from './browser/sign-browser.js';
import { createFoldedHash } from './browser/hash-browser.js';
import { hexToBase58 } from './browser/util-browser.js';

async function fetchData() {
    // Setup
    await initDilithium();
    const keys = await keyGen();
    keys.id = hexToBase58(await createFoldedHash(keys.pub));

    // Connect
    const conn = new SecureConnectionWS();
    await conn.connect(keys, {
        host: 'data.net3.network',
        port: 15160,
        id: 'DataServiceID'
    });

    // Request data
    const data = await conn.send({ action: 'listItems' });
    console.log(data);

    // Cleanup
    conn.disconnect();
}
```

---

### Example 2: Persistent Identity

Save and restore client identity using localStorage:

```javascript
function saveIdentity(keys, seed) {
    localStorage.setItem('net3-seed', seed);
    localStorage.setItem('net3-id', keys.id);
}

function loadIdentity() {
    return localStorage.getItem('net3-seed');
}

async function getOrCreateIdentity() {
    await initDilithium();

    const existingSeed = loadIdentity();
    let keys;

    if (existingSeed) {
        // Restore existing identity
        keys = await keyGenFromSeed(existingSeed);
        console.log('Restored identity');
    } else {
        // Create new identity
        keys = await keyGen();
        const seed = generateRandomSeed(); // Implement this
        keys = await keyGenFromSeed(seed);
        saveIdentity(keys, seed);
        console.log('Created new identity');
    }

    keys.id = hexToBase58(await createFoldedHash(keys.pub));
    return keys;
}

function generateRandomSeed() {
    const arr = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(arr)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
```

---

### Example 3: Handling Server Push Messages

```javascript
async function chatApplication() {
    await initDilithium();
    const keys = await keyGen();
    keys.id = hexToBase58(await createFoldedHash(keys.pub));

    const conn = new SecureConnectionWS();

    // Override message handler for incoming messages
    conn.handleMsg = async function(senderId, message) {
        if (message.type === 'chat') {
            displayChatMessage(message.from, message.text);
        } else if (message.type === 'notification') {
            showNotification(message.title, message.body);
        }
    };

    await conn.connect(keys, {
        host: 'chat.net3.network',
        port: 15160,
        id: 'ChatServerID'
    });

    // Send a chat message
    await conn.send({
        type: 'chat',
        to: 'friendID',
        text: 'Hello!'
    });
}

function displayChatMessage(from, text) {
    console.log(`${from}: ${text}`);
}

function showNotification(title, body) {
    new Notification(title, { body });
}
```

---

### Example 4: Multi-Service Connection

Connect to multiple services simultaneously:

```javascript
async function multiServiceApp() {
    await initDilithium();
    const keys = await keyGen();
    keys.id = hexToBase58(await createFoldedHash(keys.pub));

    // Connect to registry
    const registryConn = new SecureConnectionWS();
    await registryConn.connect(keys, {
        host: 'registry.net3.network',
        port: 15160,
        id: 'RegistryID'
    });

    // Connect to data service
    const dataConn = new SecureConnectionWS();
    await dataConn.connect(keys, {
        host: 'data.net3.network',
        port: 15160,
        id: 'DataServiceID'
    });

    // Use both connections
    const nameInfo = await registryConn.send({ action: 'lookup', name: 'alice' });
    const userData = await dataConn.send({ action: 'get', id: nameInfo.id });

    console.log(userData);
}
```

---

### Example 5: Error Recovery

```javascript
async function robustConnection() {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            await initDilithium();
            const keys = await keyGen();
            keys.id = hexToBase58(await createFoldedHash(keys.pub));

            const conn = new SecureConnectionWS();
            await conn.connect(keys, {
                host: 'service.net3.network',
                port: 15160,
                id: 'ServiceID'
            });

            console.log('Connected successfully');
            return conn;

        } catch (error) {
            attempt++;
            console.error(`Attempt ${attempt} failed:`, error.message);

            if (attempt >= maxRetries) {
                throw new Error('Max retries exceeded');
            }

            // Wait before retry (exponential backoff)
            await new Promise(resolve =>
                setTimeout(resolve, 1000 * Math.pow(2, attempt))
            );
        }
    }
}
```

---

## Cryptography Details

### Post-Quantum Algorithms

Net3 uses NIST-standardized post-quantum cryptography:

#### ML-KEM-1024 (Module-Lattice Key Encapsulation)

- **Purpose**: Key exchange (replaces ECDH)
- **Security Level**: NIST Level 5 (highest)
- **Public Key**: 1568 bytes
- **Private Key**: 3168 bytes
- **Ciphertext**: 1568 bytes
- **Shared Secret**: 32 bytes (256 bits)

**Use in Net3**: Establishes shared symmetric key during handshake

---

#### Dilithium5 (Digital Signatures)

- **Purpose**: Authentication (replaces ECDSA)
- **Security Level**: NIST Level 5 (highest)
- **Public Key**: 1472 bytes (2944 hex chars)
- **Private Key**: 3504 bytes (7008 hex chars)
- **Signature**: ~2701 bytes + message length

**Use in Net3**: Proves identity during mutual authentication

---

#### AES-256-GCM (Symmetric Encryption)

- **Purpose**: Message encryption
- **Security**: 256-bit key, 128-bit authentication tag
- **Mode**: Galois/Counter Mode (authenticated encryption)

**Use in Net3**: Encrypts all messages after handshake using shared secret from ML-KEM

---

#### SHA3-512 (Hashing)

- **Purpose**: Derive IDs from public keys
- **Output**: 512 bits (folded to 128 bits for Net3 IDs)

**Folding Algorithm**:
```
hash = SHA3-512(publicKey)        // 512 bits
half1, half2 = split(hash)        // 256 bits each
mid = half1 XOR half2             // 256 bits
mid1, mid2 = split(mid)           // 128 bits each
final = mid1 XOR mid2             // 128 bits
id = base58(final)                // Human-readable ID
```

---

### Handshake Protocol Details

The 5-pass handshake ensures mutual authentication:

```
Client                                    Server
  |                                         |
  |--- (0) Protocol Template -------------->|
  |                                         |
  |<-- (1) ML-KEM Public Key ---------------|
  |                                         |
  |--- (2) Encapsulated Key + Auth -------->|
  |        Template (encrypted)             |
  |                                         |
  |<-- (3) Challenge (encrypted) -----------|
  |                                         |
  |--- (4) Signed Challenge + PubKey ------>|
  |        (encrypted)                      |
  |                                         |
  |<-- (5) Server Challenge (encrypted) ----|
  |                                         |
  |--- (6) Signed Response + PubKey ------->|
  |        (encrypted)                      |
  |                                         |
  |<-- (7) OK (encrypted) ------------------|
  |                                         |
  [Connection Established - Pass 5+]
```

**Security Properties**:
- Forward secrecy (new ML-KEM key per connection)
- Mutual authentication (both prove identity)
- No trusted third party (no certificates)
- Replay attack protection (random challenges)
- Man-in-the-middle protection (verify expected server ID)

---

## Error Handling

### Common Errors and Solutions

#### 1. Web Crypto API Not Available

**Error**: `Web Crypto API is not available`

**Cause**: Page not served over HTTPS or localhost

**Solution**:
```javascript
// Development: Use localhost or 127.0.0.1
http://localhost:8080

// Production: Use HTTPS
https://your-domain.com
```

---

#### 2. Dilithium Not Initialized

**Error**: `dilithiumModule is null`

**Cause**: Forgot to call `initDilithium()`

**Solution**:
```javascript
await initDilithium(); // Always call first
const keys = await keyGen();
```

---

#### 3. Connection Timeout

**Error**: `Connection timeout`

**Cause**: Server unreachable or handshake stalled

**Solution**:
```javascript
// Check server is running and ID is correct
await connection.connect(keys, {
    host: 'correct-hostname.com',
    port: 15160,
    id: 'CorrectServerID' // Verify this matches server
});
```

---

#### 4. Authentication Failed

**Error**: `I failed proving my ID` or `Connecting party couldn't prove ID`

**Cause**:
- Server ID mismatch
- Signature verification failed
- Network corruption

**Solution**:
```javascript
// Ensure server ID is exact
const serverID = 'ExactIDFromServerRegistration';

await connection.connect(keys, {
    host: 'server.com',
    port: 15160,
    id: serverID // Must match exactly
});
```

---

#### 5. Send Before Connect

**Error**: `Connection not established yet`

**Cause**: Calling `send()` before handshake completes

**Solution**:
```javascript
await connection.connect(keys, intended); // Wait for this
const response = await connection.send(msg); // Then send
```

---

#### 6. Decryption Failed

**Error**: `Decryption failed`

**Cause**:
- Wrong encryption key
- Corrupted ciphertext
- Protocol mismatch

**Solution**: Ensure both sides use same protocol version and keys

---

### Try-Catch Pattern

Always wrap Net3 operations in try-catch:

```javascript
async function safeConnect() {
    try {
        await initDilithium();
        const keys = await getKeys();
        const conn = new SecureConnectionWS();

        await conn.connect(keys, {
            host: 'service.net3.network',
            port: 15160,
            id: 'ServiceID'
        });

        return conn;

    } catch (error) {
        console.error('Connection error:', error.message);

        // Handle specific errors
        if (error.message.includes('timeout')) {
            console.log('Server unreachable');
        } else if (error.message.includes('prove ID')) {
            console.log('Authentication failed');
        } else {
            console.log('Unknown error');
        }

        throw error;
    }
}
```

---

## Best Practices

### 1. Initialize Once

Initialize Dilithium only once per page load:

```javascript
let dilithiumReady = false;

async function ensureInitialized() {
    if (!dilithiumReady) {
        await initDilithium();
        dilithiumReady = true;
    }
}
```

---

### 2. Persistent Identity

Store user identity for consistent ID:

```javascript
// Save seed securely
function saveToSecureStorage(seed) {
    // Option A: localStorage (less secure)
    localStorage.setItem('net3-seed', seed);

    // Option B: IndexedDB (better)
    // Option C: Server-side encrypted storage (best)
}

// Always use same seed
async function getIdentity() {
    let seed = getFromSecureStorage();
    if (!seed) {
        seed = generateRandomSeed();
        saveToSecureStorage(seed);
    }
    const keys = await keyGenFromSeed(seed);
    keys.id = hexToBase58(await createFoldedHash(keys.pub));
    return keys;
}
```

---

### 3. Connection Pooling

Reuse connections instead of reconnecting:

```javascript
class Net3Client {
    constructor() {
        this.connections = new Map();
    }

    async getConnection(serverInfo) {
        const key = `${serverInfo.host}:${serverInfo.port}`;

        if (this.connections.has(key)) {
            const conn = this.connections.get(key);
            if (conn.isConnected()) {
                return conn;
            }
        }

        // Create new connection
        const conn = new SecureConnectionWS();
        await conn.connect(this.clientKeys, serverInfo);
        this.connections.set(key, conn);
        return conn;
    }
}
```

---

### 4. Timeout Configuration

Adjust timeout for slow networks:

```javascript
const conn = new SecureConnectionWS();
conn.TIMEOUT = 30000; // 30 seconds instead of default 15s

await conn.connect(keys, intended);
```

---

### 5. Graceful Disconnection

Always disconnect when done:

```javascript
async function doWork() {
    const conn = new SecureConnectionWS();

    try {
        await conn.connect(keys, intended);
        const result = await conn.send(request);
        return result;

    } finally {
        conn.disconnect(); // Always disconnect
    }
}
```

---

### 6. Message Validation

Validate received messages:

```javascript
connection.handleMsg = async function(id, received) {
    // Validate structure
    if (!received || typeof received !== 'object') {
        console.error('Invalid message format');
        return;
    }

    // Validate required fields
    if (!received.type) {
        console.error('Message missing type');
        return;
    }

    // Process message
    switch (received.type) {
        case 'notification':
            handleNotification(received);
            break;
        default:
            console.warn('Unknown message type:', received.type);
    }
};
```

---

### 7. Loading States

Show users what's happening:

```javascript
async function connectWithUI() {
    showStatus('Initializing...');
    await initDilithium();

    showStatus('Generating keys...');
    const keys = await getKeys();

    showStatus('Connecting...');
    const conn = new SecureConnectionWS();
    await conn.connect(keys, intended);

    showStatus('Connected!');
    return conn;
}

function showStatus(msg) {
    document.getElementById('status').textContent = msg;
}
```

---

### 8. Environment Configuration

Use environment-specific settings:

```javascript
const CONFIG = {
    development: {
        registryHost: 'localhost',
        registryPort: 15160,
        registryID: 'DevRegistryID'
    },
    production: {
        registryHost: 'registry.net3.network',
        registryPort: 15160,
        registryID: 'ProdRegistryID'
    }
};

const env = window.location.hostname === 'localhost'
    ? 'development'
    : 'production';

const config = CONFIG[env];
```

---

## Troubleshooting

### Problem: WASM Module Fails to Load

**Symptoms**: `dilithium is not defined` or WASM loading errors

**Solutions**:
1. Ensure `dilithium.js` is loaded before your module code:
   ```html
   <script src="./dilithium.js"></script>
   <script type="module" src="./app.js"></script>
   ```

2. Check file paths are correct:
   ```javascript
   // In initDilithium():
   locateFile: (path) => "./" + path
   ```

3. Verify `dilithium.wasm` is served with correct MIME type
   - Should be `application/wasm`
   - Check server configuration

---

### Problem: Keys Not Persisting

**Symptoms**: Different ID on each page load

**Solutions**:
1. Save and restore seed:
   ```javascript
   // Save
   localStorage.setItem('seed', seed);

   // Restore
   const seed = localStorage.getItem('seed');
   if (seed) {
       keys = await keyGenFromSeed(seed);
   }
   ```

2. Check localStorage quota and permissions

---

### Problem: Connection Hangs

**Symptoms**: Connection never completes, no error

**Solutions**:
1. Check WebSocket server is running:
   ```bash
   # Try connecting with wscat
   wscat -c wss://server.com:15160
   ```

2. Verify server ID is correct:
   ```javascript
   // Server must have this exact ID
   id: 'ExactServerIDInBase58'
   ```

3. Check firewall/network allows WebSocket connections

4. Increase timeout:
   ```javascript
   connection.TIMEOUT = 30000; // 30 seconds
   ```

---

### Problem: Messages Not Received

**Symptoms**: `send()` times out or never resolves

**Solutions**:
1. Ensure server sends response for each message

2. Check message format:
   ```javascript
   // Server should respond with JSON object
   await connection.send({ action: 'test' });
   // Expects: { status: 'ok', ... }
   ```

3. Override `handleMsg` for debugging:
   ```javascript
   connection.handleMsg = async function(id, msg) {
       console.log('Received:', msg);
   };
   ```

---

### Problem: Authentication Fails

**Symptoms**: `I failed proving my ID` or `couldn't prove ID`

**Solutions**:
1. Verify server ID matches exactly:
   ```javascript
   // Get server ID from registry first
   const serverInfo = await registry.lookup('service-name');

   // Use that ID to connect
   await conn.connect(keys, {
       host: serverInfo.host,
       port: serverInfo.port,
       id: serverInfo.id // From registry
   });
   ```

2. Check both client and server use same protocol version

3. Ensure Dilithium5 is used on both sides (not Dilithium3)

---

### Debug Logging

Enable detailed logging:

```javascript
class DebugSecureConnectionWS extends SecureConnectionWS {
    setupWebSocketEvents() {
        const originalOnMessage = this.ws.onmessage;

        this.ws.onmessage = async (event) => {
            console.log(`[Pass ${this.pass}] Received:`, event.data);
            await originalOnMessage.call(this, event);
        };

        const originalSend = this.ws.send.bind(this.ws);
        this.ws.send = (data) => {
            console.log(`[Pass ${this.pass}] Sending:`, data);
            originalSend(data);
        };

        super.setupWebSocketEvents();
    }
}

// Use debug version
const conn = new DebugSecureConnectionWS();
```

---

### Testing Checklist

Before deploying:

- [ ] HTTPS or localhost (Web Crypto requirement)
- [ ] Dilithium WASM files accessible
- [ ] SHA3 library loaded
- [ ] Server ID correct and verified
- [ ] Error handling implemented
- [ ] Loading states for UX
- [ ] Cleanup/disconnect logic
- [ ] Identity persistence working
- [ ] Test on target browsers
- [ ] Network timeout handling

---

## Additional Resources

- **Net3 GitHub**: [https://github.com/papasugarman/net3](https://github.com/papasugarman/net3)
- **Net3 Telegram**: [https://t.me/net_three](https://t.me/net_three)
- **Registry Service**: Connect to `/0/::registry~3` for free Net3 names
- **Whitepaper**: See `whitepaper.pdf` in this directory

---

## License and Contributing

Net3 is an open protocol. Check the GitHub repository for contribution guidelines and license information.

---

**Last Updated**: December 2025
**Protocol Version**: 3.0
**Document Version**: 1.0
