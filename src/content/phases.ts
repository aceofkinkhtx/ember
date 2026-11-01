// Phase types and their default colors. Every Top can change any color in
// their settings (M3); these defaults are what a new Top starts with.
// All colors keep white text at 4.5:1 contrast or better.

export type PhaseType = 'arrival' | 'ritual' | 'build' | 'peak' | 'recovery' | 'descent' | 'close' | 'aftercare';

export const phaseLabels: Record<PhaseType, string> = {
  arrival: 'Arrival',
  ritual: 'Ritual',
  build: 'Build',
  peak: 'Peak',
  recovery: 'Recovery',
  descent: 'Descent',
  close: 'Close',
  aftercare: 'Aftercare'
};

export const defaultPhaseColors: Record<PhaseType, string> = {
  arrival: '#8B6000', // amber
  ritual: '#5A005A', // purple
  build: '#8A3A0E', // burnt orange, the climb between arrival and peak
  peak: '#2E6B2E', // green (first peak)
  recovery: '#4A4A4A', // gray
  descent: '#3E3A6B', // dusk indigo, the deliberate way down
  close: '#0B4F52', // deep teal, the ending named aloud
  aftercare: '#8B0000' // deep red
};

/** A later peak uses blue so two peaks are easy to tell apart. */
export const secondPeakColor = '#1A3A6B';

export type PhaseColors = Record<PhaseType, string>;

/** A Top's colors: their overrides on top of the defaults. */
export function phaseColors(overrides: Partial<PhaseColors> = {}): PhaseColors {
  return { ...defaultPhaseColors, ...overrides };
}
