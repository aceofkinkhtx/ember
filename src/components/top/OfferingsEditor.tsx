import { useRef, useState } from 'react';
import { activities as builtIn, categories, type Activity, type CategoryId } from '../../data/activities';
import {
  DEGREE_RANGE,
  allTopActivities,
  available,
  clampRange,
  defaultRange,
  degreeEnds,
  isOffered,
  rangeText,
  type CategoryOffering,
  type Offerings,
  type TopSetup
} from '../../content/topSetup';
import { TextInput } from '../intake/Bits';
import { RangePair } from '../RangePair';
import { SettingSwitch } from '../Switch';

// O4 and Me > Offerings: what this Top does, and how far they go. Each category
// is a switch with a range slider; inside it, every activity is a chip that is
// on unless the Top turns it off. Press and hold a chip to rename it. Edge play
// shows only in Studio mode, and penile or oral sex only when the Top allows it
// in their settings.

const intro: Record<CategoryId, string> = {
  bondage: 'Restraint, from blindfolds and cuffs to rope and furniture.',
  sensation: 'Wax, biting, tickling, scratching, electricity and more.',
  impact: 'Hands, paddles, floggers, canes and whips.',
  touch: 'Cuddling, kissing and intimate touch.',
  penetration: 'Fingers, toys, and penis or strap-on.'
};

const HOLD_MS = 550;

type Change = (change: (o: Offerings) => Offerings) => void;

export function OfferingsEditor({ setup, studio, onChange }: { setup: TopSetup; studio: boolean; onChange: Change }) {
  const [renaming, setRenaming] = useState<Activity | null>(null);
  return (
    <div className="stack" style={{ gap: 14 }}>
      {categories.map((c) => (
        <CategoryCard key={c.id} id={c.id} label={c.label} setup={setup} studio={studio} onChange={onChange} onRename={setRenaming} />
      ))}
      {renaming && <RenameSheet activity={renaming} onChange={onChange} onClose={() => setRenaming(null)} />}
    </div>
  );
}

function CategoryCard({
  id,
  label,
  setup,
  studio,
  onChange,
  onRename
}: {
  id: CategoryId;
  label: string;
  setup: TopSetup;
  studio: boolean;
  onChange: Change;
  onRename: (a: Activity) => void;
}) {
  const [adding, setAdding] = useState('');
  const [renameMode, setRenameMode] = useState(false);
  const cat = setup.offerings.categories[id];
  const on = Boolean(cat?.on);
  const range = cat ? { min: cat.min, max: cat.max } : defaultRange();
  const items = allTopActivities(setup.offerings).filter((a) => a.category === id && available(a, setup.settings, studio));

  const setCategory = (patch: Partial<CategoryOffering>) =>
    onChange((o) => ({ ...o, categories: { ...o.categories, [id]: { on, ...range, ...o.categories[id], ...patch } } }));

  const toggleActivity = (a: Activity) =>
    onChange((o) => ({ ...o, activities: { ...o.activities, [a.id]: !isOffered({ ...setup, offerings: o }, a, studio) } }));

  function addOwn() {
    const label = adding.trim();
    if (!label) return;
    const activity: Activity = { id: `custom-${crypto.randomUUID()}`, label, category: id, custom: true };
    onChange((o) => ({ ...o, custom: [...o.custom, activity] }));
    setAdding('');
  }

  const removeOwn = (a: Activity) =>
    onChange((o) => {
      const { [a.id]: _gone, ...rest } = o.activities;
      return { ...o, custom: o.custom.filter((x) => x.id !== a.id), activities: rest };
    });

  return (
    <section className="card stack" style={{ gap: 12 }} aria-label={label}>
      <SettingSwitch label={label} description={intro[id]} checked={on} onChange={(next) => setCategory({ on: next })} />
      {on && (
        <>
          <div className="field">
            <span className="field-label" style={{ fontSize: 16 }}>
              How far you go: <strong>{rangeText(range)}</strong>
            </span>
            <RangePair
              label={`How far you go with ${label.toLowerCase()}`}
              min={DEGREE_RANGE.min}
              max={DEGREE_RANGE.max}
              low={range.min}
              high={range.max}
              ends={[degreeEnds.low, degreeEnds.high]}
              onChange={(min, max) => setCategory(clampRange({ min, max }))}
            />
          </div>
          <fieldset className="field">
            <legend className="field-label" style={{ fontSize: 16 }}>
              What you offer
            </legend>
            <span className="field-hint">
              {renameMode
                ? 'Tap an activity to rename it.'
                : "Tap to turn any off. Press and hold to rename one. Designs only use what's on here and a yes from your partner."}
            </span>
            <div className="chips">
              {items.map((a) => (
                <ActivityChip
                  key={a.id}
                  activity={a}
                  pressed={isOffered(setup, a, studio)}
                  onTap={() => (renameMode ? onRename(a) : toggleActivity(a))}
                  onHold={() => onRename(a)}
                />
              ))}
            </div>
            <button
              type="button"
              className="btn btn-quiet"
              style={{ alignSelf: 'flex-start' }}
              aria-pressed={renameMode}
              onClick={() => setRenameMode((m) => !m)}
            >
              {renameMode ? 'Done renaming' : 'Rename activities'}
            </button>
          </fieldset>
          {items.some((a) => a.edge) && (
            <p className="note" style={{ margin: 0 }}>
              Edge play is never added to a design automatically and always needs explicit negotiation.
            </p>
          )}
          {setup.offerings.custom.some((a) => a.category === id) && (
            <div className="stack" style={{ gap: 6 }}>
              <span className="field-label" style={{ fontSize: 16 }}>
                Your own
              </span>
              {setup.offerings.custom
                .filter((a) => a.category === id)
                .map((a) => (
                  <div key={a.id} className="person">
                    <span>{a.label}</span>
                    <button type="button" className="btn btn-quiet" onClick={() => removeOwn(a)} aria-label={`Remove ${a.label}`}>
                      Remove
                    </button>
                  </div>
                ))}
            </div>
          )}
          <div className="field">
            <label className="field-label" style={{ fontSize: 16 }} htmlFor={`add-${id}`}>
              Add your own
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id={`add-${id}`}
                className="input"
                maxLength={60}
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addOwn();
                  }
                }}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-secondary" onClick={addOwn} disabled={!adding.trim()}>
                Add
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/** A chip that toggles on tap and asks to rename on press and hold. */
function ActivityChip({ activity: a, pressed, onTap, onHold }: { activity: Activity; pressed: boolean; onTap: () => void; onHold: () => void }) {
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(false);
  const start = useRef({ x: 0, y: 0 });

  const cancel = () => window.clearTimeout(timer.current);

  return (
    <button
      type="button"
      className="chip"
      aria-pressed={pressed}
      style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
      onPointerDown={(e) => {
        held.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        cancel();
        timer.current = window.setTimeout(() => {
          held.current = true;
          onHold();
        }, HOLD_MS);
      }}
      onPointerMove={(e) => {
        if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => {
        // A long press on a phone, or a right click: rename instead of a menu.
        e.preventDefault();
        cancel();
        if (!held.current) {
          held.current = true;
          onHold();
        }
      }}
      onClick={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        onTap();
      }}
    >
      {a.label}
      {a.edge ? ' (edge)' : ''}
      {a.negotiatedOnly ? ' (negotiated)' : ''}
    </button>
  );
}

function RenameSheet({ activity, onChange, onClose }: { activity: Activity; onChange: Change; onClose: () => void }) {
  const [name, setName] = useState(activity.label);
  const original = builtIn.find((b) => b.id === activity.id)?.label;
  const renamed = original !== undefined && original !== activity.label;

  function save(next: string) {
    const label = next.trim();
    if (!label) return;
    onChange((o) => {
      if (activity.custom) return { ...o, custom: o.custom.map((c) => (c.id === activity.id ? { ...c, label } : c)) };
      const { [activity.id]: _old, ...rest } = o.renames;
      return { ...o, renames: label === original ? rest : { ...rest, [activity.id]: label } };
    });
    onClose();
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="rename-title">
      <div className="sheet">
        <h2 id="rename-title">Rename {activity.label}</h2>
        <p style={{ margin: 0 }}>Use the words that fit you and your partners. Ember uses your name for it from now on.</p>
        <TextInput label="Name" value={name} max={60} onChange={setName} />
        <button type="button" className="btn btn-primary btn-block" disabled={!name.trim()} onClick={() => save(name)}>
          Save name
        </button>
        {renamed && (
          <button type="button" className="btn btn-outline btn-block" onClick={() => save(original)}>
            Back to "{original}"
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
