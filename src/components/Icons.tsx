import type { TabId } from '../content/copy';

// Line icons drawn from the prototype's tab bar. Decorative: labels carry meaning.

const common = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true
};

export function TabIcon({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
        </svg>
      );
    case 'connections':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.5" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 20c0-2.5 1.5-4.5 4-4.5" />
        </svg>
      );
    case 'scenes':
      return (
        <svg {...common}>
          <path d="M3 17c3 0 4-10 7-10s3 8 6 8 3-6 5-6" />
        </svg>
      );
    case 'toys':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M4 14l5-4 4 3 3-2 4 3" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...common}>
          <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />
        </svg>
      );
    case 'me':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      );
  }
}

export function RoleIcon({ kind }: { kind: 'top' | 'bottom' | 'both' }) {
  if (kind === 'top')
    return (
      <svg {...common}>
        <path d="M12 3l3 6 6 .9-4.5 4.3 1 6.3L12 17.5 6.5 20.5l1-6.3L3 9.9 9 9z" />
      </svg>
    );
  if (kind === 'bottom')
    return (
      <svg {...common}>
        <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M7 7h11l-3-3M17 17H6l3 3" />
    </svg>
  );
}

