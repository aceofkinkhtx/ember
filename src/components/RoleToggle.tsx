import { useNavigate } from 'react-router-dom';
import { roleLabel, type Role } from '../content/copy';
import { useSettings } from '../state/settings';

/** Switch between the Top and bottom views. Shown only to people who chose both. */
export function RoleToggle() {
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  if (settings.roles !== 'both') return null;

  const pick = (role: Role) => {
    update({ activeRole: role });
    navigate('/');
  };

  return (
    <div className="segmented" role="radiogroup" aria-label="View">
      {(['top', 'bottom'] as const).map((role) => (
        <button key={role} type="button" role="radio" aria-checked={settings.activeRole === role} onClick={() => pick(role)}>
          {roleLabel(role, settings.discreet)}
        </button>
      ))}
    </div>
  );
}
