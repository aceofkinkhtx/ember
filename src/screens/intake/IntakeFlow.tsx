import { useEffect, useMemo, useRef, useState } from 'react';
import { BodyMap } from '../../components/intake/BodyMap';
import { Chips, OneOf, Section, Segments, TextArea, TextInput } from '../../components/intake/Bits';
import { IntakeSummary } from '../../components/intake/IntakeSummary';
import { MapPicker } from '../../components/intake/MapPicker';
import {
  aftercareMap,
  contactAwareness,
  decoderAnswers,
  desireMap,
  honorifics,
  overwhelmExamples,
  presenceAnswers,
  presenceQuestions,
  triggerExamples,
  wordGroups,
  type GroupId
} from '../../content/intake';
import {
  aftercareExtras,
  categories,
  experienceLevels,
  feels,
  impactAreas,
  impactPositions,
  markOptions,
  speakUpLevels,
  type Activity,
  type CategoryId,
  type Feel
} from '../../data/activities';
import {
  allActivities,
  emptyAftercare,
  emptyDetailed,
  essentialsMissing,
  mergeChange,
  type Choice,
  type Essentials,
  type Intake,
  type PathId
} from '../../lib/intake';

// BI1 to BI8: the bottom's intake, one screen at a time. Answers save on the
// phone as they change, so it can be finished over several sittings.

type Step =
  | 'signals'
  | 'body'
  | 'safety'
  | 'paths'
  | `group-${GroupId}`
  | `decoder-${GroupId}`
  | 'desire-map'
  | 'my-body'
  | `cat-${CategoryId}`
  | 'impact'
  | 'words'
  | 'aftercare'
  | 'review';

function stepsFor(paths: PathId[]): Step[] {
  const steps: Step[] = ['signals', 'safety', 'body', 'paths'];
  if (paths.includes('quick')) for (const g of wordGroups) steps.push(`group-${g.id}`, `decoder-${g.id}`);
  if (paths.includes('map')) steps.push('desire-map');
  if (paths.includes('detailed')) {
    steps.push('my-body');
    for (const c of categories) steps.push(`cat-${c.id}`);
    steps.push('impact', 'words');
  }
  steps.push('aftercare', 'review');
  return steps;
}

const pathCards: { id: PathId; label: string; desc: string }[] = [
  { id: 'quick', label: 'Quick', desc: 'Three groups of words: Heat, Hold and Flow. About 3 minutes.' },
  { id: 'map', label: 'Map', desc: 'Place one dot on the desire map. About 1 minute.' },
  { id: 'detailed', label: 'Detailed', desc: 'Yes, maybe or no for every activity. About 10 minutes.' }
];

export function IntakeFlow({
  value,
  onChange: report,
  review,
  title = 'Your intake',
  startAt = 0
}: {
  value: Intake;
  onChange: (next: Intake) => void;
  /** The last screen: save and share for members, send for guests. */
  review: (intake: Intake) => React.ReactNode;
  title?: string;
  startAt?: number;
}) {
  // Every change is reapplied on top of the newest answers, so quick taps never undo each other.
  const latest = useRef(value);
  latest.current = value;
  const onChange = (next: Intake) => {
    latest.current = mergeChange(value, next, latest.current);
    report(latest.current);
  };

  const steps = useMemo(() => stepsFor(value.paths), [value.paths]);
  const [index, setIndex] = useState(Math.min(startAt, steps.length - 1));
  const step = steps[Math.min(index, steps.length - 1)];

  // The screen itself scrolls, not the window, so each new step starts at its top.
  const screenRef = useRef<HTMLElement>(null);
  useEffect(() => {
    screenRef.current?.scrollTo?.(0, 0);
    window.scrollTo?.(0, 0);
  }, [index]);

  const stamp = (section: keyof Intake['updated']) => ({ ...value.updated, [section]: new Date().toISOString() });
  const setE = (patch: Partial<Essentials>) => onChange({ ...value, essentials: { ...value.essentials, ...patch }, updated: stamp('essentials') });

  const blocked = blockedReason(step, value);

  return (
    <main className="screen" ref={screenRef}>
      <div>
        <div className="eyebrow">{title}</div>
        <div className="progress-bar" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-label={`Step ${index + 1} of ${steps.length}`}>
          <span style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <StepBody step={step} intake={value} onChange={onChange} setE={setE} stamp={stamp} review={review} />

      {step !== 'review' && (
        <footer className="stack" style={{ gap: 8 }}>
          {blocked && <p className="note">{blocked}</p>}
          <button type="button" className="btn btn-primary btn-block" disabled={Boolean(blocked)} onClick={() => setIndex(index + 1)}>
            Continue
          </button>
          {step.startsWith('decoder-') && (
            <button type="button" className="btn btn-quiet btn-block" onClick={() => setIndex(index + 1)}>
              Skip this question
            </button>
          )}
        </footer>
      )}
      {index > 0 && (
        <button type="button" className="btn btn-quiet btn-block" onClick={() => setIndex(index - 1)}>
          Back
        </button>
      )}
    </main>
  );
}

function blockedReason(step: Step, intake: Intake): string {
  if (step === 'safety') {
    const missing = essentialsMissing(intake.essentials);
    return missing.length ? `To continue, add ${missing.join(' and ')}.` : '';
  }
  if (step === 'paths' && intake.paths.length === 0) return 'Choose at least one way to share.';
  if (step.startsWith('group-')) {
    const g = step.slice(6) as GroupId;
    if (!intake.quick?.words[g]?.length) return 'Pick one or two words to continue.';
  }
  return '';
}

function StepBody({
  step,
  intake,
  onChange,
  setE,
  stamp,
  review
}: {
  step: Step;
  intake: Intake;
  onChange: (next: Intake) => void;
  setE: (patch: Partial<Essentials>) => void;
  stamp: (section: keyof Intake['updated']) => Intake['updated'];
  review: (intake: Intake) => React.ReactNode;
}) {
  const e = intake.essentials;

  if (step === 'signals') {
    return (
      <>
        <h1>The essentials</h1>
        <p className="lede">What every Top needs to know, whichever way you share the rest.</p>
        <Section title="Signals">
          <div className="stack" style={{ gap: 12 }}>
            <TextInput label="Green: keep going" value={e.signals.green} onChange={(green) => setE({ signals: { ...e.signals, green } })} max={30} />
            <TextInput label="Yellow: slow down or check in" value={e.signals.yellow} onChange={(yellow) => setE({ signals: { ...e.signals, yellow } })} max={30} />
            <TextInput label="Red: stop now" value={e.signals.red} onChange={(red) => setE({ signals: { ...e.signals, red } })} max={30} />
            <TextInput
              label="Hand signal"
              hint="For when you can't speak."
              value={e.signals.handSign}
              onChange={(handSign) => setE({ signals: { ...e.signals, handSign } })}
            />
            <TextInput label="Any other signal (optional)" value={e.signals.custom} onChange={(custom) => setE({ signals: { ...e.signals, custom } })} />
          </div>
        </Section>
        <Section title="Experience and voice">
          <OneOf legend="How much experience do you have?" options={experienceLevels} value={e.experience} onChange={(experience) => setE({ experience })} />
          <OneOf
            legend="When something is wrong in a scene, how easily do you speak up?"
            hint="There's no wrong answer. This tells your Top how often to check in."
            options={speakUpLevels}
            value={e.speakUp}
            onChange={(speakUp) => setE({ speakUp })}
          />
        </Section>
        <Section title="What to call you in a scene">
          <Chips legend="Honorifics you like" hint="Pick any." options={honorifics.map((h) => ({ id: h, label: h }))} value={e.honorifics} onChange={(h) => setE({ honorifics: h })} />
          <TextInput label="Or write your own" value={e.honorificCustom} onChange={(honorificCustom) => setE({ honorificCustom })} max={40} />
        </Section>
      </>
    );
  }

  if (step === 'body') {
    return (
      <>
        <h1>Body and mind</h1>
        <p className="lede">Share what helps your Top keep you safe. Everything here is optional.</p>
        <Section title="Body">
          <BodyMap
            legend="Anywhere with an injury, pain or a note?"
            hint="Tap the outline or the names."
            value={e.body.areas}
            onChange={(areas) => setE({ body: { ...e.body, areas } })}
          />
          <TextArea
            label="Injuries, health and mobility"
            hint="Medical conditions, positions that don't work, anything your Top should plan around."
            value={e.body.notes}
            onChange={(notes) => setE({ body: { ...e.body, notes } })}
          />
          <TextInput label="Allergies" value={e.body.allergies} onChange={(allergies) => setE({ body: { ...e.body, allergies } })} max={200} />
        </Section>
        <Section title="Mind">
          <Chips
            legend="Triggers"
            hint="Tap any examples that fit, or write your own. Share only what you want to."
            options={triggerExamples.map((t) => ({ id: t, label: t }))}
            value={e.triggers.chips}
            onChange={(chips) => setE({ triggers: { ...e.triggers, chips } })}
          />
          <TextArea label="Other triggers" value={e.triggers.notes} onChange={(notes) => setE({ triggers: { ...e.triggers, notes } })} />
          <Chips
            legend="If you get overwhelmed, what helps?"
            options={overwhelmExamples.map((t) => ({ id: t, label: t }))}
            value={e.overwhelm.chips}
            onChange={(chips) => setE({ overwhelm: { ...e.overwhelm, chips } })}
          />
          <TextArea label="Anything else that helps, or to avoid" value={e.overwhelm.notes} onChange={(notes) => setE({ overwhelm: { ...e.overwhelm, notes } })} />
        </Section>
      </>
    );
  }

  if (step === 'safety') {
    const em = e.emergency;
    return (
      <>
        <h1>Safety</h1>
        <Section title="Emergency contact">
          <Segments
            label="If something goes wrong, who should your Top contact?"
            options={[
              { id: 'person', label: 'Someone I trust' },
              { id: '911', label: 'Call 911' }
            ]}
            value={em?.kind ?? null}
            onChange={(kind) => setE({ emergency: kind === '911' ? { kind: '911' } : { kind: 'person', name: '', phone: '', aware: null } })}
          />
          {em?.kind === 'person' && (
            <>
              <TextInput label="Their name" value={em.name} onChange={(name) => setE({ emergency: { ...em, name } })} max={60} />
              <TextInput label="Their phone number" type="tel" autoComplete="off" value={em.phone} onChange={(phone) => setE({ emergency: { ...em, phone } })} max={30} />
              <Segments label="Do they know about kink?" options={[...contactAwareness]} value={em.aware} onChange={(aware) => setE({ emergency: { ...em, aware } })} />
            </>
          )}
          {em?.kind === '911' && <p className="note">Your Top will call 911 in an emergency and won't need anyone's details.</p>}
        </Section>
        <Section title="Limits">
          <TextArea
            label="Hard limits"
            hint="Anything that's always a no. If you choose the detailed path, your no answers are added too."
            value={e.limits?.hard ?? ''}
            onChange={(hard) => setE({ limits: { ...(e.limits ?? { hard: '', soft: '' }), hard } })}
            rows={2}
          />
          <TextArea
            label="Soft limits"
            hint="Things that might be okay, but only after you talk."
            value={e.limits?.soft ?? ''}
            onChange={(soft) => setE({ limits: { ...(e.limits ?? { hard: '', soft: '' }), soft } })}
            rows={2}
          />
        </Section>
        <Section title="Substances">
          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(e.substanceAgreedAt)}
              onChange={(ev) => setE({ substanceAgreedAt: ev.target.checked ? new Date().toISOString() : null })}
            />
            I agree to no play when either of us is noticeably intoxicated.
          </label>
        </Section>
        <Section title="Your no means no">
          <label className="check" style={{ alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={e.allowNoOverride.on}
              onChange={(ev) => setE({ allowNoOverride: { on: ev.target.checked, changedAt: new Date().toISOString() } })}
            />
            <span>
              My Top may override a no after we talk
              <span className="note" style={{ display: 'block', fontWeight: 400 }}>
                Off by default. While it's off, every no is a hard block that no Top can add to a scene.
              </span>
            </span>
          </label>
        </Section>
      </>
    );
  }

  if (step === 'paths') {
    return (
      <>
        <h1>How would you like to share your desires?</h1>
        <p className="lede">Pick one, or more than one. You can come back and do another anytime.</p>
        <div className="stack">
          {pathCards.map((p) => (
            <button
              key={p.id}
              type="button"
              className="choice"
              role="checkbox"
              aria-checked={intake.paths.includes(p.id)}
              onClick={() => {
                const paths = intake.paths.includes(p.id) ? intake.paths.filter((x) => x !== p.id) : [...intake.paths, p.id];
                onChange({
                  ...intake,
                  paths: (['quick', 'map', 'detailed'] as PathId[]).filter((x) => paths.includes(x)),
                  quick: paths.includes('quick') ? (intake.quick ?? { words: { heat: [], hold: [], flow: [] }, decoder: {} }) : intake.quick,
                  detailed: paths.includes('detailed') ? (intake.detailed ?? emptyDetailed()) : intake.detailed
                });
              }}
            >
              <span>
                <span className="choice-word">{p.label}</span>
                <span className="choice-desc" style={{ display: 'block' }}>
                  {p.desc}
                </span>
              </span>
            </button>
          ))}
        </div>
      </>
    );
  }

  if (step.startsWith('group-') && intake.quick) {
    const g = wordGroups.find((x) => x.id === step.slice(6))!;
    const quick = intake.quick;
    const picked = quick.words[g.id];
    return (
      <>
        <div className="eyebrow">{g.title}</div>
        <h1>{g.question}</h1>
        <p className="lede">Pick one or two.</p>
        <div className="stack">
          {g.words.map((w) => (
            <button
              key={w.id}
              type="button"
              className="choice"
              role="checkbox"
              aria-checked={picked.includes(w.id)}
              onClick={() => {
                const next = picked.includes(w.id) ? picked.filter((x) => x !== w.id) : [...picked, w.id].slice(-2);
                onChange({ ...intake, quick: { ...quick, words: { ...quick.words, [g.id]: next } }, updated: stamp('quick') });
              }}
            >
              <span>
                <span className="choice-word">{w.label}</span>
                <span className="choice-desc" style={{ display: 'block' }}>
                  {w.desc}
                </span>
              </span>
            </button>
          ))}
        </div>
      </>
    );
  }

  if (step.startsWith('decoder-') && intake.quick) {
    const g = wordGroups.find((x) => x.id === step.slice(8))!;
    const quick = intake.quick;
    const words = quick.words[g.id].map((id) => g.words.find((w) => w.id === id)?.label).filter(Boolean);
    return (
      <>
        <div className="eyebrow">{g.title}</div>
        <h1>What does {words.join(' and ') || 'this'} do for you?</h1>
        <p className="lede">Pick what fits. It shapes the scene more than the activities do.</p>
        <div className="stack">
          {decoderAnswers.map((d) => {
            const chosen = quick.decoder[g.id] ?? [];
            return (
              <button
                key={d.id}
                type="button"
                className="choice"
                role="checkbox"
                aria-checked={chosen.includes(d.id)}
                onClick={() => {
                  const next = chosen.includes(d.id) ? chosen.filter((x) => x !== d.id) : [...chosen, d.id];
                  onChange({ ...intake, quick: { ...quick, decoder: { ...quick.decoder, [g.id]: next } }, updated: stamp('quick') });
                }}
              >
                <span>
                  <span className="choice-word">{d.label}</span>
                  <span className="choice-desc" style={{ display: 'block' }}>
                    {d.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </>
    );
  }

  if (step === 'desire-map') {
    return (
      <>
        <h1>Where do you want this scene to take you?</h1>
        <p className="lede">Place one dot. Its exact spot matters, so a dot near the middle means a little of everything.</p>
        <MapPicker map={desireMap} value={intake.desireMap} onChange={(desireMapDot) => onChange({ ...intake, desireMap: desireMapDot, updated: stamp('desireMap') })} />
      </>
    );
  }

  if (step === 'my-body') {
    const body = intake.myBody ?? { frontHole: null, wordsWelcome: '', wordsAvoid: '' };
    const set = (patch: Partial<typeof body>) => onChange({ ...intake, myBody: { ...body, ...patch }, updated: stamp('detailed') });
    return (
      <>
        <h1>My body</h1>
        <p className="lede">Optional. This only decides which activities you see and the words Ember and your Top use.</p>
        <Section title="Activities to show">
          <Segments
            label="Show activities for a vagina or front hole?"
            options={[
              { id: 'yes', label: 'Yes' },
              { id: 'no', label: 'No' },
              { id: 'all', label: 'Show everything' }
            ]}
            value={body.frontHole === null ? 'all' : body.frontHole ? 'yes' : 'no'}
            onChange={(v) => set({ frontHole: v === 'all' ? null : v === 'yes' })}
          />
        </Section>
        <Section title="Words for your body">
          <TextArea label="Words you like for your body" hint="For example, the words you use for your chest or genitals." value={body.wordsWelcome} onChange={(wordsWelcome) => set({ wordsWelcome })} rows={2} />
          <TextArea label="Words to avoid" value={body.wordsAvoid} onChange={(wordsAvoid) => set({ wordsAvoid })} rows={2} />
        </Section>
      </>
    );
  }

  if (step.startsWith('cat-')) {
    const cat = categories.find((c) => c.id === step.slice(4))!;
    return <CategoryStep category={cat} intake={intake} onChange={onChange} stamp={stamp} />;
  }

  if (step === 'impact' && intake.detailed) {
    const d = intake.detailed;
    const set = (patch: Partial<typeof d.impact>) => onChange({ ...intake, detailed: { ...d, impact: { ...d.impact, ...patch } }, updated: stamp('detailed') });
    return (
      <>
        <h1>Impact details</h1>
        <Section title="Where">
          <Chips
            legend="Areas that are okay"
            hint="Higher-risk areas are marked."
            options={impactAreas.map((a) => ({ id: a.id, label: a.risk === 'low' ? a.label : `${a.label} (${a.risk} risk)` }))}
            value={d.impact.areas}
            onChange={(areas) => set({ areas })}
          />
          <Chips legend="Positions" options={impactPositions} value={d.impact.positions} onChange={(positions) => set({ positions })} />
        </Section>
        <Section title="How">
          <Chips legend="Feel" options={feels.map((f) => ({ id: f, label: f }))} value={d.impact.feel} onChange={(feel) => set({ feel: feel as Feel[] })} />
          <Segments label="Marks" options={markOptions} value={d.impact.marks} onChange={(marks) => set({ marks })} />
          <p className="note">Marks are confirmed again for each scene.</p>
        </Section>
      </>
    );
  }

  if (step === 'words' && intake.detailed) {
    const d = intake.detailed;
    const setD = (patch: Partial<typeof d>) => onChange({ ...intake, detailed: { ...d, ...patch }, updated: stamp('detailed') });
    return (
      <>
        <h1>Limits and language</h1>
        <p className="lede">Your no answers already fill your limit strip. Add anything else here.</p>
        <Section title="Words">
          <TextArea label="Words welcome" hint="Names, praise or degradation you enjoy." value={d.words.welcome} onChange={(welcome) => setD({ words: { ...d.words, welcome } })} rows={2} />
          <TextArea label="Words off-limits" value={d.words.offLimits} onChange={(offLimits) => setD({ words: { ...d.words, offLimits } })} rows={2} />
        </Section>
        <Section title="Limits">
          <TextArea label="Any other hard no" value={d.limits.hardExtra} onChange={(hardExtra) => setD({ limits: { ...d.limits, hardExtra } })} rows={2} />
          <TextArea label="Places not to be touched" value={d.limits.noTouch} onChange={(noTouch) => setD({ limits: { ...d.limits, noTouch } })} rows={2} />
        </Section>
      </>
    );
  }

  if (step === 'aftercare') {
    const a = intake.aftercare ?? emptyAftercare();
    const set = (patch: Partial<typeof a>) => onChange({ ...intake, aftercare: { ...a, ...patch }, updated: stamp('aftercare') });
    return (
      <>
        <h1>Aftercare</h1>
        <p className="lede">How you want to come back after the scene.</p>
        <Section title="Right after">
          <MapPicker map={aftercareMap} value={a.map} onChange={(map) => set({ map })} />
        </Section>
        <Section title="The next day (optional)">
          {a.nextDay ? (
            <>
              <MapPicker map={aftercareMap} value={a.nextDay} onChange={(nextDay) => set({ nextDay })} />
              <button type="button" className="btn btn-quiet" onClick={() => set({ nextDay: null })}>
                Remove the next-day dot
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => set({ nextDay: { x: 0, y: 0 } })}>
              Add a dot for the next day
            </button>
          )}
        </Section>
        <Section title="Extras">
          <Chips legend="What helps" options={aftercareExtras.map((x) => ({ id: x, label: x }))} value={a.extras} onChange={(extras) => set({ extras })} />
        </Section>
        <Section title="Presence and privacy">
          {presenceQuestions.map((q) => (
            <Segments key={q.id} label={q.label} options={presenceAnswers} value={a.presence[q.id]} onChange={(ans) => set({ presence: { ...a.presence, [q.id]: ans } })} />
          ))}
        </Section>
        <Section title="Curiosity">
          <TextArea label="Anything you're curious about but haven't tried?" value={a.curiosity} onChange={(curiosity) => set({ curiosity })} rows={2} />
        </Section>
      </>
    );
  }

  if (step === 'review') {
    return (
      <>
        <h1>Review</h1>
        <p className="lede">This is what a Top sees when you share your full profile. Go back to change anything.</p>
        <IntakeSummary intake={intake} />
        {review(intake)}
      </>
    );
  }

  return null;
}

function CategoryStep({
  category,
  intake,
  onChange,
  stamp
}: {
  category: { id: CategoryId; label: string };
  intake: Intake;
  onChange: (next: Intake) => void;
  stamp: (section: keyof Intake['updated']) => Intake['updated'];
}) {
  const d = intake.detailed ?? emptyDetailed();
  const [adding, setAdding] = useState('');
  const items = allActivities(d, intake.myBody).filter((a) => a.category === category.id);
  const setAnswer = (id: string, next: { choice: Choice; intensity?: number } | null) => {
    const answers = { ...d.answers };
    if (next) answers[id] = next;
    else delete answers[id];
    onChange({ ...intake, detailed: { ...d, answers }, updated: stamp('detailed') });
  };

  return (
    <>
      <div className="eyebrow">Detailed</div>
      <h1>{category.label}</h1>
      <p className="lede">Yes, maybe or no for each. Anything you leave blank is never read as a yes.</p>
      <ul className="person-list">
        {items.map((a: Activity) => {
          const ans = d.answers[a.id];
          return (
            <li key={a.id} className="card stack" style={{ gap: 8 }}>
              <div className="person-name" style={{ fontSize: 16 }}>
                {a.label}
                {a.edge && <span className="note"> · edge play, always negotiated first</span>}
                {a.negotiatedOnly && !a.edge && <span className="note"> · only when negotiated</span>}
              </div>
              <div className="segmented" role="radiogroup" aria-label={a.label} style={{ alignSelf: 'flex-start' }}>
                {(['yes', 'maybe', 'no'] as Choice[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={ans?.choice === c}
                    onClick={() => setAnswer(a.id, ans?.choice === c ? null : { choice: c, intensity: c === 'yes' ? (ans?.intensity ?? 3) : undefined })}
                  >
                    {c === 'yes' ? 'Yes' : c === 'maybe' ? 'Maybe' : 'No'}
                  </button>
                ))}
              </div>
              {ans?.choice === 'yes' && (
                <label className="note" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  Intensity
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={ans.intensity ?? 3}
                    aria-label={`${a.label} intensity`}
                    onChange={(e) => setAnswer(a.id, { choice: 'yes', intensity: Number(e.target.value) })}
                    style={{ flex: 1 }}
                  />
                  {ans.intensity ?? 3} of 5
                </label>
              )}
            </li>
          );
        })}
      </ul>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          const label = adding.trim();
          if (!label) return;
          const custom: Activity = { id: `custom-${Date.now().toString(36)}`, label, category: category.id, custom: true };
          onChange({ ...intake, detailed: { ...d, custom: [...d.custom, custom] }, updated: stamp('detailed') });
          setAdding('');
        }}
      >
        <TextInput label={`Add your own to ${category.label.toLowerCase()}`} value={adding} onChange={setAdding} max={60} />
        <button type="submit" className="btn btn-secondary" disabled={!adding.trim()}>
          Add
        </button>
      </form>
    </>
  );
}
