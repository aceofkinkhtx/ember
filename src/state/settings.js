import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { emptyIdentity } from '../content/identity';
import { defaultTopSetupFrom, emptyTopSetup } from '../content/topSetup';
import { readJson, writeJson } from '../lib/storage';
export const SETTINGS_KEY = 'ember.settings';
export const defaultSettings = {
    version: 1,
    onboarding: 'welcome',
    ageConfirmedAt: null,
    roles: null,
    identity: emptyIdentity,
    activeRole: 'top',
    depth: 'simple',
    discreet: false,
    pin: null,
    safetyFloorAcknowledgedAt: null,
    notifications: { dailyTips: true, checkIns: true },
    donationPromptedAt: null,
    top: emptyTopSetup()
};
export function loadSettings() {
    const saved = readJson(SETTINGS_KEY);
    if (!saved || saved.version !== 1)
        return defaultSettings;
    return {
        ...defaultSettings,
        ...saved,
        identity: { ...emptyIdentity, ...saved.identity },
        notifications: { ...defaultSettings.notifications, ...saved.notifications },
        top: defaultTopSetupFrom(saved.top)
    };
}
/** Which role a person lands in after choosing at welcome. */
export function roleFor(choice) {
    return choice === 'bottom' ? 'bottom' : 'top';
}
/** The order of onboarding steps for a role choice. Bottoms skip the Top's steps. */
export function onboardingSteps(roles) {
    return roles === 'bottom' ? ['welcome', 'about', 'privacy', 'safety'] : ['welcome', 'about', 'privacy', 'depth', 'offerings', 'topSettings', 'safety'];
}
export function nextStep(current, roles) {
    const steps = onboardingSteps(roles);
    const i = steps.indexOf(current);
    return i < 0 || i === steps.length - 1 ? 'done' : steps[i + 1];
}
const SettingsContext = createContext(null);
export function SettingsProvider({ children, initial }) {
    const [settings, setSettings] = useState(() => initial ?? loadSettings());
    useEffect(() => {
        writeJson(SETTINGS_KEY, settings);
    }, [settings]);
    const update = useCallback((patch) => {
        setSettings((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
    }, []);
    const value = useMemo(() => ({ settings, update }), [settings, update]);
    return _jsx(SettingsContext.Provider, { value: value, children: children });
}
export function useSettings() {
    const ctx = useContext(SettingsContext);
    if (!ctx)
        throw new Error('useSettings must be used inside SettingsProvider');
    return ctx;
}
