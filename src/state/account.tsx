import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { db, loadKeys, saveProfile, signOut, type StoredKeys } from '../lib/account';
import { useSettings } from './settings';

// Who is signed in on this phone, and their unlocked keys.

type Status = 'loading' | 'signed-out' | 'signed-in';

interface AccountValue {
  status: Status;
  email: string | null;
  keys: StoredKeys | null;
  /** Rereads the session and keys after signing in or out. */
  refresh: () => Promise<void>;
}

const AccountContext = createContext<AccountValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [state, setState] = useState<Omit<AccountValue, 'refresh'>>({ status: 'loading', email: null, keys: null });

  const refresh = useCallback(async () => {
    try {
      const { data } = await db.auth.getSession();
      const keys = loadKeys();
      const user = data.session?.user;
      if (user && keys?.userId === user.id) {
        setState({ status: 'signed-in', email: user.email ?? null, keys });
        return;
      }
      // A session without keys (for example from an email link) can't open
      // anything, so it is set aside until the person signs in with a password.
      if (user) await signOut();
    } catch {
      // Offline or storage blocked: treat as signed out on this phone.
    }
    setState({ status: 'signed-out', email: null, keys: null });
  }, []);

  useEffect(() => {
    void refresh();
    const { data } = db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setState({ status: 'signed-out', email: null, keys: null });
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  // Keep the locked copy of "About you" current, a moment after the last change.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!state.keys) return;
    const keys = state.keys;
    const timer = window.setTimeout(() => void saveProfile(keys, { identity: settings.identity }).catch(() => undefined), 2000);
    return () => window.clearTimeout(timer);
  }, [settings.identity, state.keys]);

  return <AccountContext.Provider value={{ ...state, refresh }}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used inside AccountProvider');
  return value;
}
