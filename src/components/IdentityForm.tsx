import { genderIdentities, pronounChoices, type Identity } from '../content/identity';

interface IdentityFormProps {
  value: Identity;
  /** Receives a change to apply to the latest answers, so quick taps never overwrite each other. */
  onChange: (change: (prev: Identity) => Identity) => void;
}

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** Name, pronouns and gender identity. Every part is optional. */
export function IdentityForm({ value, onChange }: IdentityFormProps) {
  const set = (patch: (prev: Identity) => Partial<Identity>) => onChange((prev) => ({ ...prev, ...patch(prev) }));

  return (
    <div className="stack" style={{ gap: 20 }}>
      <label className="field">
        <span className="field-label">What should people call you?</span>
        <span className="field-hint">A first name, scene name or nickname.</span>
        <input
          className="input"
          type="text"
          autoComplete="nickname"
          maxLength={40}
          value={value.name}
          onChange={(e) => set(() => ({ name: e.target.value }))}
        />
      </label>

      <fieldset className="field">
        <legend className="field-label">Your pronouns</legend>
        <span className="field-hint">Pick any that fit. Ember uses these whenever it talks about you.</span>
        <div className="chips">
          {pronounChoices.map((p) => (
            <button
              key={p.id}
              type="button"
              className="chip"
              aria-pressed={value.pronouns.includes(p.id)}
              onClick={() => set((prev) => ({ pronouns: toggle(prev.pronouns, p.id) }))}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          className="input"
          type="text"
          maxLength={40}
          placeholder="Or in your own words, like xe/xem"
          aria-label="Pronouns in your own words"
          value={value.pronounsCustom}
          onChange={(e) => set(() => ({ pronounsCustom: e.target.value }))}
        />
      </fieldset>

      <fieldset className="field">
        <legend className="field-label">Your gender identity</legend>
        <span className="field-hint">Optional. Pick as many as fit, or skip it. This never changes which activities you see.</span>
        <div className="chips">
          {genderIdentities.map((g) => (
            <button
              key={g}
              type="button"
              className="chip"
              aria-pressed={value.genders.includes(g)}
              onClick={() => set((prev) => ({ genders: toggle(prev.genders, g) }))}
            >
              {g}
            </button>
          ))}
        </div>
        <input
          className="input"
          type="text"
          maxLength={60}
          placeholder="Or describe it yourself"
          aria-label="Gender identity in your own words"
          value={value.genderCustom}
          onChange={(e) => set(() => ({ genderCustom: e.target.value }))}
        />
      </fieldset>
    </div>
  );
}
