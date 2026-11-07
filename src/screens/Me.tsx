import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DonateOptions } from '../components/DonateOptions';
import { AvatarEditor } from '../components/Avatar';
import { IdentityForm } from '../components/IdentityForm';
import { PinSetup } from '../components/PinSetup';
import { SettingSwitch } from '../components/Switch';
import { roleLabel, type RoleChoice } from '../content/copy';
import { pronounLabel } from '../content/identity';
import { cadenceLabels, offeringsSummary } from '../content/topSetup';
import { signOut } from '../lib/account';
import { eraseAll } from '../lib/storage';
import { useAccount } from '../state/account';
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
      <AvatarEditor />

      <details className="card">
        <summary className="card-title" style={{ cursor: 'pointer', minHeight: 'var(--touch)', display: 'flex', alignItems: 'center' }}>
          About you
          {settings.identity.name || pronounLabel(settings.identity)
            ? `: ${[settings.identity.name, pronounLabel(settings.identity)].filter(Boolean).join(', ')}`
            : ''}
        </summary>
        <IdentityForm value={settings.identity} onChange={(change) => update((s) => ({ identity: change(s.identity) }))} />
      </details>

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
            <div className="stack" style={{ gap: 6 }}>
              <p className="setting-desc" style={{ margin: 0 }}>
                <strong>Simple:</strong> designs built for you from what they said yes to, the full editor, gear, Live Scene Mode and every safety rule. Edge play stays out.
              </p>
              <p className="setting-desc" style={{ margin: 0 }}>
                <strong>Studio:</strong> everything in Simple, plus edge play (choking, knife play, sharps and plastic wrap mummification). Each one is added only after you confirm it was negotiated for that scene, and the same safety rules apply.
              </p>
            </div>
          </>
        )}
      </section>

      {settings.roles !== 'bottom' && (
        <section className="card" aria-labelledby="me-top">
          <div className="eyebrow" id="me-top">
            As a Top
          </div>
          <Link to="/me/offerings" className="setting" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div>
              <div className="setting-label">What you offer</div>
              <div className="setting-desc">{offeringsSummary(settings.top)}</div>
            </div>
            <span aria-hidden="true">›</span>
          </Link>
          <Link to="/me/top-settings" className="setting" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div>
              <div className="setting-label">Your settings</div>
              <div className="setting-desc">
                Aftercare {settings.top.settings.aftercarePercent}% ({settings.top.settings.intensePercent}% intense), check-ins:{' '}
                {cadenceLabels[settings.top.settings.checkIns].toLowerCase()}
              </div>
            </div>
            <span aria-hidden="true">›</span>
          </Link>
        </section>
      )}

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

      <AccountSection />

      <section className="card" aria-label="Your data">
        <div className="eyebrow">Your data</div>
        <button type="button" className="btn btn-outline" onClick={() => setConfirmErase(true)}>
          Erase Ember from this phone
        </button>
      </section>

      <section className="card" aria-label="Support Ember">
        <div className="eyebrow">Support Ember</div>
        <p className="setting-desc">Ember is free and runs on donations. Any amount helps keep it that way.</p>
        <DonateOptions />
      </section>

      <p className="note" style={{ textAlign: 'center' }}>Ember 0.1 · Early preview</p>

      {confirmErase && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="me-erase-title">
          <div className="sheet">
            <h2 id="me-erase-title">Erase everything on this phone?</h2>
            <p>This removes your settings, PIN and keys from this phone and starts Ember over. If you have an account, you can sign in again afterward and your locked data comes back.</p>
            <button
              type="button"
              className="btn btn-danger btn-block"
              onClick={() => {
                void signOut().finally(() => {
                  eraseAll();
                  window.location.assign('/');
                });
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

function AccountSection() {
  const account = useAccount();
  if (account.status !== 'signed-in') return null;
  return (
    <section className="card" aria-label="Account">
      <div className="eyebrow">Account</div>
      <p className="setting-desc">Signed in as {account.email}</p>
      <button
        type="button"
        className="btn btn-outline"
        onClick={async () => {
          await signOut();
          await account.refresh();
        }}
      >
        Sign out on this phone
      </button>
    </section>
  );
}
