import { phaseColors, phaseLabels, secondPeakColor } from '../../content/phases';
import { beatsInOrder, peakCount, sceneMinutes, type Phase, type Scene } from '../../lib/scene/model';
import { useId } from 'react';
import { useSettings } from '../../state/settings';
import { waveArea, wavePath } from './wave';

// The scene map: a smooth intensity wave tinted by phase, and the phase strip
// under it. Colors come from the Top's own phase colors.

function usePhaseColor() {
  const { settings } = useSettings();
  const colors = phaseColors(settings.top.settings.phaseColors);
  return (scene: Scene, phase: Phase) => {
    if (phase.type !== 'peak') return colors[phase.type];
    const nth = scene.phases.filter((p) => p.type === 'peak').indexOf(phase);
    return nth > 0 ? (settings.top.settings.phaseColors.peak ? colors.peak : secondPeakColor) : colors.peak;
  };
}

export function MiniCurve({ scene, height = 64 }: { scene: Scene; height?: number }) {
  const colorOf = usePhaseColor();
  const total = Math.max(1, sceneMinutes(scene));
  const width = 300;
  let t = 0;
  const clip = useId();
  const segments = beatsInOrder(scene).map(({ phase, beat }) => {
    const x0 = (t / total) * width;
    t += beat.minutes;
    const x1 = (t / total) * width;
    const y = height - 4 - ((beat.intensity - 1) / 9) * (height - 8);
    return { x0, x1, y, color: colorOf(scene, phase) };
  });
  const points = segments.map((s) => ({ x: (s.x0 + s.x1) / 2, y: s.y }));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <clipPath id={clip}>
          <path d={waveArea(points, width, height)} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {segments.map((s, i) => (
          <rect key={i} x={s.x0} y={0} width={Math.max(0, s.x1 - s.x0)} height={height} fill={s.color} opacity={0.22} />
        ))}
      </g>
      <path d={wavePath(points, width)} fill="none" stroke="var(--text)" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function PhaseStrip({ scene }: { scene: Scene }) {
  const colorOf = usePhaseColor();
  const total = Math.max(1, sceneMinutes(scene));
  return (
    <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden' }} aria-hidden="true">
      {scene.phases.map((p) => (
        <span
          key={p.id}
          title={phaseLabels[p.type]}
          style={{ flex: `${p.beats.reduce((n, b) => n + b.minutes, 0) / total}`, background: colorOf(scene, p) }}
        />
      ))}
    </div>
  );
}

export function sceneFacts(scene: Scene): string {
  const minutes = sceneMinutes(scene);
  const peaks = peakCount(scene);
  const time = minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ''}`.trim() : `${minutes} min`;
  return `${time} with aftercare, ${peaks} ${peaks === 1 ? 'peak' : 'peaks'}`;
}

export { usePhaseColor };
