import { useCallback, useEffect, useMemo, useState } from 'react';
import { emptyTopSetup, type TopSetup } from '../content/topSetup';
import type { StoredKeys } from '../lib/account';
import { listVersions, readSharedProfile, type Intake } from '../lib/intake';
import type { RuleContext } from '../lib/scene/rules';
import { listMyToys, listOptOuts, readTheirToys, type Toy } from '../lib/toys';
import { useAccount } from './account';
import { useSettings, type Settings } from './settings';

// Everything the rules engine needs for one scene.
//
// Designing as the Top: the partner's shared intake and the Top's own setup.
// Designing as the bottom (a request for the Top): the bottom's own latest
// intake, with every category open, since the Top's offerings aren't shared.
// The Top's own rules apply in full when they accept it.
//
// Gear: your own, plus the partner's shared gear once you ask to see it.
// Gear either of you keeps out of scenes with the other is left out.

export interface SceneData {
  ctx: RuleContext;
  intakeVersion: number | null;
  /** Your gear, then theirs once shown. */
  gear: Toy[];
  theirGearShown: boolean;
}

/** Every category open, sex acts allowed to be proposed: the Top decides on accepting. */
export function openSetup(): TopSetup {
  const top = emptyTopSetup();
  for (const c of ['bondage', 'sensation', 'impact', 'touch', 'penetration'] as const) top.offerings.categories[c] = { on: true, min: 1, max: 10 };
  top.settings.allowNegotiatedSex = true;
  return top;
}

interface Loaded {
  intake: Intake | null;
  intakeVersion: number | null;
  gear: Toy[];
  theirs: Toy[] | null;
  optedOut: string[];
}

async function load(keys: StoredKeys, connectionId: string | null, partnerId: string | null, role: 'top' | 'bottom'): Promise<Loaded> {
  const [intake, gear, outs] = await Promise.all([
    role === 'bottom'
      ? listVersions(keys)
          .then((v) => (v[0] ? { intake: v[0].intake, version: v[0].version } : null))
          .catch(() => null)
      : partnerId
        ? readSharedProfile(keys, partnerId)
            .then((p) => (p ? { intake: p.intake, version: p.version } : null))
            .catch(() => null)
        : Promise.resolve(null),
    listMyToys(keys).catch(() => [] as Toy[]),
    listOptOuts().catch(() => [])
  ]);
  return {
    intake: intake?.intake ?? null,
    intakeVersion: intake?.version ?? null,
    gear,
    theirs: null,
    optedOut: outs.filter((o) => o.connectionId === connectionId).map((o) => o.toyId)
  };
}

function toData(loaded: Loaded, settings: Settings, role: 'top' | 'bottom'): SceneData {
  const gear = [...loaded.gear, ...(loaded.theirs ?? [])];
  return {
    intakeVersion: loaded.intakeVersion,
    gear,
    theirGearShown: loaded.theirs !== null,
    ctx: {
      intake: loaded.intake,
      top: role === 'bottom' ? openSetup() : settings.top,
      studio: settings.depth === 'studio',
      optedOutGear: loaded.optedOut,
      gear: gear.map((g) => ({ id: g.id, name: g.name, feel: g.feel, types: g.types }))
    }
  };
}

/** Loads the rule context for designing with someone, outside a screen (for reuse). */
export async function loadSceneData(keys: StoredKeys, settings: Settings, connectionId: string, partnerId: string, role: 'top' | 'bottom'): Promise<SceneData> {
  return toData(await load(keys, connectionId, partnerId, role), settings, role);
}

export function useSceneData(
  connectionId: string | null,
  partnerId: string | null,
  role: 'top' | 'bottom' = 'top'
): { data: SceneData | null | undefined; showTheirGear: () => Promise<number> } {
  const { keys } = useAccount();
  const { settings } = useSettings();
  const [loaded, setLoaded] = useState<Loaded | null | undefined>(undefined);

  useEffect(() => {
    if (!keys) return;
    let live = true;
    setLoaded(undefined);
    load(keys, connectionId, partnerId, role)
      .then((l) => live && setLoaded(l))
      .catch(() => live && setLoaded(null));
    return () => {
      live = false;
    };
  }, [keys, connectionId, partnerId, role]);

  /** Loads the partner's shared gear; returns how many pieces they share. */
  const showTheirGear = useCallback(async () => {
    if (!keys || !partnerId) return 0;
    const got = await readTheirToys(keys, partnerId).catch(() => null);
    const theirs = got?.toys ?? [];
    setLoaded((l) => (l ? { ...l, theirs } : l));
    return theirs.length;
  }, [keys, partnerId]);

  // The same object until something it depends on changes, so screens can
  // react to it without redrawing forever.
  const data = useMemo(() => (loaded ? toData(loaded, settings, role) : loaded), [loaded, settings, role]);
  return { data, showTheirGear };
}
