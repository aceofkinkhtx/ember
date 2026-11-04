import { useState } from 'react';
import { categories, type Activity, type CategoryId } from '../../data/activities';
import {
  allTopActivities,
  available,
  degreeLabels,
  isOffered,
  type Degree,
  type Offerings,
  type TopSetup
} from '../../content/topSetup';
import { SettingSwitch } from '../Switch';

// O4 and Me > Offerings: what this Top does, and to what degree. Each category
// is a switch with a degree slider; inside it, every activity is a chip that is
// on unless the Top turns it off. Edge play shows only in Studio mode, and
// penile or oral sex only when the Top allows it in their settings.

const intro: Record<CategoryId, string> = {
  bondage: 'Restraint, from blindfolds and cuffs to rope and furniture.',
  sensation: 'Wax, biting, tickling, scratching, electricity and more.',
  impact: 'Hands, paddles, floggers, canes and whips.',
  touch: 'Cuddling, kissing and intimate touch.',
  penetration: 'Fingers, toys, and penis or strap-on.'
};

export function OfferingsEditor({
  setup,
  studio,
  onChange
}: {
  setup: TopSetup;
  studio: boolean;
  onChange: (change: (o: Offerings) => Offerings) => void;
}) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      {categories.map((c) => (
        <CategoryCard key={c.id} id={c.id} label={c.label} setup={setup} studio={studio} onChange={onChange} />
      ))}
    </div>
  );
}

function CategoryCard({
  id,
  label,
  setup,
  studio,
  onChange
}: {
  id: CategoryId;
  label: string;
  setup: TopSetup;
  studio: boolean;
  onChange: (change: (o: Offerings) => Offerings) => void;
}) {
  const [adding, setAdding] = useState('');
  const cat = setup.offerings.categories[id];
  const on = Boolean(cat?.on);
  const degree = cat?.degree ?? 3;
  const items = allTopActivities(setup.offerings).filter((a) => a.category === id && available(a, setup.settings, studio));

  const setCategory = (patch: Partial<{ on: boolean; degree: Degree }>) =>
    onChange((o) => ({ ...o, categories: { ...o.categories, [id]: { on, degree, ...o.categories[id], ...patch } } }));

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
          <label className="field">
            <span className="field-label" style={{ fontSize: 16 }}>
              How far you go: <strong>{degreeLabels[degree]}</strong>
            </span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={degree}
              aria-valuetext={degreeLabels[degree]}
              onChange={(e) => setCategory({ degree: Number(e.target.value) as Degree })}
            />
            <span className="note" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{degreeLabels[1]}</span>
              <span>{degreeLabels[5]}</span>
            </span>
          </label>
          <fieldset className="field">
            <legend className="field-label" style={{ fontSize: 16 }}>
              What you offer
            </legend>
            <span className="field-hint">Tap to turn any off. Designs only use what's on here and a yes from your partner.</span>
            <div className="chips">
              {items.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="chip"
                  aria-pressed={isOffered(setup, a, studio)}
                  onClick={() => toggleActivity(a)}
                >
                  {a.label}
                  {a.edge ? ' (edge)' : ''}
                  {a.negotiatedOnly ? ' (negotiated)' : ''}
                </button>
              ))}
            </div>
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
