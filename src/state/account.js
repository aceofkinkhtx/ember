import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usualRole } from '../components/RolePicker';
import { cardFor, db, loadKeys, refreshMyCards, saveProfile, signOut, syncMyCode } from '../lib/account';
import { useSettings } from './settings';
const AccountContext = createContext(null);
export function AccountProvider({ children }) {
    const { settings } = useSettings();
    const [state, setState] = useState({ status: 'loading', email: null, keys: null });
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
            if (user)
                await signOut();
        }
        catch {
            // Offline or storage blocked: treat as signed out on this phone.
        }
        setState({ status: 'signed-out', email: null, keys: null });
    }, []);
    useEffect(() => {
        void refresh();
        const { data } = db.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT')
                setState({ status: 'signed-out', email: null, keys: null });
        });
        return () => data.subscription.unsubscribe();
    }, [refresh]);
    // Keep the locked copy of "About you" (and a Top's setup) and your card on
    // each connection current, a moment after the last change.
    const first = useRef(true);
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        if (!state.keys)
            return;
        const keys = state.keys;
        const timer = window.setTimeout(() => {
            void saveProfile(keys, { identity: settings.identity, top: settings.top }).catch(() => undefined);
            void refreshMyCards(keys, cardFor(settings.identity)).catch(() => undefined);
            void syncMyCode(keys, settings.identity.name, usualRole(settings.roles)).catch(() => undefined);
        }, 2000);
        return () => window.clearTimeout(timer);
    }, [settings.identity, settings.roles, settings.top, state.keys]);
    return _jsx(AccountContext.Provider, { value: { ...state, refresh }, children: children });
}
export function useAccount() {
    const value = useContext(AccountContext);
    if (!value)
        throw new Error('useAccount must be used inside AccountProvider');
    return value;
}
