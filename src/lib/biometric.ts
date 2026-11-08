// Face ID, Touch ID or fingerprint unlock (M9), using the phone's own passkey
// check. Like the PIN, it is a screen lock on this phone: nothing about your
// face or finger reaches Ember, and the PIN always still works.

export interface BiometricRecord {
  /** The passkey made on this phone for unlocking Ember. */
  credentialId: string;
}

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Whether this phone can unlock with a face or fingerprint. */
export async function biometricAvailable(): Promise<boolean> {
  try {
    return Boolean(window.PublicKeyCredential) && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

/** Sets up unlocking on this phone. Asks for the face or fingerprint once. */
export async function setUpBiometric(): Promise<BiometricRecord> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Ember', id: location.hostname },
      // A random id: the passkey names no one.
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'Ember unlock', displayName: 'Ember unlock' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 }
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
      attestation: 'none'
    }
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('Not set up');
  return { credentialId: toB64(cred.rawId) };
}

/** Asks for the face or fingerprint. True when the phone confirms it. */
export async function unlockWithBiometric(record: BiometricRecord): Promise<boolean> {
  try {
    const result = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: fromB64(record.credentialId) }],
        userVerification: 'required',
        timeout: 60_000
      }
    });
    return Boolean(result);
  } catch {
    return false;
  }
}
