import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Role, RoleChoice } from '../content/copy';
import type { PinRecord } from '../lib/pin';
import { readJson, writeJson } from '../lib/storage';

// Device settings. Until accounts arrive (M1) these live only on this phone.

export type OnboardingStep = 'welcome' | 'privacy' | 'depth' | 'safety' | 'done';
export type Depth = 'simple' | 'studio';

export interface Settings {
  version: 1;
  onboarding: OnboardingStep;
  ageConfirmedAt: string | null;
  roles: RoleChoice | null;
  activeRole: Role;
  depth: Depth;
  discreet: boolean;
  pin: PinRecord | null;
  safetyFloorAcknowledgedAt: string | null;
  notifications: { dailyTips: boolean; checkIns: boolean };
}

export const SETTINGS_KEY = 'ember.settings';

export const defaultSettings: Settings = {
  version: 1,
  onboarding: 'welcome',
  ageConfirmedAt: null,
  roles: null,
  activeRole: 'top',
  depth: 'simple',
  discreet: false,
  pin: null,
  safetyFloorAcknowledgedAt: null,
  notifications: { dailyTips: true, checkIns: true }
};

export function loadSettings(): Settings {
  const saved = readJson<Partial<Settings>>(SETTINGS_KEY);
  if (!saved || saved.version !== 1) return defaultSettings;
  return {
    ...defaultSettings,
    ...saved,
    notifications: { ...defaultSettings.notifications, ...saved.notifications }
  };
}

/** Which role a person lands in after choosing at welcome. */
export function roleFor(choice: RoleChoice): Role {
  return choice === 'bottom' ? 'bottom' : 'top';
}

/** The order of onboarding steps for a role choice. Bottoms skip the depth step. */
export function onboardingSteps(roles: RoleChoice | null): OnboardingStep[] {
  return roles === 'bottom' ? ['welcome', 'privacy', 'safety'] : ['welcome', 'privacy', 'depth', 'safety'];
}

export function nextStep(current: OnboardingStep, roles: RoleChoice | null): OnboardingStep {
  const steps = onboardingSteps(roles);
  const i = steps.indexOf(current);
  return i < 0 || i === steps.length - 1 ? 'done' : steps[i + 1];
}

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children, initial }: { children: ReactNode; initial?: Settings }) {
  const [settings, setSettings] = useState<Settings>(() => initial ?? loadSettings());

  useEffect(() => {
    writeJson(SETTINGS_KEY, settings);
  }, [settings]);

  const update = useCallback<SettingsContextValue['update']>((patch) => {
    setSettings((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  }, []);

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
