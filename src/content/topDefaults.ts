// Top settings defaults (A.C.E. profile). Each Top can change these, within
// the limits the safety floor sets.

export const aftercare = {
  /** Share of scene length for regular scenes. */
  defaultPercent: 25,
  /** Share of scene length for scenes marked intense. */
  intensePercent: 33,
  /** No Top setting can go below this for a scene marked intense. */
  intenseMinimumMinutes: 30
};

/** Aftercare minutes for a scene, never below the intense minimum. */
export function aftercareMinutes(sceneMinutes: number, intense: boolean, percent?: number): number {
  const share = percent ?? (intense ? aftercare.intensePercent : aftercare.defaultPercent);
  const minutes = Math.round((sceneMinutes * share) / 100);
  return intense ? Math.max(minutes, aftercare.intenseMinimumMinutes) : minutes;
}
