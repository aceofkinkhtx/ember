import type { ReactNode } from 'react';
import { phaseColors, phaseLabels, secondPeakColor } from '../../content/phases';
import type { SceneVibe, VibeKind } from '../../lib/scene/vibe';

// SceneVibe (BS2): the shape of a planned scene. The curve is drawn in the
// Top's phase colors; above it, one shape and color per kind of play, and a
// question mark for each surprise.

export const kindLabels: Record<VibeKind, string> = {
  impact: 'Impact',
  sensation: 'Sensation',
  bondage: 'Restraint',
  touch: 'Touch',
  digital: 'Fingers',
  penetration: 'Penetration',
  surprise: 'A surprise'
};

const kindColors: Record<VibeKind, string> = {
  impact: '#B8400C',
  sensation: '#C98A12',
  bondage: '#0B5D61',
  touch: '#B5446E',
  digital: '#5A3E9B',
  penetration: '#8E1B3B',
  surprise: '#1E1418'
};

/** One marker shape, centered on (x, y). */
export function KindShape({ kind, x = 0, y = 0, r = 8 }: { kind: VibeKind; x?: number; y?: number; r?: number }) {
  const fill = kindColors[kind];
  switch (kind) {
    case 'impact':
      return <polygon points={`${x},${y - r} ${x + r},${y + r * 0.8} ${x - r},${y + r * 0.8}`} fill={fill} />;
    case 'sensation': {
      const p = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (Math.PI / 4) * i - Math.PI / 2;
        const rr = i % 2 ? r * 0.42 : r;
        return `${x + Math.cos(a) * rr},${y + Math.sin(a) * rr}`;
      });
      return <polygon points={p.join(' ')} fill={fill} />;
    }
    case 'bondage':
      return <rect x={x - r * 0.8} y={y - r * 0.8} width={r * 1.6} height={r * 1.6} rx={r * 0.25} fill="none" stroke={fill} strokeWidth={r * 0.35} />;
    case 'touch':
      return <circle cx={x} cy={y} r={r * 0.85} fill={fill} />;
    case 'digital':
      return <polygon points={`${x},${y - r} ${x + r * 0.8},${y} ${x},${y + r} ${x - r * 0.8},${y}`} fill={fill} />;
    case 'penetration': {
      const p = [0, 1, 2, 3, 4, 5].map((i) => {
        const a = (Math.PI / 3) * i;
        return `${x + Math.cos(a) * r * 0.9},${y + Math.sin(a) * r * 0.9}`;
      });
      return <polygon points={p.join(' ')} fill={fill} />;
    }
    case 'surprise':
      return (
        <g>
          <circle cx={x} cy={y} r={r} fill="#E8A33A" stroke={fill} strokeWidth={1.5} strokeDasharray="3 2" />
          <text x={x} y={y + r * 0.42} textAnchor="middle" fontSize={r * 1.25} fontWeight={700} fill={fill}>
            ?
          </text>
        </g>
      );
  }
}

function colorFor(vibe: SceneVibe, phase: SceneVibe['segments'][number]) {
  const colors = phaseColors(vibe.colors);
  if (phase.phase === 'peak' && phase.peakNo > 1) return vibe.colors.peak ? colors.peak : secondPeakColor;
  return colors[phase.phase];
}

/** The curve and its markers. Small enough for a card, clear enough on its own. */
export function VibeCurve({ vibe, height = 120, markers = true }: { vibe: SceneVibe; height?: number; markers?: boolean }) {
  const width = 320;
  const total = Math.max(1, vibe.minutes);
  const x = (m: number) => (m / total) * width;
  // The calmest beats keep a little height, so every phase color shows.
  const y = (i: number) => 4 + (height - 8) - ((Math.max(i, 1.6) - 1) / 9) * (height - 8);
  const points = vibe.segments.flatMap((s) => [`${x(s.from)},${y(s.intensity)}`, `${x(s.from + s.minutes)},${y(s.intensity)}`]).join(' ');
  // Markers that would overlap move to the next row (up to three rows).
  const rows: number[][] = [[], [], []];
  const placed = [...vibe.markers]
    .sort((a, b) => a.at - b.at)
    .map((m) => {
      const pct = (m.at / total) * 100;
      const row = Math.max(0, rows.findIndex((r) => !r.some((p) => Math.abs(p - pct) < 7)));
      rows[row].push(pct);
      return { m, pct, row };
    });
  const rowCount = Math.max(1, rows.filter((r) => r.length).length);
  return (
    <div role="img" aria-label={vibeSummary(vibe)}>
      {markers && (
        // Markers sit in their own rows, so their shapes never stretch with the curve.
        <div aria-hidden="true" style={{ position: 'relative', height: 4 + rowCount * 20, margin: '0 9px' }}>
          {placed.map(({ m, pct, row }, i) => (
            <svg key={i} width={18} height={18} viewBox="-9 -9 18 18" style={{ position: 'absolute', top: 2 + row * 20, left: `calc(${pct}% - 9px)` }}>
              <KindShape kind={m.kind} r={8} />
            </svg>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block' }}>
        {vibe.segments.map((s, i) => (
          <rect key={i} x={x(s.from)} y={y(s.intensity)} width={Math.max(0, x(s.minutes))} height={height - y(s.intensity)} fill={colorFor(vibe, s)} opacity={0.85} />
        ))}
        <polyline points={points} fill="none" stroke="var(--text)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

/** A spoken version of the picture, for screen readers. */
export function vibeSummary(vibe: SceneVibe): string {
  const peaks = new Set(vibe.segments.filter((s) => s.phase === 'peak').map((s) => s.peakNo)).size;
  const kinds = [...new Set(vibe.markers.filter((m) => m.kind !== 'surprise').map((m) => kindLabels[m.kind].toLowerCase()))];
  return [
    `A ${vibe.minutes} minute scene with ${peaks} ${peaks === 1 ? 'peak' : 'peaks'}`,
    kinds.length ? `including ${kinds.join(', ')}` : '',
    vibe.surprises ? `and ${vibe.surprises === 1 ? 'a surprise' : `${vibe.surprises} surprises`}` : ''
  ]
    .filter(Boolean)
    .join(', ');
}

const fmtTime = (minutes: number) => `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} h ` : ''}${minutes % 60 ? `${minutes % 60} min` : ''}`.trim();

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p style={{ margin: 0 }}>
      <strong>{label}:</strong> {children}
    </p>
  );
}

/** The whole SceneVibe, exactly as the bottom sees it. */
export function VibeView({ vibe }: { vibe: SceneVibe }) {
  const kinds = [...new Set(vibe.markers.map((m) => m.kind))];
  const phases = [...new Set(vibe.segments.map((s) => s.phase))];
  const when = vibe.date ? new Date(`${vibe.date}T${vibe.startTime || '12:00'}`) : null;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <section className="card stack" style={{ gap: 12 }} aria-label="SceneVibe">
        <div className="eyebrow">SceneVibe</div>
        <h2 style={{ margin: 0 }}>{vibe.title}</h2>
        <VibeCurve vibe={vibe} height={150} />
        <div className="chips" aria-label="What the shapes mean" style={{ gap: 10 }}>
          {kinds.map((k) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <svg width={18} height={18} viewBox="-9 -9 18 18" aria-hidden="true">
                <KindShape kind={k} r={8} />
              </svg>
              {kindLabels[k]}
            </span>
          ))}
        </div>
        <div className="chips" aria-label="Phases" style={{ gap: 10 }}>
          {phases.map((p) => (
            <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, background: phaseColors(vibe.colors)[p] }} />
              {phaseLabels[p]}
            </span>
          ))}
        </div>
        {vibe.surprises > 0 && (
          <p className="box box-info">
            {vibe.surprises === 1 ? 'Your Top has a surprise planned.' : `Your Top has ${vibe.surprises} surprises planned.`} You'll know it when it happens.
          </p>
        )}
      </section>

      <section className="card stack" style={{ gap: 6 }} aria-label="Details">
        <Row label="When">
          {when ? when.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Not set yet'}
          {vibe.startTime && when ? `, ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}
        </Row>
        <Row label="How long">
          {fmtTime(vibe.minutes - vibe.aftercareMinutes)}, then {fmtTime(vibe.aftercareMinutes)} of aftercare
        </Row>
        {vibe.location && <Row label="Where">{vibe.location}</Row>}
        <Row label="Setting">{vibe.isPublic ? 'Public or at a party' : 'Private'}</Row>
        {vibe.intense && <p className="note" style={{ margin: 0 }}>This one is planned as intense, with extra aftercare.</p>}
      </section>

      {vibe.prepare && (
        <section className="card stack" style={{ gap: 6 }} aria-label="To bring or prepare">
          <div className="eyebrow">To bring or prepare</div>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{vibe.prepare}</p>
        </section>
      )}

      <section className="card stack" style={{ gap: 6 }} aria-label="Aftercare">
        <div className="eyebrow">Aftercare</div>
        <p style={{ margin: 0 }}>
          {fmtTime(vibe.aftercareMinutes)}
          {vibe.aftercare.length ? `: ${vibe.aftercare.join(', then ').toLowerCase()}` : ''}, and more if you need it.
        </p>
      </section>
    </div>
  );
}
