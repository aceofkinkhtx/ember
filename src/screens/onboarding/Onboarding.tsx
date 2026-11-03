import { useState, type ReactNode } from 'react';
import { DepthIcon, RoleIcon } from '../../components/Icons';
import { EmberMark } from '../../components/EmberMark';
import { IdentityForm } from '../../components/IdentityForm';
import { PinSetup } from '../../components/PinSetup';
import { SettingSwitch } from '../../components/Switch';
import { safetyFloor, type RoleChoice } from '../../content/copy';
import { nextStep, onboardingSteps, roleFor, useSettings, type Depth } from '../../state/settings';

// O1 Welcome, About you, O2 Privacy setup, O3 Depth (Tops only), O6 Safety floor.
// O4, O5 and O7 (offerings, settings, toys) arrive with M3.

function About({ progress, onNext }: { progress: ReactNode; onNext: () => void }) {
  const { settings, update } = useSettings();
  return (
    <div className="app">
      <main className="screen">
        {progress}
        <h1>About you</h1>
        <p className="lede">So Ember can talk about you the way you want. Everything here is optional and you can change it anytime in Me.</p>
        <IdentityForm value={settings.identity} onChange={(change) => update((s) => ({ identity: change(s.identity) }))} />
        <p className="note">Your partners see your name and pronouns. You decide who sees your gender identity.</p>
      </main>
      <footer className="screen-footer">
        <button type="button" className="btn btn-primary btn-block" onClick={onNext}>
          Continue
        </button>
      </footer>
    </div>
  );
}

export function Onboarding() {
  const { settings, update } = useSettings();
  const advance = () => update((s) => ({ onboarding: nextStep(s.onboarding, s.roles) }));

  const steps = onboardingSteps(settings.roles);
  const progress = (
    <div className="progress" aria-label={`Step ${steps.indexOf(settings.onboarding) + 1} of ${steps.length}`}>
      {steps.map((s, i) => (
        <span key={s} data-on={i <= steps.indexOf(settings.onboarding)} />
      ))}
    </div>
  );

  switch (settings.onboarding) {
    case 'welcome':
      return <Welcome onNext={advance} />;
    case 'about':
      return <About progress={progress} onNext={advance} />;
    case 'privacy':
      return <Privacy progress={progress} onNext={advance} />;
    case 'depth':
      return <DepthStep progress={progress} onNext={advance} />;
    case 'safety':
      return <SafetyFloor progress={progress} onNext={advance} />;
    default:
      return null;
  }
}

const roleOptions: { id: RoleChoice; word: string; desc: string }[] = [
  { id: 'top', word: 'Top', desc: 'You design and lead scenes.' },
  { id: 'bottom', word: 'bottom', desc: 'You share what you want and own your limits.' },
  { id: 'both', word: 'Both', desc: 'You switch, depending on who you play with.' }
];

function Welcome({ onNext }: { onNext: () => void }) {
  const { settings, update } = useSettings();
  const [roles, setRoles] = useState<RoleChoice | null>(settings.roles);
  const [adult, setAdult] = useState(settings.ageConfirmedAt !== null);

  return (
    <div className="app">
      <main className="screen">
        <div style={{ padding: '24px 0 8px' }}>
          <EmberMark large />
        </div>
        <h1>Scenes designed with care.</h1>
        <p className="lede">Plan from what your partner actually wants, run it with confidence, and look after each other afterward.</p>

        <div className="stack" role="radiogroup" aria-label="How will you use Ember?">
          <div className="eyebrow">How will you use Ember?</div>
          {roleOptions.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={roles === o.id}
              className="choice"
              onClick={() => setRoles(o.id)}
            >
              <span className="choice-icon">
                <RoleIcon kind={o.id} />
              </span>
              <span>
                <span className="choice-word">{o.word}</span>
                <span className="choice-desc" style={{ display: 'block' }}>
                  {o.desc}
                </span>
              </span>
            </button>
          ))}
          <p className="note">You can change this anytime in Me. Roles also belong to each connection, so a switch can Top for one partner and bottom for another.</p>
        </div>
      </main>
      <footer className="screen-footer">
        <label className="check">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
          I'm 18 or older
        </label>
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!roles || !adult}
          onClick={() => {
            if (!roles) return;
            update({
              roles,
              activeRole: roleFor(roles),
              ageConfirmedAt: settings.ageConfirmedAt ?? new Date().toISOString()
            });
            onNext();
          }}
        >
          Continue
        </button>
        {(!roles || !adult) && (
          <p className="note" style={{ textAlign: 'center' }}>
            {!roles ? 'Choose how you will use Ember to continue.' : 'Ember is only for adults 18 and over.'}
          </p>
        )}
      </footer>
    </div>
  );
}

function Privacy({ progress, onNext }: { progress: ReactNode; onNext: () => void }) {
  const { settings, update } = useSettings();
  const [settingPin, setSettingPin] = useState(false);

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

  return (
    <div className="app">
      <main className="screen">
        {progress}
        <h1>Protect Ember first.</h1>
        <p className="lede">Set this up before anything personal goes in.</p>

        <div className="card">
          <SettingSwitch
            label="Discreet mode"
            description="Neutral wording inside the app, and vague notifications such as “Your daily note is ready.”"
            checked={settings.discreet}
            onChange={(discreet) => update({ discreet })}
          />
        </div>

        <div className="card">
          <div className="card-title">PIN lock</div>
          <p className="setting-desc">
            {settings.pin
              ? 'PIN is set. Ember will ask for it each time it opens.'
              : 'Ember asks for a 6-digit PIN each time it opens. Face ID and fingerprint come later.'}
          </p>
          <button type="button" className={settings.pin ? 'btn btn-secondary' : 'btn btn-outline'} onClick={() => setSettingPin(true)}>
            {settings.pin ? 'Change PIN' : 'Set a PIN'}
          </button>
        </div>

        <div className="card card-teal">
          <div className="eyebrow">Our promise</div>
          <p>
            Your answers are yours. No ads, no tracking, and nothing is sold or shared. Sensitive details are encrypted on
            your phone before they leave it, and you decide which partners see what.
          </p>
        </div>
      </main>
      <footer className="screen-footer">
        <button type="button" className="btn btn-primary btn-block" onClick={onNext}>
          {settings.pin ? 'Continue' : 'Continue without a PIN'}
        </button>
      </footer>
    </div>
  );
}

const depthOptions: { id: Depth; word: string; desc: string }[] = [
  { id: 'simple', word: 'Simple', desc: 'Guided steps, automatic designs and a smaller set of choices. Great for starting out.' },
  { id: 'studio', word: 'Studio', desc: 'The full toolset for experienced Tops: more categories, the full toy directory and advanced options.' }
];

function DepthStep({ progress, onNext }: { progress: ReactNode; onNext: () => void }) {
  const { settings, update } = useSettings();
  return (
    <div className="app">
      <main className="screen">
        {progress}
        <h1>How much do you want to see?</h1>
        <p className="lede">Nothing you build is lost if you switch. Change it anytime in Me.</p>
        <div className="stack" role="radiogroup" aria-label="Depth">
          {depthOptions.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={settings.depth === o.id}
              className="choice"
              onClick={() => update({ depth: o.id })}
            >
              <span className="choice-icon">
                <DepthIcon kind={o.id} />
              </span>
              <span>
                <span className="choice-word">{o.word}</span>
                <span className="choice-desc" style={{ display: 'block' }}>
                  {o.desc}
                </span>
              </span>
            </button>
          ))}
        </div>
      </main>
      <footer className="screen-footer">
        <button type="button" className="btn btn-primary btn-block" onClick={onNext}>
          Continue
        </button>
      </footer>
    </div>
  );
}

function SafetyFloor({ progress, onNext }: { progress: ReactNode; onNext: () => void }) {
  const { update } = useSettings();
  return (
    <div className="app">
      <main className="screen">
        {progress}
        <h1>Some things never change.</h1>
        <p className="lede">Almost everything in Ember can be customized. These six protections can't be turned off by anyone.</p>
        <ol className="floor-list">
          {safetyFloor.map((item, i) => (
            <li key={item.title}>
              <span className="floor-num" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <strong>{item.title}</strong>
                <span className="choice-desc" style={{ display: 'block' }}>
                  {item.detail}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </main>
      <footer className="screen-footer">
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => {
            update({ safetyFloorAcknowledgedAt: new Date().toISOString() });
            onNext();
          }}
        >
          I understand
        </button>
      </footer>
    </div>
  );
}
