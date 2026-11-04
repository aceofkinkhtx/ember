import { useEffect, useMemo, useState } from 'react';
import { readSharedProfile } from '../lib/intake';
import type { RuleContext } from '../lib/scene/rules';
import { listMyToys, listOptOuts, type Toy } from '../lib/toys';
import { useAccount } from './account';
import { useSettings } from './settings';

// Everything the rules engine needs for one scene: the partner's shared
// intake, the Top's setup, Studio mode, and the designer's gear with any kept
// out of scenes with this person.

export interface SceneData {
  ctx: RuleContext;
  intakeVersion: number | null;
  gear: Toy[];
}

export function useSceneData(connectionId: string | null, partnerId: string | null): SceneData | null | undefined {
  const { keys } = useAccount();
  const { settings } = useSettings();
  const [loaded, setLoaded] = useState<Omit<SceneData, 'ctx'> & { intake: RuleContext['intake']; optedOut: string[] } | null | undefined>(undefined);

  useEffect(() => {
    if (!keys) return;
    let live = true;
    Promise.all([
      partnerId ? readSharedProfile(keys, partnerId).catch(() => null) : Promise.resolve(null),
      listMyToys(keys).catch(() => [] as Toy[]),
      listOptOuts().catch(() => [])
    ])
      .then(([profile, gear, outs]) => {
        if (!live) return;
        setLoaded({
          intake: profile?.intake ?? null,
          intakeVersion: profile?.version ?? null,
          gear,
          optedOut: outs.filter((o) => o.connectionId === connectionId).map((o) => o.toyId)
        });
      })
      .catch(() => live && setLoaded(null));
    return () => {
      live = false;
    };
  }, [keys, connectionId, partnerId]);

  // The same object until something it depends on changes, so screens can
  // react to it without redrawing forever.
  const studio = settings.depth === 'studio';
  return useMemo(() => {
    if (!loaded) return loaded;
    return {
      intakeVersion: loaded.intakeVersion,
      gear: loaded.gear,
      ctx: {
        intake: loaded.intake,
        top: settings.top,
        studio,
        optedOutGear: loaded.optedOut,
        gear: loaded.gear.map((g) => ({ id: g.id, name: g.name, feel: g.feel, types: g.types }))
      }
    };
  }, [loaded, settings.top, studio]);
}
