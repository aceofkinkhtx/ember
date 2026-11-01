import { useState } from 'react';
import { PinSetup } from '../components/PinSetup';
import { SettingSwitch } from '../components/Switch';
import { roleLabel, type RoleChoice } from '../content/copy';
import { eraseAll } from '../lib/storage';
import { roleFor, useSettings, type Depth } from '../state/settings';

// M1 (Top) and BM1 (bottom): settings for this device.

export function Me() {
  const { settings, update } = useSettings();
  const [settingPin, setSettingPin] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);

  if (settingPin) {
    return (
      <div className="lock" data-theme="live">
        <PinSetup
          onCancel={() => setSettingPin(false)}
          onDone={(pin) => {
            update({ pin });
            setSettingPin(false);
          }}
        />
      </div>
    );
  }

  const roleChoices: { id: RoleChoice; label: string }[] = [
    { id: 'top', label: roleLabel('top', settings.discreet) },
    { id: 'bottom', label: roleLabel('bottom', settings.discreet) },
    { id: 'both', label: 'Both' }
  ];

  return (
    <main className="screen">
      <h1>Me</h1>

      <section className="card" aria-labelledby="me-roles">
        <div className="eyebrow" id="me-roles">
          How you use Ember
        </div>
        <div className="segmented" role="radiogroup" aria-labelledby="me-roles" style={{ alignSelf: 'flex-start' }}>
          {roleChoices.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={settings.roles === r.id}
              onClick={() =>
                update((s) => ({
                  roles: r.id,
                  activeRole: r.id === 'both' ? s.activeRole : roleFor(r.id)
                }))
              }
            >
              {r.label}
            </button>
          ))}
        </div>
        {settings.roles !== 'bottom' && (
          <>
            <div className="eyebrow" id="me-depth" style={{ marginTop: 8 }}>
              Depth
            </div>
            <div className="segmented" role="radiogroup" aria-labelledby="me-depth" style={{ alignSelf: 'flex-start' }}>
              {(['simple', 'studio'] as Depth[]).map((d) => (
                <button key={d} type="button" role="radio" aria-checked={settings.depth === d} onClick={() => update({ depth: d })}>
                  {d === 'simple' ? 'Simple' : 'Studio'}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card" aria-label="Privacy">
        <div className="eyebrow">Privacy</div>
        <SettingSwitch
          label="Discreet mode"
          description="Neutral wording inside the app and vague notification text."
          checked={settings.discreet}
          onChange={(discreet) => update({ discreet })}
        />
        <div className="setting">
          <div>
            <div className="setting-label">PIN lock</div>
            <div className="setting-desc">{settings.pin ? 'On. Asked each time Ember opens.' : 'Off'}</div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setSettingPin(true)}>
            {settings.pin ? 'Change' : 'Set PIN'}
          </button>
        </div>
        {settings.pin && (
          <button type="button" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }} onClick={() => update({ pin: null })}>
            Turn off PIN
          </button>
        )}
      </section>

      <section className="card" aria-label="Notifications">
        <div className="eyebrow">Notifications</div>
        <SettingSwitch
          label="Daily tips"
          description="One short note a day."
          checked={settings.notifications.dailyTips}
          onChange={(dailyTips) => update((s) => ({ notifications: { ...s.notifications, dailyTips } }))}
        />
        <SettingSwitch
          label="Check-in reminders"
          description="A reminder about 18 hours after a scene. The check-in itself always stays in the app."
          checked={settings.notifications.checkIns}
          onChange={(checkIns) => update((s) => ({ notifications: { ...s.notifications, checkIns } }))}
        />
        <p className="note">On iPhone, notifications work only after Ember is added to your Home Screen.</p>
      </section>

      <section className="card" aria-label="Your data">
        <div className="eyebrow">Your data</div>
        <button type="button" className="btn btn-outline" onClick={() => setConfirmErase(true)}>
          Erase Ember from this phone
        </button>
      </section>

      <p className="note" style={{ textAlign: 'center' }}>Ember 0.1 · Early preview</p>

      {confirmErase && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="me-erase-title">
          <div className="sheet">
            <h2 id="me-erase-title">Erase everything on this phone?</h2>
            <p>This removes your settings and PIN from this phone and starts Ember over. It can't be undone.</p>
            <button
              type="button"
              className="btn btn-danger btn-block"
              onClick={() => {
                eraseAll();
                window.location.assign('/');
              }}
            >
              Erase and start over
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirmErase(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
