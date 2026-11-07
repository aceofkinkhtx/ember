import { deriveFromPassword, formatRecoveryCode, lock, newKeyPair, newRecoveryCode, newSalt, newSecretKey, normalizeRecoveryCode, openSealed, recoveryKey, sealFor, unlock } from './crypto';
// Light settings so the tests run fast; the app uses the stronger defaults.
const fast = { v: 1, alg: 'argon2id13', ops: 1, mem: 8 * 1024 * 1024 };
describe('password secrets', () => {
    it('are the same each time for the same email and password', async () => {
        const a = await deriveFromPassword('River@Example.com ', 'correct horse', fast);
        const b = await deriveFromPassword('river@example.com', 'correct horse', fast);
        expect(a.authSecret).toBe(b.authSecret);
        expect(Array.from(a.wrapKey)).toEqual(Array.from(b.wrapKey));
    });
    it('keep the sign-in secret unrelated to the unlock key', async () => {
        const a = await deriveFromPassword('river@example.com', 'correct horse', fast);
        const b = await deriveFromPassword('river@example.com', 'wrong horse', fast);
        expect(a.authSecret).not.toBe(b.authSecret);
        const s = await import('libsodium-wrappers-sumo');
        expect(a.authSecret).not.toBe(s.default.to_base64(a.wrapKey));
    });
});
describe('locking', () => {
    it('opens with the right key and refuses the wrong one', async () => {
        const key = await newSecretKey();
        const box = await lock('red: no gags', key);
        expect(box).not.toContain('gags');
        expect(await unlock(box, key)).toBe('red: no gags');
        await expect(unlock(box, await newSecretKey())).rejects.toThrow();
    });
    it('seals for one person only', async () => {
        const jade = await newKeyPair();
        const sol = await newKeyPair();
        const sealed = await sealFor('for Jade', jade.publicKey);
        expect(await openSealed(sealed, jade)).toBe('for Jade');
        await expect(openSealed(sealed, sol)).rejects.toThrow();
    });
});
describe('recovery code', () => {
    it('is 24 easy-to-read characters and still works when typed with dashes or lowercase', async () => {
        const code = await newRecoveryCode();
        expect(code).toMatch(/^[A-HJKMNP-Z2-9]{24}$/);
        const salt = await newSalt();
        const typed = formatRecoveryCode(code).toLowerCase();
        expect(normalizeRecoveryCode(typed)).toBe(code);
        expect(Array.from(await recoveryKey(typed, salt))).toEqual(Array.from(await recoveryKey(code, salt)));
    });
});
