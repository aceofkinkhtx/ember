import { useState } from 'react';
import { checkInQuestions } from '../../content/checkins';
import { bottomCheckMissing, emptyBottomCheck, readinessIngredients, type BottomCheck, type MaybeAnswer } from '../../lib/scene/live';
import { Chips, Segments, TextArea } from '../intake/Bits';

// The bottom's part of the pre-scene check (M6): how they are today, every
// maybe in the plan answered yes, no or "let's talk", and their readiness.
// Used on the bottom's own phone, or on the Top's phone handed over.

const five = ['1', '2', '3', '4', '5'].map((id) => ({ id, label: id }));

function Scale({ label, low, high, value, onChange }: { label: string; low: string; high: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="stack" style={{ gap: 2 }}>
      <Segments label={label} options={five} value={value ? String(value) : null} onChange={(v) => onChange(Number(v))} />
      <span className="note">
        1 is {low.toLowerCase()}, 5 is {high.toLowerCase()}
      </span>
    </div>
  );
}

const maybeOptions: { id: MaybeAnswer; label: string }[] = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
  { id: 'talk', label: "Let's talk" }
];

export function BottomCheckForm({
  topName,
  maybes,
  onTopPhone = false,
  onSend
}: {
  topName: string;
  maybes: { activityId: string; label: string }[];
  onTopPhone?: boolean;
  /** Returns an error message, or null when sent. */
  onSend: (check: BottomCheck) => Promise<string | null>;
}) {
  const [c, setC] = useState<BottomCheck>(emptyBottomCheck());
  const [negotiated, setNegotiated] = useState<'yes' | 'no' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<BottomCheck>) => setC((x) => ({ ...x, ...patch }));
  const [feeling, negotiation, excitement] = checkInQuestions('pre', 'bottom');
  const missing = [...bottomCheckMissing(c, maybes), ...(negotiated ? [] : ['the final negotiation question'])];

  return (
    <div className="stack" style={{ gap: 18 }}>
      {maybes.length > 0 && (
        <section className="card stack" style={{ gap: 12 }} aria-label="Maybes in the plan">
          <div className="eyebrow">Maybes in the plan</div>
          <p className="setting-desc" style={{ margin: 0 }}>
            {topName} included {maybes.length === 1 ? 'something you marked maybe or didn\'t answer' : `${maybes.length} things you marked maybe or didn't answer`}. Each one needs your answer before the scene. A no takes it out of the plan.
          </p>
          {maybes.map((m) => (
            <Segments key={m.activityId} label={m.label} options={maybeOptions} value={c.maybes[m.activityId]} onChange={(a) => set({ maybes: { ...c.maybes, [m.activityId]: a } })} />
          ))}
        </section>
      )}

      <section className="card stack" style={{ gap: 14 }} aria-label="How you are today">
        <div className="eyebrow">How you are today</div>
        {feeling.kind === 'scale' && <Scale label={feeling.prompt} low={feeling.low} high={feeling.high} value={c.feeling} onChange={(feeling) => set({ feeling })} />}
        <Scale label="How does your body feel today?" low="Sore or tired" high="Great" value={c.body} onChange={(body) => set({ body })} />
        <TextArea label="Anything sore, new or to avoid today? (optional)" rows={2} max={300} value={c.bodyNote} onChange={(bodyNote) => set({ bodyNote })} />
        <Scale label="How are you feeling emotionally, going in?" low="Heavy" high="Light and ready" value={c.emotion} onChange={(emotion) => set({ emotion })} />
        <TextArea label="Anything on your mind? (optional)" rows={2} max={300} value={c.emotionNote} onChange={(emotionNote) => set({ emotionNote })} />
        {excitement.kind === 'scale' && <Scale label={excitement.prompt} low={excitement.low} high={excitement.high} value={c.excitement} onChange={(excitement) => set({ excitement })} />}
      </section>

      <section className="card stack" style={{ gap: 14 }} aria-label="Since you last talked">
        <Segments label={negotiation.prompt} options={[{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }]} value={negotiated} onChange={(v) => { setNegotiated(v); set({ finalNegotiation: v === 'yes' }); }} />
        <Segments label="Anything new since you last talked about this scene?" options={[{ id: 'no', label: 'No' }, { id: 'yes', label: 'Yes' }]} value={c.anythingNew ? 'yes' : 'no'} onChange={(v) => set({ anythingNew: v === 'yes' })} />
        {c.anythingNew && <TextArea label="What's new?" rows={2} max={500} value={c.newNote} onChange={(newNote) => set({ newNote })} />}
        <label className="choice" style={{ alignItems: 'center' }}>
          <input type="checkbox" checked={c.substanceToday} onChange={(e) => set({ substanceToday: e.target.checked })} style={{ width: 22, height: 22 }} />
          <span>I'm keeping to our substance agreement today.</span>
        </label>
      </section>

      <section className="card stack" style={{ gap: 10 }} aria-label="Your yes today">
        <Chips
          legend="Which parts of your yes are here today?"
          hint="Tap all that feel true. Anything missing is worth saying out loud."
          options={readinessIngredients.map((r) => ({ id: r, label: r }))}
          value={c.readiness}
          onChange={(readiness) => set({ readiness })}
        />
      </section>

      {error && (
        <p className="box box-block" role="alert">
          {error}
        </p>
      )}
      {missing.length > 0 && <p className="note">Still to answer: {missing.join(', ')}.</p>}
      <button
        type="button"
        className="btn btn-primary btn-block"
        disabled={busy || missing.length > 0}
        onClick={async () => {
          setBusy(true);
          setError('');
          const err = await onSend({ ...c, answeredAt: new Date().toISOString(), onTopPhone: onTopPhone || undefined });
          setBusy(false);
          if (err) setError(err);
        }}
      >
        {onTopPhone ? 'Done, hand the phone back' : `Send to ${topName}`}
      </button>
    </div>
  );
}
