import type { PhaseType } from '../../content/phases';

// The scene data model (M4): Scene > Phase > Beat > Step, as in
// intake-and-data-model.md. Pure data, no UI, so the rules engine can be
// tested on its own.

export type ArcShape = 'climb' | 'twin' | 'waves';

export type RequestStatus = 'sent' | 'accepted' | 'declined';

/** What kind of beat this is, where the rules care. */
export type BeatKind = 'regular' | 'warmup' | 'recovery' | 'ritual' | 'landing' | 'named' | 'immediate' | 'settled' | 'closing';

export type FlagKind = 'warning' | 'info' | 'watch' | 'partner';

export interface Flag {
  kind: FlagKind;
  text: string;
  /** Watch tags: red for urgent, amber for monitor. */
  urgent?: boolean;
}

export interface Step {
  id: string;
  /** The activity from the intake this step uses, if any. */
  activityId: string | null;
  do: string;
  say: string;
  watch: string;
  notes: string;
  gearId: string | null;
  surprise: boolean;
}

export interface Beat {
  id: string;
  kind: BeatKind;
  /** The goal, in one line. */
  title: string;
  minutes: number;
  /** 1 to 10. */
  intensity: number;
  areas: string[];
  positions: string[];
  flags: Flag[];
  steps: Step[];
}

export interface Phase {
  id: string;
  type: PhaseType;
  beats: Beat[];
}

/** Why something outside the bottom's yes items is in the scene. */
export type OverrideKind = 'no' | 'edge' | 'negotiated';

/**
 * A confirmed override, dated. "No" overrides exist only when the bottom
 * allows them; edge play and negotiated-only items need the Top to confirm
 * they were negotiated for this scene.
 */
export interface Override {
  activityId: string;
  kind: OverrideKind;
  confirmedAt: string;
}

/** A warn rule the Top chose to keep anyway, with their reason. */
export interface Kept {
  reason: string;
  at: string;
}

export interface Pick {
  activityId: string;
  /** How far to take it, 1 to 10. */
  intensity: number;
  surprise: boolean;
}

export interface Scene {
  v: 1;
  id: string;
  title: string;
  /** The connection this scene is for; null for a library design. */
  connectionId: string | null;
  partnerId: string | null;
  partnerName: string;
  /** Which role the designer plays in this scene. */
  role: 'top' | 'bottom';
  date: string;
  startTime: string;
  /** Play time, before aftercare. */
  minutes: number;
  location: string;
  isPublic: boolean;
  intense: boolean;
  /** The intake version this was designed from. */
  intakeVersion: number | null;
  /** Marks setting confirmed for this scene: none, day, week or open. */
  marks: string;
  useSpecificGear: boolean;
  gearIds: string[];
  picks: Pick[];
  notes: string;
  shape: ArcShape;
  phases: Phase[];
  overrides: Override[];
  /** Warn rules kept anyway, by issue key. */
  kept: Record<string, Kept>;
  /** A next-morning check-in, required after subspace or cathartic release. */
  nextMorningCheckIn: boolean;
  inLibrary: boolean;
  /** On a design sent to the partner as a request: which one, and its answer. */
  request?: { id: string; sentAt: string; status: RequestStatus };
  /** On a design accepted from a partner's request: who designed it. */
  fromRequest?: { by: string; at: string };
  createdAt: string;
  updatedAt: string;
}

let counter = 0;
/** Short ids for phases, beats and steps, unique within a scene. */
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function newStep(patch: Partial<Step> = {}): Step {
  return { id: newId('s'), activityId: null, do: '', say: '', watch: '', notes: '', gearId: null, surprise: false, ...patch };
}

export function newBeat(patch: Partial<Beat> = {}): Beat {
  return { id: newId('b'), kind: 'regular', title: '', minutes: 5, intensity: 3, areas: [], positions: [], flags: [], steps: [], ...patch };
}

export const sceneMinutes = (scene: Scene) => scene.phases.reduce((n, p) => n + phaseMinutes(p), 0);
export const phaseMinutes = (phase: Phase) => phase.beats.reduce((n, b) => n + b.minutes, 0);

/** Every beat in order, with its phase. */
export function beatsInOrder(scene: Scene): { phase: Phase; beat: Beat; index: number }[] {
  const out: { phase: Phase; beat: Beat; index: number }[] = [];
  for (const phase of scene.phases) for (const beat of phase.beats) out.push({ phase, beat, index: out.length });
  return out;
}

export function peakCount(scene: Scene): number {
  return scene.phases.filter((p) => p.type === 'peak').length;
}
