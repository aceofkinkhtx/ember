import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { DonateOptions } from '../components/DonateOptions';
import { AvatarEditor } from '../components/Avatar';
import { IdentityForm } from '../components/IdentityForm';
import { PinSetup } from '../components/PinSetup';
import { SettingSwitch } from '../components/Switch';
import { roleLabel, type RoleChoice } from '../content/copy';
import { pronounLabel } from '../content/identity';
import { cadenceLabels, offeringsSummary } from '../content/topSetup';
import { AccountError, changePassword, MIN_PASSWORD, signOut } from '../lib/account';
import { biometricAvailable, setUpBiometric } from '../lib/biometric';
import { collectMyData, deleteMyAccount, exportFileName, saveFile } from '../lib/myData';
import { anyAlerts, pushState, setPushWants, turnOffPush, turnOnPush, type PushState, type PushWants } from '../lib/push';
import { eraseAll } from '../lib/storage';
import { useAccount } from '../state/account';
import { roleFor, useSettings, type Settings } from '../state/settings';

// M1 (Top) and BM1 (bottom): settings for this device.

export function Me() {
  const { settings, update } = useSettings();
  const [settingPin, setSettingPin] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  // Changing a notification setting also updates this phone's alerts, if they're on.
  const setNotes = (patch: Partial<Settings['notifications']>) => {
    const notifications = { ...settings.notifications, ...patch };
    update({ notifications });
    void setPushWants(pushWantsFrom(notifications));
  };

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

      <Link to="/me/feedback" className="card setting" style={{ color: 'inherit', textDecoration: 'none' }}>
        <div>
          <div className="setting-label">Beta feedback</div>
          <div className="setting-desc">Tell Michael how each part works for you, or report a problem.</div>
        </div>
        <span aria-hidden="true">›</span>
      </Link>

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
        {settings.pin && <BiometricSetting />}
        {settings.pin && (
          <button type="button" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }} onClick={() => update({ pin: null, biometric: null })}>
            Turn off PIN
          </button>
        )}
      </section>

      <section className="card" aria-label="Notifications">
        <div className="eyebrow">Notifications</div>
        <SettingSwitch
          label="Daily tips"
          description={`One short note a day on Home, for the role you're in.${settings.roles === 'both' ? ' Tops and bottoms each have their own.' : ''}`}
          checked={settings.notifications.dailyTips}
          onChange={(dailyTips) => setNotes({ dailyTips })}
        />
        {settings.notifications.dailyTips && (
          <label className="field" style={{ paddingBottom: 8 }}>
            <span className="field-label">Daily note alert time</span>
            <span className="field-hint">When phone alerts are on, a note at this time says only "Your daily note is ready".</span>
            <input
              className="input"
              type="time"
              style={{ maxWidth: 160 }}
              value={settings.notifications.tipTime}
              onChange={(e) => e.target.value && setNotes({ tipTime: e.target.value })}
            />
          </label>
        )}
        <SettingSwitch
          label="Check-in reminders"
          description="Right after a scene, a few hours later, and once a day for 3 days. The check-in itself always stays in the app."
          checked={settings.notifications.checkIns}
          onChange={(checkIns) => setNotes({ checkIns })}
        />
        <SettingSwitch
          label="Message alerts"
          description="When someone you're connected to sends a message."
          checked={settings.notifications.messages}
          onChange={(messages) => setNotes({ messages })}
        />
        <PhoneAlerts wants={pushWantsFrom(settings.notifications)} />
      </section>

      <AccountSection />

      <section className="card" aria-label="Your data">
        <div className="eyebrow">Your data</div>
        <MyDataActions />
        <button type="button" className="btn btn-outline" onClick={() => setConfirmErase(true)}>
          Erase Ember from this phone
        </button>
        <p className="setting-desc" style={{ margin: 0 }}>
          Erasing this phone keeps your account. Sign in again and your locked data comes back.
        </p>
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
      <ChangePassword />
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

/**
 * Phone alerts (M7). Asking for permission needs a tap, so it's a button. The
 * alert text is always generic, and it passes through the phone maker's push
 * service; the check-ins and messages stay in Ember.
 */
const pushWantsFrom = (n: Settings['notifications']): PushWants => ({ checkins: n.checkIns, messages: n.messages, tips: n.dailyTips, tipTime: n.tipTime });

function PhoneAlerts({ wants }: { wants: PushWants }) {
  const { status } = useAccount();
  const [state, setState] = useState<PushState | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void pushState().then(setState);
  }, []);
  if (status !== 'signed-in' || state === null) return null;
  const text: Record<PushState, string> = {
    unsupported: "This browser can't show Ember's alerts. Check-ins still wait on Home.",
    'needs-install': 'On iPhone, add Ember to your Home Screen first (Share, then Add to Home Screen), then turn alerts on from there.',
    blocked: 'Alerts are blocked for Ember in your phone settings. Allow notifications for Ember there to turn them on.',
    off: 'Alerts are off on this phone. Check-ins still wait on Home.',
    on: 'Alerts are on for this phone. They only ever say "A check-in is waiting", "You have a new message" or "Your daily note is ready", never names or details.'
  };
  return (
    <div className="stack" style={{ gap: 8, paddingTop: 8 }}>
      <p className="note" style={{ margin: 0 }}>
        {text[state]}
      </p>
      {state === 'off' && anyAlerts(wants) && (
        <button
          type="button"
          className="btn btn-outline"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            setError('');
            turnOnPush(wants).then(setState, (e) => setError(e instanceof Error ? e.message : "Ember couldn't turn on alerts."));
          }}
        >
          Turn on alerts on this phone
        </button>
      )}
      {state === 'on' && (
        <button type="button" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }} onClick={() => void turnOffPush().then(() => setState('off'))}>
          Turn off alerts on this phone
        </button>
      )}
      {error && (
        <p className="note error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Face or fingerprint unlock (M9). Shown only with a PIN, which always still works. */
function BiometricSetting() {
  const { settings, update } = useSettings();
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    void biometricAvailable().then(setAvailable);
  }, []);
  if (!available) return null;
  return (
    <>
      <SettingSwitch
        label="Face ID or fingerprint"
        description="Unlock with your face or finger instead of typing the PIN. It stays on this phone, and the PIN always still works."
        checked={settings.biometric !== null}
        onChange={(on) => {
          setError('');
          if (!on) return update({ biometric: null });
          setUpBiometric().then(
            (biometric) => update({ biometric }),
            () => setError("Ember couldn't set that up. You can keep using your PIN.")
          );
        }}
      />
      {error && (
        <p className="note error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </>
  );
}

function ChangePassword() {
  const { keys, email } = useAccount();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  if (!keys || !email) return null;

  const problem = !current
    ? 'Enter your current password.'
    : next.length < MIN_PASSWORD
      ? `Your new password needs at least ${MIN_PASSWORD} characters.`
      : confirm !== next
        ? "The two new passwords don't match yet."
        : '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (problem || busy || !keys || !email) return;
    setBusy(true);
    setError('');
    try {
      await changePassword(keys, email, current, next);
      setDone(true);
      setOpen(false);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Ember couldn't change your password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <>
        {done && (
          <p className="note" role="status" style={{ margin: 0 }}>
            Your password was changed. Use the new one next time you sign in. Your recovery code stays the same.
          </p>
        )}
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => {
            setOpen(true);
            setDone(false);
          }}
        >
          Change password
        </button>
      </>
    );
  }

  return (
    <form className="stack" style={{ gap: 12 }} onSubmit={submit} noValidate>
      <label className="field">
        <span className="field-label">Current password</span>
        <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">New password</span>
        <span className="field-hint">At least {MIN_PASSWORD} characters.</span>
        <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">New password again</span>
        <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      {error && (
        <p className="note error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={Boolean(problem) || busy}>
        {busy ? 'Changing...' : 'Change my password'}
      </button>
      {problem && (current || next) && (
        <p className="note" style={{ margin: 0 }}>
          {problem}
        </p>
      )}
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}

/** Download my data and delete my account (M9). Needs an account. */
function MyDataActions() {
  const account = useAccount();
  const { settings } = useSettings();
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  if (account.status !== 'signed-in' || !account.keys) return null;
  const keys = account.keys;

  async function download() {
    setError('');
    setStep('Starting');
    try {
      saveFile(await collectMyData(keys, settings, setStep), exportFileName());
    } catch {
      setError("Ember couldn't gather everything. Please try again.");
    } finally {
      setStep('');
    }
  }

  return (
    <>
      <button type="button" className="btn btn-outline" disabled={Boolean(step)} onClick={() => void download()}>
        {step ? `Gathering: ${step}...` : 'Download my data'}
      </button>
      <p className="setting-desc" style={{ margin: 0 }}>
        Unlocks everything you can read here (your profile, gear and photos, scenes, connections, messages and check-ins) and saves it as one file on
        this phone. The file isn't locked, so keep it somewhere private.
      </p>
      {error && (
        <p className="note error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
      <button type="button" className="btn btn-danger" onClick={() => setDeleting(true)}>
        Delete my account
      </button>
      {deleting && <DeleteAccountSheet onClose={() => setDeleting(false)} onDelete={() => deleteMyAccount(keys)} />}
    </>
  );
}

function DeleteAccountSheet({ onClose, onDelete }: { onClose: () => void; onDelete: () => Promise<void> }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = typed.trim().toUpperCase() === 'DELETE';
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="me-delete-title">
      <div className="sheet stack" style={{ gap: 12 }}>
        <h2 id="me-delete-title" style={{ margin: 0 }}>
          Delete your account?
        </h2>
        <p style={{ margin: 0 }}>This can't be undone. Ember deletes, for good:</p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>your profile and every version of it, your gear and photos, and your scenes;</li>
          <li>your connections, and what you shared with them;</li>
          <li>your check-ins, debriefs and messages, on both sides.</li>
        </ul>
        <p style={{ margin: 0 }}>The people you're connected to won't be told; you'll just disappear from their connections. Download your data first if you want a copy.</p>
        <label className="field">
          <span className="field-label">Type DELETE to confirm</span>
          <input className="input" value={typed} autoCapitalize="characters" autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
        </label>
        {error && (
          <p className="note error" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        )}
        <button
          type="button"
          className="btn btn-danger btn-block"
          disabled={!ready || busy}
          onClick={() => {
            setBusy(true);
            setError('');
            onDelete().then(
              () => window.location.assign('/'),
              (e) => {
                setError(e instanceof AccountError ? e.message : "Ember couldn't delete your account. Please try again.");
                setBusy(false);
              }
            );
          }}
        >
          {busy ? 'Deleting...' : 'Delete my account for good'}
        </button>
        <button type="button" className="btn btn-secondary btn-block" disabled={busy} onClick={onClose}>
          Keep my account
        </button>
      </div>
    </div>
  );
}
