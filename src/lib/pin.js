// PIN hashing with the browser's built-in WebCrypto (PBKDF2, SHA-256).
// The PIN itself is never stored, only a salted hash.
//
// The PIN is a screen lock. It keeps out someone who picks up an unlocked
// phone; it is not encryption. Encrypting sensitive data is planned
// separately (see CLAUDE.md, Encryption).
export const PIN_LENGTH = 6;
export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 30_000;
const ITERATIONS = 310_000;
export function isValidPin(pin) {
    return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}
function toBase64(bytes) {
    let s = '';
    bytes.forEach((b) => (s += String.fromCharCode(b)));
    return btoa(s);
}
function fromBase64(text) {
    return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
async function derive(pin, salt, iterations) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations }, key, 256);
    return new Uint8Array(bits);
}
export async function createPinRecord(pin) {
    if (!isValidPin(pin))
        throw new Error(`PIN must be ${PIN_LENGTH} digits`);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(pin, salt, ITERATIONS);
    return { hash: toBase64(hash), salt: toBase64(salt), iterations: ITERATIONS };
}
export async function verifyPin(pin, record) {
    if (!isValidPin(pin))
        return false;
    const actual = await derive(pin, fromBase64(record.salt), record.iterations);
    const expected = fromBase64(record.hash);
    if (actual.length !== expected.length)
        return false;
    // Compare every byte so timing does not reveal how much matched.
    let diff = 0;
    for (let i = 0; i < actual.length; i++)
        diff |= actual[i] ^ expected[i];
    return diff === 0;
}
