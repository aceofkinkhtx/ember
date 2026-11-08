import { useEffect, useRef, useState, type ReactNode } from 'react';
import { unlockWithBiometric } from '../lib/biometric';
import { LOCKOUT_MS, MAX_ATTEMPTS, verifyPin } from '../lib/pin';
import { eraseAll, readJson, writeJson } from '../lib/storage';
import { useSettings } from '../state/settings';
import { EmberMark } from './EmberMark';
import { PinPad } from './PinPad';

// Locks Ember behind the PIN when it opens and after it has been in the
// background for a while. While hidden, a plain cover hides the screen so the
// phone's app switcher preview shows nothing.

export const RELOCK_AFTER_MS = 60_000;
const LOCK_KEY = 'ember.lock';

interface LockState {
  failures: number;
  lockedUntil: number;
}

export function LockGate({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const hasPin = settings.pin !== null;
  const [locked, setLocked] = useState(hasPin);
  const [hidden, setHidden] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  // Removing the PIN in settings unlocks; setting one does not lock right away.
  useEffect(() => {
    if (!hasPin) setLocked(false);
  }, [hasPin]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now();
        setHidden(true);
      } else {
        setHidden(false);
        if (hasPin && hiddenAt.current !== null && Date.now() - hiddenAt.current >= RELOCK_AFTER_MS) {
          setLocked(true);
        }
        hiddenAt.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [hasPin]);

  return (
    <>
      {locked && settings.pin ? <LockScreen onUnlock={() => setLocked(false)} /> : children}
      {hidden && <div className="cover" data-theme="live" aria-hidden="true" />}
    </>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { settings } = useSettings();
  const [state, setState] = useState<LockState>(() => readJson<LockState>(LOCK_KEY) ?? { failures: 0, lockedUntil: 0 });
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('');
  const [confirmErase, setConfirmErase] = useState(false);

  const waiting = state.lockedUntil > now;

  useEffect(() => {
    if (!waiting) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [waiting]);

  const save = (next: LockState) => {
    setState(next);
    writeJson(LOCK_KEY, next);
  };

  const attempt = async (pin: string) => {
    if (!settings.pin || state.lockedUntil > Date.now()) return;
    if (await verifyPin(pin, settings.pin)) {
      save({ failures: 0, lockedUntil: 0 });
      onUnlock();
      return;
    }
    const failures = state.failures + 1;
    if (failures >= MAX_ATTEMPTS) {
      save({ failures: 0, lockedUntil: Date.now() + LOCKOUT_MS });
      setNow(Date.now());
      setMessage('');
    } else {
      save({ failures, lockedUntil: 0 });
      setMessage(`That PIN didn't match. ${MAX_ATTEMPTS - failures} tries left before a short wait.`);
    }
  };

  const tryBiometric = async () => {
    if (settings.biometric && (await unlockWithBiometric(settings.biometric))) {
      save({ failures: 0, lockedUntil: 0 });
      onUnlock();
    } else setMessage("That didn't work. Use your PIN instead.");
  };

  const secondsLeft = Math.ceil((state.lockedUntil - now) / 1000);

  return (
    <div className="lock" data-theme="live">
      <EmberMark />
      <PinPad
        title="Enter your PIN"
        message={waiting ? `Too many tries. Try again in ${secondsLeft} seconds.` : message}
        tone={waiting || message ? 'error' : 'info'}
        disabled={waiting}
        onComplete={attempt}
      />
      {settings.biometric && !waiting && (
        <button type="button" className="btn btn-secondary" onClick={() => void tryBiometric()}>
          Use Face ID or fingerprint
        </button>
      )}
      <button type="button" className="btn btn-quiet" onClick={() => setConfirmErase(true)}>
        Forgot PIN?
      </button>

      {confirmErase && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="erase-title">
          <div className="sheet">
            <h2 id="erase-title">Start over on this phone?</h2>
            <p>
              A forgotten PIN can't be recovered. Starting over erases everything Ember has saved on this phone, and
              you'll set it up again from the beginning. If you have an account, sign in again afterward and your
              locked data comes back.
            </p>
            <button
              type="button"
              className="btn btn-danger btn-block"
              onClick={() => {
                eraseAll();
                window.location.reload();
              }}
            >
              Erase and start over
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirmErase(false)}>
              Keep trying
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
