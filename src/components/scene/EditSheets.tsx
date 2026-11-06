import { useState, type ReactNode } from 'react';
import { phaseLabels } from '../../content/phases';
import { impactAreas, impactPositions } from '../../data/activities';
import type { Beat, Flag, FlagKind, Override, Phase, Scene, Step } from '../../lib/scene/model';
import { MiniCurve, PhaseStrip } from './SceneCurve';
import { activityOf, type RuleContext } from '../../lib/scene/rules';
import type { Toy } from '../../lib/toys';
import { useAccount } from '../../state/account';
import { TextArea, TextInput } from '../intake/Bits';
import { ActivityList, ActivityTag, useAddActivity } from './ActivityPicker';

// The edit sheet (S5): one sheet for a beat, one for a step. Saving runs the
// rules; a change that breaks a block rule is refused with a one-line reason
// and the sheet stays open.

const flagKinds: { id: FlagKind; label: string }[] = [
  { id: 'warning', label: 'Warning' },
  { id: 'info', label: 'Info' },
  { id: 'watch', label: 'Watch' },
  { id: 'partner', label: 'Partner' }
];

const riskTag = { low: 'Low risk', moderate: 'Moderate risk', high: 'High risk' };

/** The scene map as it would look after this edit, updated as you change it. */
function LiveMap({ scene }: { scene: Scene }) {
  return (
    <div className="stack" style={{ gap: 4 }} aria-hidden="true">
      <MiniCurve scene={scene} height={48} />
      <PhaseStrip scene={scene} />
    </div>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="sheet" style={{ maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="person">
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function BeatSheet({
  beat,
  phaseId,
  phases,
  automatic,
  onSave,
  preview,
  onDelete,
  onClose
}: {
  beat: Beat;
  phaseId: string;
  phases: Phase[];
  automatic: Flag[];
  /** Returns a reason when the rules refuse the change. */
  onSave: (beat: Beat, toPhase: string) => string | null;
  preview?: (beat: Beat, toPhase: string) => Scene;
  onDelete: () => string | null;
  onClose: () => void;
}) {
  const [b, setB] = useState<Beat>(beat);
  const [toPhase, setToPhase] = useState(phaseId);
  const [refused, setRefused] = useState('');
  const [newFlag, setNewFlag] = useState<{ kind: FlagKind; text: string }>({ kind: 'info', text: '' });
  const set = (patch: Partial<Beat>) => setB((x) => ({ ...x, ...patch }));
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <Sheet title={beat.title || 'Beat'} onClose={onClose}>
      {preview && <LiveMap scene={preview(b, toPhase)} />}
      <TextInput label="Goal, in one line" value={b.title} max={80} onChange={(title) => set({ title })} />
      <div style={{ display: 'flex', gap: 10 }}>
        <label className="field" style={{ flex: 1 }}>
          <span className="field-label">Minutes</span>
          <input className="input" type="number" inputMode="numeric" min={1} max={480} value={b.minutes} onChange={(e) => set({ minutes: Math.max(1, Math.min(480, Number(e.target.value) || 1)) })} />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span className="field-label">Phase</span>
          <select className="input" value={toPhase} onChange={(e) => setToPhase(e.target.value)}>
            {phases.map((p, i) => (
              <option key={p.id} value={p.id}>
                {i + 1}. {phaseLabels[p.type]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span className="field-label">
          Intensity: <strong>{b.intensity}</strong> of 10
        </span>
        <input type="range" min={1} max={10} step={1} value={b.intensity} onChange={(e) => set({ intensity: Number(e.target.value) })} />
      </label>

      <fieldset className="field">
        <legend className="field-label">Body areas</legend>
        <span className="field-hint">Risk is shown on each. The kidneys are never a target.</span>
        <div className="chips">
          {impactAreas.map((a) => (
            <button key={a.id} type="button" className="chip" aria-pressed={b.areas.includes(a.id)} onClick={() => set({ areas: toggle(b.areas, a.id) })}>
              {a.label} <span className="note">({riskTag[a.risk].toLowerCase()})</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend className="field-label">Positions</legend>
        <div className="chips">
          {impactPositions.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={b.positions.includes(p.id)} onClick={() => set({ positions: toggle(b.positions, p.id) })}>
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="stack" style={{ gap: 8 }}>
        <span className="field-label">Flags</span>
        {automatic.map((f, i) => (
          <p key={`auto-${i}`} className={`box box-${f.kind}`}>
            {f.text} <span style={{ opacity: 0.8 }}>(automatic)</span>
          </p>
        ))}
        {b.flags.map((f, i) => (
          <div key={i} className="person">
            <p className={`box box-${f.kind}`} style={{ flex: 1 }}>
              {f.text}
            </p>
            <button type="button" className="btn btn-quiet" aria-label={`Remove flag: ${f.text}`} onClick={() => set({ flags: b.flags.filter((_, k) => k !== i) })}>
              Remove
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="input" aria-label="Flag type" value={newFlag.kind} onChange={(e) => setNewFlag({ ...newFlag, kind: e.target.value as FlagKind })} style={{ flex: '0 0 auto' }}>
            {flagKinds.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          <input className="input" aria-label="Flag text" maxLength={160} value={newFlag.text} onChange={(e) => setNewFlag({ ...newFlag, text: e.target.value })} style={{ flex: 1, minWidth: 140 }} />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!newFlag.text.trim()}
            onClick={() => {
              set({ flags: [...b.flags, { kind: newFlag.kind, text: newFlag.text.trim(), urgent: newFlag.kind === 'warning' }] });
              setNewFlag({ ...newFlag, text: '' });
            }}
          >
            Add flag
          </button>
        </div>
      </div>

      {refused && (
        <p className="box box-block" role="alert">
          {refused}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => {
          const reason = onSave(b, toPhase);
          if (reason) setRefused(reason);
          else onClose();
        }}
      >
        Save beat
      </button>
      <button
        type="button"
        className="btn btn-outline btn-block"
        onClick={() => {
          const reason = onDelete();
          if (reason) setRefused(reason);
          else onClose();
        }}
      >
        Delete beat
      </button>
    </Sheet>
  );
}

export function StepSheet({
  step,
  beatId,
  phases,
  ctx,
  gear,
  onSave,
  onDelete,
  onClose
}: {
  step: Step;
  beatId: string;
  phases: Phase[];
  ctx: RuleContext;
  gear: Toy[];
  onSave: (step: Step, overrides: Override[], toBeatId: string) => string | null;
  onDelete: () => string | null;
  onClose: () => void;
}) {
  const [s, setS] = useState<Step>(step);
  const [toBeat, setToBeat] = useState(beatId);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [refused, setRefused] = useState('');
  const set = (patch: Partial<Step>) => setS((x) => ({ ...x, ...patch }));
  const activity = activityOf(ctx, s.activityId);
  const add = useAddActivity(ctx, (a, more) => {
    set({ activityId: a.id });
    setOverrides((o) => [...o, ...more]);
    setChoosing(false);
  });
  const { keys } = useAccount();
  const usable = gear.filter((g) => !ctx.optedOutGear.includes(g.id) || g.id === s.gearId);

  return (
    <Sheet title={activity?.label ?? 'Step'} onClose={onClose}>
      <div className="stack" style={{ gap: 6 }}>
        <span className="field-label">Activity</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700 }}>{activity ? activity.label : 'None (a care or connection step)'}</span>
          {activity && <ActivityTag ctx={ctx} activity={activity} />}
          <button type="button" className="btn btn-quiet" onClick={() => setChoosing((c) => !c)}>
            {choosing ? 'Cancel' : 'Change'}
          </button>
          {activity && (
            <button type="button" className="btn btn-quiet" onClick={() => set({ activityId: null })}>
              Clear
            </button>
          )}
        </div>
        {choosing && <ActivityList ctx={ctx} exclude={s.activityId ? [s.activityId] : []} onChoose={add.start} />}
        {add.refused && (
          <p className="box box-block" role="alert">
            {add.refused}
          </p>
        )}
      </div>
      {usable.length > 0 && (
        <label className="field">
          <span className="field-label">Gear</span>
          <select className="input" value={s.gearId ?? ''} onChange={(e) => set({ gearId: e.target.value || null })}>
            <option value="">None</option>
            {usable.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.ownerId !== keys?.userId ? ' (theirs)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span className="field-label">In which beat</span>
        <span className="field-hint">Move this step anywhere in the scene.</span>
        <select className="input" value={toBeat} onChange={(e) => setToBeat(e.target.value)}>
          {phases.map((p) =>
            p.beats.map((b) => (
              <option key={b.id} value={b.id}>
                {phaseLabels[p.type]}: {b.title || 'Untitled beat'}
              </option>
            ))
          )}
        </select>
      </label>
      <TextArea label="DO" hint="What you do." value={s.do} rows={3} max={600} onChange={(v) => set({ do: v })} />
      <TextArea label="SAY" hint="Words to say, in your voice." value={s.say} rows={2} max={400} onChange={(v) => set({ say: v })} />
      <TextArea label="WATCH" hint="Signals to look for, beyond the core watch list." value={s.watch} rows={2} max={400} onChange={(v) => set({ watch: v })} />
      <TextArea label="NOTES" value={s.notes} rows={2} max={600} onChange={(v) => set({ notes: v })} />
      <label className="check" style={{ minHeight: 0 }}>
        <input type="checkbox" checked={s.surprise} onChange={(e) => set({ surprise: e.target.checked })} />
        Surprise (their preview shows a surprise, not what it is)
      </label>
      {add.sheet}
      {refused && (
        <p className="box box-block" role="alert">
          {refused}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => {
          const reason = onSave(s, overrides, toBeat);
          if (reason) setRefused(reason);
          else onClose();
        }}
      >
        Save step
      </button>
      <button
        type="button"
        className="btn btn-outline btn-block"
        onClick={() => {
          const reason = onDelete();
          if (reason) setRefused(reason);
          else onClose();
        }}
      >
        Delete step
      </button>
    </Sheet>
  );
}

/** Set a length in minutes: a whole section, or the scene's play time. */
export function MinutesSheet({
  title,
  hint,
  value,
  min,
  max,
  onSave,
  preview,
  onClose
}: {
  title: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onSave: (minutes: number) => string | null;
  preview?: (minutes: number) => Scene;
  onClose: () => void;
}) {
  const [minutes, setMinutes] = useState(value);
  const [refused, setRefused] = useState('');
  const label = `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} h ` : ''}${minutes % 60 ? `${minutes % 60} min` : ''}`.trim() || '0 min';
  return (
    <Sheet title={title} onClose={onClose}>
      {preview && <LiveMap scene={preview(minutes)} />}
      <p className="note" style={{ margin: 0 }}>
        {hint}
      </p>
      <label className="field">
        <span className="field-label">
          Length: <strong>{label}</strong>
        </span>
        <input type="range" min={min} max={max} step={1} value={minutes} aria-valuetext={label} onChange={(e) => setMinutes(Number(e.target.value))} />
      </label>
      <label className="field">
        <span className="field-label">Or type minutes</span>
        <input
          className="input"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={minutes}
          onChange={(e) => setMinutes(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        />
      </label>
      {refused && (
        <p className="box box-block" role="alert">
          {refused}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => {
          const reason = onSave(minutes);
          if (reason) setRefused(reason);
          else onClose();
        }}
      >
        Save
      </button>
    </Sheet>
  );
}
