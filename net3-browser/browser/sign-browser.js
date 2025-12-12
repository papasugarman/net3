// Browser-compatible digital signatures using Dilithium
// Requires dilithium WASM module to be loaded first
import { arrayToHex, hexToArray } from './util-browser.js';

// Global variable to hold the initialized Dilithium module
let dilithiumModule = null;

const DILITHIUM_KIND = 2; // Using Dilithium5 (kind 2)

const DILITHIUM_PARAMS = [
    { CRYPTO_PUBLICKEYBYTES: 896, CRYPTO_SECRETKEYBYTES: 2096, CRYPTO_BYTES: 1387 },
    { CRYPTO_PUBLICKEYBYTES: 1184, CRYPTO_SECRETKEYBYTES: 2800, CRYPTO_BYTES: 2044 },
    { CRYPTO_PUBLICKEYBYTES: 1472, CRYPTO_SECRETKEYBYTES: 3504, CRYPTO_BYTES: 2701 },
    { CRYPTO_PUBLICKEYBYTES: 1760, CRYPTO_SECRETKEYBYTES: 3856, CRYPTO_BYTES: 3366 }
];

// Initialize Dilithium WASM module
async function initDilithium() {
    if (dilithiumModule) return dilithiumModule;

    // Fetch the WASM binary
    const wasmBuffer = await (await fetch("./dilithium.wasm")).arrayBuffer();

    // Initialize Dilithium with the WASM binary
    dilithiumModule = await dilithium({
        wasmBinary: wasmBuffer,
        locateFile: (path) => "./" + path
    });

    return dilithiumModule;
}

// Generate keypair
async function keyGen() {
    if (!dilithiumModule) await initDilithium();

    const kind = DILITHIUM_KIND;
    const params = DILITHIUM_PARAMS[kind];

    const publicKeyPtr = dilithiumModule._malloc(params.CRYPTO_PUBLICKEYBYTES);
    const privateKeyPtr = dilithiumModule._malloc(params.CRYPTO_SECRETKEYBYTES);

    const result = dilithiumModule.ccall(
        "dilithium_keygen",
        "number",
        ["number", "number", "number", "number", "number"],
        [publicKeyPtr, privateKeyPtr, kind, 0, 0]
    );

    if (result !== 0) {
        dilithiumModule._free(publicKeyPtr);
        dilithiumModule._free(privateKeyPtr);
        throw new Error("Key generation failed");
    }

    const publicKey = new Uint8Array(
        dilithiumModule.HEAPU8.subarray(publicKeyPtr, publicKeyPtr + params.CRYPTO_PUBLICKEYBYTES)
    );
    const privateKey = new Uint8Array(
        dilithiumModule.HEAPU8.subarray(privateKeyPtr, privateKeyPtr + params.CRYPTO_SECRETKEYBYTES)
    );

    dilithiumModule._free(publicKeyPtr);
    dilithiumModule._free(privateKeyPtr);

    return {
        pub: arrayToHex(publicKey),
        priv: arrayToHex(privateKey),
        seed: ""
    };
}

// Generate keypair from seed
async function keyGenFromSeed(seed) {
    if (!dilithiumModule) await initDilithium();

    const kind = DILITHIUM_KIND;
    const params = DILITHIUM_PARAMS[kind];
    const seedArray = hexToArray(seed);

    const seedPtr = dilithiumModule._malloc(seedArray.length);
    dilithiumModule.HEAPU8.set(seedArray, seedPtr);

    const publicKeyPtr = dilithiumModule._malloc(params.CRYPTO_PUBLICKEYBYTES);
    const privateKeyPtr = dilithiumModule._malloc(params.CRYPTO_SECRETKEYBYTES);

    const result = dilithiumModule.ccall(
        "dilithium_keygen",
        "number",
        ["number", "number", "number", "number", "number"],
        [publicKeyPtr, privateKeyPtr, kind, seedPtr, seedArray.length]
    );

    dilithiumModule._free(seedPtr);

    if (result !== 0) {
        dilithiumModule._free(publicKeyPtr);
        dilithiumModule._free(privateKeyPtr);
        throw new Error("Key generation from seed failed");
    }

    const publicKey = new Uint8Array(
        dilithiumModule.HEAPU8.subarray(publicKeyPtr, publicKeyPtr + params.CRYPTO_PUBLICKEYBYTES)
    );
    const privateKey = new Uint8Array(
        dilithiumModule.HEAPU8.subarray(privateKeyPtr, privateKeyPtr + params.CRYPTO_SECRETKEYBYTES)
    );

    dilithiumModule._free(publicKeyPtr);
    dilithiumModule._free(privateKeyPtr);

    return {
        pub: arrayToHex(publicKey),
        priv: arrayToHex(privateKey),
        seed: seed
    };
}

// Sign a message
async function sign(text, privHex) {
    if (!dilithiumModule) await initDilithium();

    const kind = DILITHIUM_KIND;
    const params = DILITHIUM_PARAMS[kind];

    const priv = hexToArray(privHex);
    const message = typeof text === 'string' ? hexToArray(text) : text;

    if (priv.length !== params.CRYPTO_SECRETKEYBYTES) {
        throw new Error(
            `Invalid private key size. Expected: ${params.CRYPTO_SECRETKEYBYTES}, Provided: ${priv.length}`
        );
    }

    const messagePtr = dilithiumModule._malloc(message.length);
    dilithiumModule.HEAPU8.set(message, messagePtr);

    const privateKeyPtr = dilithiumModule._malloc(priv.length);
    dilithiumModule.HEAPU8.set(priv, privateKeyPtr);

    const maxSignatureLength = params.CRYPTO_BYTES + message.length;
    const signaturePtr = dilithiumModule._malloc(maxSignatureLength);
    const signatureLengthPtr = dilithiumModule._malloc(4);
    dilithiumModule.setValue(signatureLengthPtr, maxSignatureLength, "i32");

    const result = dilithiumModule.ccall(
        "dilithium_sign",
        "number",
        ["number", "number", "number", "number", "number", "number", "number"],
        [signaturePtr, signatureLengthPtr, messagePtr, message.length, privateKeyPtr, priv.length, kind]
    );

    const actualSignatureLength = dilithiumModule.getValue(signatureLengthPtr, "i32");
    const signatureData = new Uint8Array(
        dilithiumModule.HEAPU8.buffer,
        signaturePtr,
        actualSignatureLength
    );
    const signature = new Uint8Array(signatureData);

    dilithiumModule._free(messagePtr);
    dilithiumModule._free(privateKeyPtr);
    dilithiumModule._free(signaturePtr);
    dilithiumModule._free(signatureLengthPtr);

    if (result !== 0) {
        throw new Error("Signing failed");
    }

    return arrayToHex(signature);
}

// Verify a signature
async function verify(signHex, text, pubHex) {
    if (!dilithiumModule) await initDilithium();

    const kind = DILITHIUM_KIND;
    const params = DILITHIUM_PARAMS[kind];

    const signatureArray = hexToArray(signHex);
    const pub = hexToArray(pubHex);
    const message = typeof text === 'string' ? hexToArray(text) : text;

    const expectedSignatureSize = params.CRYPTO_BYTES + message.length;
    const expectedPublicKeySize = params.CRYPTO_PUBLICKEYBYTES;

    if (signatureArray.length !== expectedSignatureSize) {
        throw new Error(
            `Invalid signature size. Expected ${expectedSignatureSize}, got ${signatureArray.length}`
        );
    }
    if (pub.length !== expectedPublicKeySize) {
        throw new Error(
            `Invalid public key size. Expected ${expectedPublicKeySize}, got ${pub.length}`
        );
    }

    const signaturePtr = dilithiumModule._malloc(expectedSignatureSize);
    const messagePtr = dilithiumModule._malloc(message.length);
    const publicKeyPtr = dilithiumModule._malloc(expectedPublicKeySize);

    dilithiumModule.HEAPU8.set(signatureArray, signaturePtr);
    dilithiumModule.HEAPU8.set(message, messagePtr);
    dilithiumModule.HEAPU8.set(pub, publicKeyPtr);

    const result = dilithiumModule.ccall(
        "dilithium_verify",
        "number",
        ["number", "number", "number", "bigint", "number", "number", "number"],
        [signaturePtr, expectedSignatureSize, messagePtr, BigInt(message.length), publicKeyPtr, expectedPublicKeySize, kind]
    );

    dilithiumModule._free(signaturePtr);
    dilithiumModule._free(messagePtr);
    dilithiumModule._free(publicKeyPtr);

    return result === 0; // Returns true if valid (result === 0 means valid)
}

export { initDilithium, keyGen, keyGenFromSeed, sign, verify };
