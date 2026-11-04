import { useState } from 'react';
import { defaultPhaseColors, phaseColors, phaseLabels, type PhaseType } from '../../content/phases';
import { aftercare } from '../../content/topDefaults';
import {
  AFTERCARE_RANGE,
  cadenceLabels,
  clampSettings,
  startingSettings,
  type CheckInCadence,
  type TopSettings
} from '../../content/topSetup';
import { Segments, TextInput } from '../intake/Bits';
import { SettingSwitch } from '../Switch';
import { whiteTextContrast } from '../../content/contrast';

// O5 and Me > Top settings: the Top's personal standards. Default settings
// (A.C.E.'s values) are one tap away as a starting point. The safety floor still applies whatever is
// chosen here: every scene has aftercare, and an intense scene gets at least
// 30 minutes of it.

const cadences = (Object.keys(cadenceLabels) as CheckInCadence[]).map((id) => ({ id, label: cadenceLabels[id] }));

export function TopSettingsEditor({ value, onChange }: { value: TopSettings; onChange: (change: (s: TopSettings) => TopSettings) => void }) {
  const set = (patch: Partial<TopSettings>) => onChange((s) => clampSettings({ ...s, ...patch }));
  const [colorError, setColorError] = useState('');
  const colors = phaseColors(value.phaseColors);

  function setColor(phase: PhaseType, color: string) {
    if (whiteTextContrast(color) < 4.5) {
      setColorError(`That color is too light for white text on the ${phaseLabels[phase]} phase. Try a darker one.`);
      return;
    }
    setColorError('');
    onChange((s) => ({ ...s, phaseColors: { ...s.phaseColors, [phase]: color } }));
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <section className="card stack" style={{ gap: 10 }}>
        <div className="eyebrow">A ready-made start</div>
        <p className="setting-desc" style={{ margin: 0 }}>
          Aftercare at 25% of scene length (33% for intense scenes), check-ins twice a week, and a direct, warm, unhurried voice. Change
          anything afterward. Your sex acts choice stays as you set it.
        </p>
        <button type="button" className="btn btn-outline" style={{ alignSelf: 'flex-start' }} onClick={() => set(startingSettings())}>
          Default settings
        </button>
      </section>

      <section className="card stack" style={{ gap: 14 }} aria-label="Aftercare">
        <div className="eyebrow">Aftercare</div>
        <Percent label="Regular scenes" value={value.aftercarePercent} onChange={(aftercarePercent) => set({ aftercarePercent })} />
        <Percent label="Intense scenes" value={value.intensePercent} onChange={(intensePercent) => set({ intensePercent })} />
        <p className="note" style={{ margin: 0 }}>
          A share of the scene's length. An intense scene always gets at least {aftercare.intenseMinimumMinutes} minutes, and "more if
          needed" is always there.
        </p>
      </section>

      <section className="card stack" style={{ gap: 12 }} aria-label="Check-ins">
        <div className="eyebrow">Between scenes</div>
        <Segments label="Check-ins with each partner" options={cadences} value={value.checkIns} onChange={(checkIns) => set({ checkIns })} />
        <p className="note" style={{ margin: 0 }}>
          These are your own extra check-ins. The after-scene check-ins for you both always happen.
        </p>
      </section>

      <section className="card stack" style={{ gap: 12 }} aria-label="Your voice">
        <div className="eyebrow">Your voice</div>
        <TextInput
          label="How you speak, in a few words"
          hint="Used to suggest SAY lines and check-in messages. For example: playful, steady, few words."
          value={value.voice}
          max={120}
          onChange={(voice) => set({ voice })}
        />
      </section>

      <section className="card stack" style={{ gap: 12 }} aria-label="Sex acts">
        <SettingSwitch
          label="Penile or oral sex can appear in my scenes"
          description="Off unless you turn it on. Even then, it is only included when negotiated for that scene."
          checked={value.allowNegotiatedSex}
          onChange={(allowNegotiatedSex) => set({ allowNegotiatedSex })}
        />
      </section>

      <details className="card">
        <summary className="card-title" style={{ cursor: 'pointer', minHeight: 'var(--touch)', display: 'flex', alignItems: 'center' }}>
          Phase colors
        </summary>
        <div className="stack" style={{ gap: 8, marginTop: 8 }}>
          {(Object.keys(defaultPhaseColors) as PhaseType[]).map((phase) => (
            <label key={phase} className="person" style={{ gap: 12 }}>
              <span
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, background: colors[phase], color: '#fff', fontWeight: 600 }}
              >
                {phaseLabels[phase]}
              </span>
              <input
                type="color"
                value={colors[phase]}
                aria-label={`${phaseLabels[phase]} color`}
                onChange={(e) => setColor(phase, e.target.value)}
                style={{ width: 48, height: 44, border: 'none', background: 'none' }}
              />
            </label>
          ))}
          {colorError && (
            <p className="note error" role="alert">
              {colorError}
            </p>
          )}
          <button
            type="button"
            className="btn btn-quiet"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => {
              setColorError('');
              onChange((s) => ({ ...s, phaseColors: {} }));
            }}
          >
            Back to the default colors
          </button>
        </div>
      </details>
    </div>
  );
}

function Percent({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="field">
      <span className="field-label" style={{ fontSize: 16 }}>
        {label}: <strong>{value}%</strong>
      </span>
      <input
        type="range"
        min={AFTERCARE_RANGE.min}
        max={AFTERCARE_RANGE.max}
        step={1}
        value={value}
        aria-valuetext={`${value} percent`}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
