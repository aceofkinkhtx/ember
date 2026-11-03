import { useId } from 'react';

/** The ember glyph: the app icon's glowing coal without its dark tile. */
export function EmberGlyph({ size = 24 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="96 64 328 340" aria-hidden="true" className="mark-glyph">
      <defs>
        <radialGradient id={`${id}h`} cx="48%" cy="52%" r="62%">
          <stop offset="0%" stopColor="#FFE2A8" />
          <stop offset="22%" stopColor="#FFB347" />
          <stop offset="55%" stopColor="#FF6A1F" />
          <stop offset="100%" stopColor="#C2300A" />
        </radialGradient>
        <clipPath id={`${id}c`}>
          <path d="M124 318 C112 268 146 214 206 200 C246 190 270 168 318 176 C378 186 404 236 394 290 C386 338 344 372 286 378 C226 384 138 370 124 318 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}c)`}>
        <rect x="100" y="150" width="320" height="250" fill={`url(#${id}h)`} />
        <g fill="#7A2410">
          <path d="M104 300 L146 210 L218 192 L236 260 L180 322 Z" />
          <path d="M248 182 L322 162 L360 222 L306 254 L254 244 Z" />
          <path d="M370 210 L414 246 L404 330 L344 322 L322 266 Z" />
          <path d="M184 336 L244 280 L306 296 L330 340 L274 396 L176 396 Z" />
          <path d="M104 334 L170 330 L168 396 L100 396 Z" />
          <path d="M342 338 L410 340 L386 396 L290 396 Z" />
        </g>
      </g>
      <g fill="#FF8A2A">
        <circle cx="300" cy="132" r="12" />
        <circle cx="226" cy="112" r="9" />
        <circle cx="338" cy="84" r="7" />
      </g>
    </svg>
  );
}

export function EmberMark({ large = false }: { large?: boolean }) {
  return (
    <span className={large ? 'mark mark-large' : 'mark'}>
      <EmberGlyph size={large ? 48 : 30} />
      ember
    </span>
  );
}
