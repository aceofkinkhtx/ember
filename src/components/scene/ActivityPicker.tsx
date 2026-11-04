import { useState } from 'react';
import { allTopActivities, available } from '../../content/topSetup';
import { categories, type Activity } from '../../data/activities';
import type { Override } from '../../lib/scene/model';
import { choiceOf, confirmationsFor, type Confirmation, type RuleContext } from '../../lib/scene/rules';

// Choose an activity for a scene. Yes items come first; the rest carry a flag:
// maybe (amber), not answered (gray), no (red, and only with the bottom's
// permission and a required question). Edge play and sex acts ask too.

export function ActivityTag({ ctx, activity }: { ctx: RuleContext; activity: Activity }) {
  const choice = choiceOf(ctx, activity.id);
  return (
    <>
      {choice === 'maybe' && <span className="tag tag-amber">Maybe</span>}
      {choice === null && <span className="tag tag-gray">Not answered</span>}
      {choice === 'no' && <span className="tag tag-red">No</span>}
      {activity.edge && <span className="tag tag-red">Edge</span>}
      {activity.negotiatedOnly && <span className="tag tag-amber">Negotiated</span>}
    </>
  );
}

/** Everything a designer could add, with the bottom's own additions. */
export function choosable(ctx: RuleContext): Activity[] {
  const mine = allTopActivities(ctx.top.offerings).filter((a) => available(a, ctx.top.settings, true));
  return [...mine, ...(ctx.intake?.detailed?.custom ?? [])];
}

/**
 * Runs the checks for one activity: refuses with a reason, asks each required
 * question, then hands back the dated overrides to record.
 */
export function useAddActivity(ctx: RuleContext, onAdd: (a: Activity, overrides: Override[]) => void) {
  const [asking, setAsking] = useState<{ activity: Activity; queue: Confirmation[]; done: Override[] } | null>(null);
  const [refused, setRefused] = useState('');

  function start(a: Activity) {
    setRefused('');
    const check = confirmationsFor(ctx, a);
    if ('blocked' in check) {
      setRefused(check.blocked);
      return;
    }
    if (!check.confirm.length) onAdd(a, []);
    else setAsking({ activity: a, queue: check.confirm, done: [] });
  }

  function answer(yes: boolean) {
    if (!asking) return;
    if (!yes) {
      setAsking(null);
      return;
    }
    const [first, ...rest] = asking.queue;
    const done = [...asking.done, { activityId: asking.activity.id, kind: first.kind, confirmedAt: new Date().toISOString() }];
    if (rest.length) setAsking({ ...asking, queue: rest, done });
    else {
      setAsking(null);
      onAdd(asking.activity, done);
    }
  }

  const sheet = asking && (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="sheet">
        <span className="tag tag-red" style={{ alignSelf: 'flex-start' }}>
          {asking.queue[0].kind === 'no' ? 'They said no' : asking.queue[0].kind === 'edge' ? 'Edge play' : 'Sex act'}
        </span>
        <h2 id="confirm-title" style={{ margin: 0 }}>
          {asking.queue[0].question}
        </h2>
        <p className="note" style={{ margin: 0 }}>
          Your answer is saved with today's date in this scene's record. The flag stays visible on the beat and in the live guide.
        </p>
        <button type="button" className="btn btn-primary btn-block" onClick={() => answer(true)}>
          Yes, we agreed
        </button>
        <button type="button" className="btn btn-secondary btn-block" onClick={() => answer(false)}>
          No, leave it out
        </button>
      </div>
    </div>
  );

  return { start, sheet, refused, clearRefused: () => setRefused('') };
}

/** A grouped list of activities to add, each with its flags. */
export function ActivityList({
  ctx,
  exclude,
  onChoose
}: {
  ctx: RuleContext;
  exclude: string[];
  onChoose: (a: Activity) => void;
}) {
  const list = choosable(ctx).filter((a) => !exclude.includes(a.id));
  return (
    <div className="stack" style={{ gap: 14 }}>
      {categories.map((c) => {
        const items = list.filter((a) => a.category === c.id);
        if (!items.length) return null;
        return (
          <div key={c.id} className="stack" style={{ gap: 6 }}>
            <span className="field-label" style={{ fontSize: 15 }}>
              {c.label}
            </span>
            <div className="chips">
              {items.map((a) => (
                <button key={a.id} type="button" className="chip" onClick={() => onChoose(a)} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  {a.label} <ActivityTag ctx={ctx} activity={a} />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
