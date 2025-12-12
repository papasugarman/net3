// Browser-compatible symmetric encryption using AES-256-GCM
import { hexToArray, arrayToHex } from './util-browser.js';

const algorithm = 'AES-GCM';

// Check if Web Crypto API is available (requires secure context)
function checkSecureContext() {
    if (!window.crypto || !window.crypto.subtle) {
        const currentUrl = window.location.href;
        throw new Error(
            `Web Crypto API is not available. This is required for secure encryption.\n\n` +
            `Current URL: ${currentUrl}\n\n` +
            `Solutions:\n` +
            `1. Access via HTTPS: https://${window.location.host}\n` +
            `2. Access via localhost: http://localhost${window.location.port ? ':' + window.location.port : ''}${window.location.pathname}\n` +
            `3. Access via 127.0.0.1: http://127.0.0.1${window.location.port ? ':' + window.location.port : ''}${window.location.pathname}\n\n` +
            `The Web Crypto API is only available in secure contexts (HTTPS) or localhost.`
        );
    }
}

async function encrypt(text, keyHex) {
    checkSecureContext();

    // Convert hex key to CryptoKey
    const keyBuffer = hexToArray(keyHex);
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: algorithm, length: 256 },
        false,
        ['encrypt']
    );

    // Generate random IV (16 bytes / 128 bits)
    const iv = crypto.getRandomValues(new Uint8Array(16));

    // Encrypt the text
    const encodedText = new TextEncoder().encode(text);
    const encryptedBuffer = await crypto.subtle.encrypt(
        {
            name: algorithm,
            iv: iv,
            tagLength: 128 // 128-bit auth tag
        },
        cryptoKey,
        encodedText
    );

    // The encrypted buffer contains ciphertext + auth tag at the end
    const encryptedArray = new Uint8Array(encryptedBuffer);

    // Split into ciphertext and auth tag (last 16 bytes)
    const ciphertext = encryptedArray.slice(0, -16);
    const authTag = encryptedArray.slice(-16);

    // Return: IV (32 hex) + AuthTag (32 hex) + EncryptedData
    return arrayToHex(iv) + arrayToHex(authTag) + arrayToHex(ciphertext);
}

async function decrypt(text, keyHex) {
    checkSecureContext();

    // Parse the encrypted text
    const ivHex = text.substring(0, 32);
    const authTagHex = text.substring(32, 64);
    const encryptedDataHex = text.substring(64);

    // Convert to buffers
    const iv = hexToArray(ivHex);
    const authTag = hexToArray(authTagHex);
    const ciphertext = hexToArray(encryptedDataHex);

    // Combine ciphertext and auth tag for decryption
    const encryptedData = new Uint8Array(ciphertext.length + authTag.length);
    encryptedData.set(ciphertext);
    encryptedData.set(authTag, ciphertext.length);

    // Convert hex key to CryptoKey
    const keyBuffer = hexToArray(keyHex);
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: algorithm, length: 256 },
        false,
        ['decrypt']
    );

    // Decrypt
    try {
        const decryptedBuffer = await crypto.subtle.decrypt(
            {
                name: algorithm,
                iv: iv,
                tagLength: 128
            },
            cryptoKey,
            encryptedData
        );

        const decryptedText = new TextDecoder().decode(decryptedBuffer);
        return decryptedText;
    } catch (e) {
        throw new Error('Decryption failed: ' + e.message);
    }
}

export { encrypt, decrypt };
