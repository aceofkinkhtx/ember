import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Role, RoleChoice } from '../content/copy';
import { emptyIdentity, type Identity } from '../content/identity';
import { defaultTopSetupFrom, emptyTopSetup, type TopSetup } from '../content/topSetup';
import type { PinRecord } from '../lib/pin';
import { readJson, writeJson } from '../lib/storage';

// Device settings. Until accounts arrive (M1) these live only on this phone.

export type OnboardingStep = 'welcome' | 'about' | 'privacy' | 'depth' | 'offerings' | 'topSettings' | 'safety' | 'done';
export type Depth = 'simple' | 'studio';

export interface Settings {
  version: 1;
  onboarding: OnboardingStep;
  ageConfirmedAt: string | null;
  roles: RoleChoice | null;
  identity: Identity;
  activeRole: Role;
  depth: Depth;
  discreet: boolean;
  pin: PinRecord | null;
  safetyFloorAcknowledgedAt: string | null;
  notifications: { dailyTips: boolean; checkIns: boolean; messages: boolean };
  /** When the monthly donation note last appeared. */
  donationPromptedAt: string | null;
  /** A Top's offerings and settings (M3). Kept for switches in the bottom view too. */
  top: TopSetup;
}

export const SETTINGS_KEY = 'ember.settings';

export const defaultSettings: Settings = {
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
  notifications: { dailyTips: true, checkIns: true, messages: true },
  donationPromptedAt: null,
  top: emptyTopSetup()
};

export function loadSettings(): Settings {
  const saved = readJson<Partial<Settings>>(SETTINGS_KEY);
  if (!saved || saved.version !== 1) return defaultSettings;
  return {
    ...defaultSettings,
    ...saved,
    identity: { ...emptyIdentity, ...saved.identity },
    notifications: { ...defaultSettings.notifications, ...saved.notifications },
    top: defaultTopSetupFrom(saved.top)
  };
}

/** Which role a person lands in after choosing at welcome. */
export function roleFor(choice: RoleChoice): Role {
  return choice === 'bottom' ? 'bottom' : 'top';
}

/** The order of onboarding steps for a role choice. Bottoms skip the Top's steps. */
export function onboardingSteps(roles: RoleChoice | null): OnboardingStep[] {
  return roles === 'bottom' ? ['welcome', 'about', 'privacy', 'safety'] : ['welcome', 'about', 'privacy', 'depth', 'offerings', 'topSettings', 'safety'];
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
