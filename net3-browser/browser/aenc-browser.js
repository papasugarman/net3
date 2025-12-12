// Browser-compatible asymmetric encryption using ML-KEM (Kyber)
// Uses the mlkem.mjs ES6 module that works in browsers
import { MlKem1024 } from '../mlkem.mjs';
import { arrayToHex, hexToArray } from './util-browser.js';

const mlkem = new MlKem1024();

async function keyGen() {
    let keyPair = await mlkem.generateKeyPair();
    var kp = new Object();
    kp.pub = arrayToHex(keyPair[0]);
    kp.priv = arrayToHex(keyPair[1]);
    return kp;
}

async function genCypher(pub) {
    pub = hexToArray(pub);
    let cypher_secret = await mlkem.encap(pub);
    const cypher = arrayToHex(cypher_secret[0]);
    const secret = arrayToHex(cypher_secret[1]);
    var obj = new Object();
    obj.cypher = cypher;
    obj.secret = secret;
    return obj;
}

async function getSecret(cypher, priv) {
    priv = hexToArray(priv);
    cypher = hexToArray(cypher);
    var secret = await mlkem.decap(cypher, priv);
    return arrayToHex(secret);
}

export { keyGen, genCypher, getSecret };
