import { useCallback, useEffect, useMemo, useState } from 'react';
import { emptyTopSetup } from '../content/topSetup';
import { listVersions, readSharedProfile } from '../lib/intake';
import { listMyToys, listOptOuts, readTheirToys } from '../lib/toys';
import { useAccount } from './account';
import { useSettings } from './settings';
/** Every category open, sex acts allowed to be proposed: the Top decides on accepting. */
export function openSetup() {
    const top = emptyTopSetup();
    for (const c of ['bondage', 'sensation', 'impact', 'touch', 'penetration'])
        top.offerings.categories[c] = { on: true, min: 1, max: 10 };
    top.settings.allowNegotiatedSex = true;
    return top;
}
async function load(keys, connectionId, partnerId, role) {
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
        listMyToys(keys).catch(() => []),
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
function toData(loaded, settings, role, partnerId) {
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
            gear: gear.map((g) => ({ id: g.id, name: g.name, feel: g.feel, types: g.types })),
            intakeOf: role === 'bottom' ? 'self' : partnerId ? 'partner' : 'none'
        }
    };
}
/** Loads the rule context for designing with someone, outside a screen (for reuse). */
export async function loadSceneData(keys, settings, connectionId, partnerId, role) {
    return toData(await load(keys, connectionId, partnerId, role), settings, role, partnerId);
}
export function useSceneData(connectionId, partnerId, role = 'top') {
    const { keys } = useAccount();
    const { settings } = useSettings();
    const [loaded, setLoaded] = useState(undefined);
    useEffect(() => {
        if (!keys)
            return;
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
        if (!keys || !partnerId)
            return 0;
        const got = await readTheirToys(keys, partnerId).catch(() => null);
        const theirs = got?.toys ?? [];
        setLoaded((l) => (l ? { ...l, theirs } : l));
        return theirs.length;
    }, [keys, partnerId]);
    // The same object until something it depends on changes, so screens can
    // react to it without redrawing forever.
    const data = useMemo(() => (loaded ? toData(loaded, settings, role, partnerId) : loaded), [loaded, settings, role, partnerId]);
    return { data, showTheirGear };
}
