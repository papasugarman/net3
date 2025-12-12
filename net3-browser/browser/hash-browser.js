// Browser-compatible hashing functions using js-sha3 library
import { xor } from './util-browser.js';

// SHA3-512 implementation using js-sha3 library
// The library is loaded via script tag and exposes sha3_512 to window

async function createHash(str) {
    // IMPORTANT: Node.js crypto.createHash().update(str) treats the string as text
    // Even if it's a hex string, it hashes the HEX STRING itself, not the bytes
    // So we must do the same here to match the server

    // Use sha3_512 from the loaded library (window.sha3_512)
    // Pass the string as-is (as text)
    const hashHex = window.sha3_512(str);
    return hashHex;
}

async function createFoldedHash(str) {
    const gen_hash = await createHash(str);

    // Break in two halves
    const b1 = gen_hash.substring(0, 64);
    const b2 = gen_hash.substring(64, 128);

    const mid = xor(b1, b2);

    // Break mid in two halves
    const b1_mid = mid.substring(0, 32);
    const b2_mid = mid.substring(32, 64);

    const final = xor(b1_mid, b2_mid);
    return final;
}

export { createHash, createFoldedHash };
