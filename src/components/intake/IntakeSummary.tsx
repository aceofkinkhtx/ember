import type { ReactNode } from 'react';
import { aftercareMap, bodyAreas, decoderAnswers, desireMap, nearCenter, presenceQuestions, quadrantOf, wordGroups, type Dot, type MapSpec } from '../../content/intake';
import { activities, categories, experienceLevels, impactAreas, impactPositions, markOptions, speakUpLevels } from '../../data/activities';
import { limitsOf, type Intake } from '../../lib/intake';

// Everything in an intake, the way the person it is shared with sees it.
// "Essentials only" shows just the first part.

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function Block({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <section className="card stack" style={{ gap: 8 }}>
      <div className="person">
        <h3 className="eyebrow" style={{ margin: 0 }}>
          {title}
        </h3>
        {updated && <span className="note">Updated {dateFmt.format(new Date(updated))}</span>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === '' || (Array.isArray(children) && children.length === 0)) return null;
  return (
    <p style={{ margin: 0 }}>
      <strong>{label}:</strong> {children}
    </p>
  );
}

function dotText(map: MapSpec, dot: Dot | null): string | null {
  if (!dot) return null;
  if (nearCenter(dot)) return 'A little of everything';
  const q = quadrantOf(map, dot);
  return `${q.label}: ${q.desc}`;
}

const nameOf = (list: { id: string; label: string }[], id: string | null | undefined) => list.find((x) => x.id === id)?.label ?? null;
const join = (xs: string[]) => xs.filter(Boolean).join(', ');

/** The limit strip: no in red, maybe in amber. */
export function LimitStrip({ intake }: { intake: Intake }) {
  const listed = limitsOf(intake);
  const own = intake.essentials.limits ?? { hard: '', soft: '' };
  const hard = [...listed.hard, own.hard.trim(), intake.detailed?.limits.hardExtra.trim() ?? ''].filter(Boolean);
  const soft = [...listed.soft, own.soft.trim()].filter(Boolean);
  if (!hard.length && !soft.length) return null;
  return (
    <div className="stack" style={{ gap: 6 }}>
      {hard.length > 0 && (
        <p style={{ margin: 0, padding: '8px 12px', borderRadius: 10, background: '#B3261E', color: '#fff' }}>
          <strong>No:</strong> {join(hard)}
        </p>
      )}
      {soft.length > 0 && (
        <p style={{ margin: 0, padding: '8px 12px', borderRadius: 10, background: '#E8A317', color: '#1d1406' }}>
          <strong>Maybe:</strong> {join(soft)}
        </p>
      )}
    </div>
  );
}

function hasLimits(intake: Intake): boolean {
  const l = limitsOf(intake);
  const own = intake.essentials.limits ?? { hard: '', soft: '' };
  return Boolean(l.hard.length || l.soft.length || own.hard.trim() || own.soft.trim() || intake.detailed?.limits.hardExtra.trim());
}

export function IntakeSummary({ intake, full = true }: { intake: Intake; full?: boolean }) {
  const e = intake.essentials;
  const speak = speakUpLevels.find((s) => s.id === e.speakUp);
  const honor = join([...e.honorifics, e.honorificCustom.trim()]);
  const d = intake.detailed;
  const a = intake.aftercare;
  const all = [...activities, ...(d?.custom ?? [])];

  return (
    <div className="stack" style={{ gap: 12 }}>
      <Block title="Signals" updated={intake.updated.essentials}>
        <p style={{ margin: 0 }}>
          <strong>Green:</strong> {e.signals.green} · <strong>Yellow:</strong> {e.signals.yellow} · <strong>Red:</strong> {e.signals.red}
        </p>
        <Row label="Hand signal">{e.signals.handSign}</Row>
        <Row label="Also">{e.signals.custom}</Row>
      </Block>

      <Block title="Limits">
        {hasLimits(intake) ? <LimitStrip intake={intake} /> : <p className="note" style={{ margin: 0 }}>No limits listed yet. Ask before assuming anything.</p>}
      </Block>

      <Block title="Essentials">
        <Row label="Experience">{nameOf(experienceLevels, e.experience)}</Row>
        <Row label="Speaking up">{speak?.label}</Row>
        {speak?.selfAdvocacyFlag && (
          <p className="note" style={{ margin: 0 }}>
            Check in often and ask directly. Silence is not a yes.
          </p>
        )}
        <Row label="Call me">{honor}</Row>
        <Row label="Body notes">{join(e.body.areas.map((id) => nameOf(bodyAreas, id) ?? id))}</Row>
        <Row label="Injuries and health">{e.body.notes}</Row>
        <Row label="Allergies">{e.body.allergies}</Row>
        <Row label="Triggers">{join([...e.triggers.chips, e.triggers.notes])}</Row>
        <Row label="If I'm overwhelmed">{join([...e.overwhelm.chips, e.overwhelm.notes])}</Row>
        <Row label="Emergency contact">
          {e.emergency?.kind === '911'
            ? 'Call 911'
            : e.emergency
              ? `${e.emergency.name}, ${e.emergency.phone}${e.emergency.aware === 'no' ? " (doesn't know about kink)" : e.emergency.aware === 'some' ? ' (knows a little about kink)' : ''}`
              : null}
        </Row>
        <Row label="Substances">{e.substanceAgreedAt ? 'Agrees to no play when noticeably intoxicated' : null}</Row>
        <Row label="Overriding a no">{e.allowNoOverride.on ? 'Allowed after we talk' : 'Never. Every no is a hard block'}</Row>
      </Block>

      {!full && <p className="note">You can see essentials only.</p>}

      {full && (intake.quick || intake.desireMap) && (
        <Block title="Desires" updated={intake.updated.quick ?? intake.updated.desireMap}>
          {intake.quick &&
            wordGroups.map((g) => {
              const words = intake.quick!.words[g.id].map((id) => g.words.find((w) => w.id === id)?.label ?? id);
              const why = (intake.quick!.decoder[g.id] ?? []).map((id) => nameOf(decoderAnswers, id) ?? id);
              return (
                <Row key={g.id} label={g.title}>
                  {join(words)}
                  {why.length ? ` (for ${join(why).toLowerCase()})` : ''}
                </Row>
              );
            })}
          <Row label="Desire map">{dotText(desireMap, intake.desireMap)}</Row>
        </Block>
      )}

      {full && d && (
        <Block title="Activities" updated={intake.updated.detailed}>
          {categories.map((c) => {
            const yes = all.filter((x) => x.category === c.id && d.answers[x.id]?.choice === 'yes');
            if (!yes.length) return null;
            return (
              <Row key={c.id} label={`Yes, ${c.label.toLowerCase()}`}>
                {join(yes.map((x) => `${x.label}${d.answers[x.id].intensity ? ` (${d.answers[x.id].intensity} of 5)` : ''}`))}
              </Row>
            );
          })}
          <Row label="Impact areas">{join(d.impact.areas.map((id) => nameOf(impactAreas, id) ?? id))}</Row>
          <Row label="Positions">{join(d.impact.positions.map((id) => nameOf(impactPositions, id) ?? id))}</Row>
          <Row label="Feel">{join(d.impact.feel)}</Row>
          <Row label="Marks">{nameOf(markOptions, d.impact.marks)}</Row>
          <Row label="Words welcome">{d.words.welcome}</Row>
          <Row label="Words off-limits">{d.words.offLimits}</Row>
          <Row label="Don't touch">{d.limits.noTouch}</Row>
        </Block>
      )}

      {full && intake.myBody && (intake.myBody.wordsWelcome || intake.myBody.wordsAvoid) && (
        <Block title="My body">
          <Row label="Words I like for my body">{intake.myBody.wordsWelcome}</Row>
          <Row label="Words to avoid">{intake.myBody.wordsAvoid}</Row>
        </Block>
      )}

      {full && a && (
        <Block title="Aftercare" updated={intake.updated.aftercare}>
          <Row label="Right after">{dotText(aftercareMap, a.map)}</Row>
          <Row label="The next day">{dotText(aftercareMap, a.nextDay)}</Row>
          <Row label="Extras">{join(a.extras)}</Row>
          {presenceQuestions.map((q) => (
            <Row key={q.id} label={q.label}>
              {a.presence[q.id] === 'yes' ? 'Yes' : a.presence[q.id] === 'ask' ? 'Ask me first' : a.presence[q.id] === 'no' ? 'No' : null}
            </Row>
          ))}
          <Row label="Curious about">{a.curiosity}</Row>
        </Block>
      )}
    </div>
  );
}
