import { createPinRecord, isValidPin, verifyPin } from './pin';

describe('PIN', () => {
  it('accepts only six digits', () => {
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('1234567')).toBe(false);
    expect(isValidPin('12a456')).toBe(false);
  });

  it('never stores the PIN itself', async () => {
    const record = await createPinRecord('482913');
    expect(JSON.stringify(record)).not.toContain('482913');
  });

  it('verifies the right PIN and rejects a wrong one', async () => {
    const record = await createPinRecord('482913');
    expect(await verifyPin('482913', record)).toBe(true);
    expect(await verifyPin('482914', record)).toBe(false);
    expect(await verifyPin('', record)).toBe(false);
  });

  it('salts each PIN differently', async () => {
    const a = await createPinRecord('111111');
    const b = await createPinRecord('111111');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});
