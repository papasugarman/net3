# Net3 post-Quantum security protocol
Net3 is a new public network with its own secure handshake mechanism. Net3 provides:

- **Mutual Authentication**: Both client and server authenticate each other during handshake
- **Post-Quantum Cryptography**: NIST-approved algorithms (ML-KEM-1024 and Dilithium5)
- **Key-Based Access**: No usernames or passwords - cryptographic keys identify entities
- **End-to-End Encryption**: All traffic is encrypted using AES-256-GCM 

These folders contain source code to run:
a) Net3 TCP connection
b) Implementation in browser using webssockets
c) Node.js listeners for the websocket services

# Connection Handshake Protocol

## Handshake Flow

**Step 1: Connection Initialization**
- Connecting Party → Listening Party: Connection JSON
- Listening Party → Connecting Party: Pub (MLKEM)

**Step 2: Secure Channel Establishment**
- Connecting Party → Listening Party: Cypher
- Listening Party → Connecting Party: OK
- **Status: Connection secured**

**Step 3: Connecting Party Authentication**
- Connecting Party → Listening Party: Authentication JSON
- Listening Party → Connecting Party: Challenge
- Connecting Party → Listening Party: Pub (Dilithium) + Signed
- Listening Party → Connecting Party: OK
- **Status: Connecting party authenticated**

**Step 4: Listening Party Authentication**
- Listening Party → Connecting Party: Challenge
- Connecting Party → Listening Party: Pub (Dilithium) + Signed
- Listening Party → Connecting Party: OK
- **Status: Listening party authenticated**

## Protocol Summary

1. **Connection JSON** - Initial connection request
2. **Pub (MLKEM)** - ML-KEM public key for quantum-resistant key exchange
3. **Cypher** - Encrypted session key
4. **Authentication JSON** - Authentication initiation
5. **Challenge** - Random challenge for signature verification
6. **Pub (Dilithium) + Signed** - Dilithium public key with signed challenge response
7. **OK** - Acknowledgment of successful verification
