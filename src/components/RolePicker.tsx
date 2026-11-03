import { useId } from 'react';
import { roleLabel, type RoleChoice } from '../content/copy';
import type { Role } from '../lib/account';

const roles: Role[] = ['top', 'bottom', 'switch'];

/** Your usual role from setup, as a starting point for a new connection. */
export function usualRole(roles: RoleChoice | null): Role {
  return roles === 'top' || roles === 'bottom' ? roles : 'switch';
}

/** Top, bottom or switch. Switch means either way, decided scene by scene. */
export function RolePicker({
  label,
  value,
  onChange,
  discreet
}: {
  label: string;
  value: Role;
  onChange: (role: Role) => void;
  discreet: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <span className="field-label" id={id}>
        {label}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby={id} style={{ alignSelf: 'flex-start' }}>
        {roles.map((r) => (
          <button key={r} type="button" role="radio" aria-checked={value === r} onClick={() => onChange(r)}>
            {roleLabel(r, discreet).replace(/^./, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>
    </div>
  );
}
