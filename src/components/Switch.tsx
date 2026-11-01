import { useId } from 'react';

interface SettingSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A labeled on/off row. The whole label is announced with the switch. */
export function SettingSwitch({ label, description, checked, onChange }: SettingSwitchProps) {
  const id = useId();
  return (
    <div className="setting">
      <div>
        <div className="setting-label" id={`${id}-label`}>
          {label}
        </div>
        {description && (
          <div className="setting-desc" id={`${id}-desc`}>
            {description}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        className="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}
