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

Listening Party                          Connecting Party
     |                                          |
     |  <---------- Connection JSON ----------  |
     |                                          |
     |  ---------- Pub (MLKEM) ------------->   |
     |                                          |
     |  <------------ Cypher ---------------->  |
     |                                          |
     |  <------------ OK -------------------->  |
     |                                          | (Connection secured)
     |  <------ Authentication JSON -------->   |
     |                                          |
     |  <---------- Challenge --------------->  |
     |                                          |
     |  <---- Pub (Dilithium) + Signed ------>  |
     |                                          |
     |  <------------ OK -------------------->  |
     |                                          | (Connecting party authenticated)
     |  ----------- Challenge --------------->  |
     |                                          |
     |  <---- Pub (Dilithium) + Signed ------   |
     |                                          |
     |  ------------- OK ---------------------> |
     |                                          |
(Listening party authenticated)
