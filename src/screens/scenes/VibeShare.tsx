import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TextArea } from '../../components/intake/Bits';
import { VibeView } from '../../components/scene/VibeView';
import { AccountError } from '../../lib/account';
import type { Scene } from '../../lib/scene/model';
import { sceneVibe } from '../../lib/scene/vibe';
import { listScenes, saveScene } from '../../lib/scenes';
import { declinePlan, planStatus, sendPlan, shareVibe, stopSharingVibe, vibePlanState, type PlanState } from '../../lib/vibes';
import { useAccount } from '../../state/account';
import { useSettings } from '../../state/settings';

// S6 Ready to share: the SceneVibe exactly as the bottom will see it. The plan
// stays with the Top unless they send it, and a request from the bottom shows
// here with Send plan or Not this time.

export function VibeShare() {
  const { id = '' } = useParams();
  const { keys } = useAccount();
  const { settings } = useSettings();
  const [scene, setScene] = useState<Scene | null | undefined>(undefined);
  const [prepare, setPrepare] = useState('');
  const [plan, setPlan] = useState<PlanState | null>(null);
  const [hideSurprises, setHideSurprises] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const colors = settings.top.settings.phaseColors;

  useEffect(() => {
    if (!keys) return;
    listScenes(keys)
      .then((all) => {
        const found = all.find((s) => s.id === id) ?? null;
        setScene(found);
        setPrepare(found?.prepare ?? '');
        if (found) void vibePlanState(found).then(setPlan);
      })
      .catch(() => setScene(null));
  }, [keys, id]);

  const preview = useMemo(() => (scene ? sceneVibe({ ...scene, prepare }, colors) : null), [scene, prepare, colors]);

  if (scene === undefined) {
    return (
      <main className="screen">
        <p className="note">Loading...</p>
      </main>
    );
  }
  if (!scene || !preview) {
    return (
      <main className="screen">
        <Link to="/scenes" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
          ‹ Scenes
        </Link>
        <p className="card">That scene isn't available.</p>
      </main>
    );
  }

  const name = scene.partnerName || 'your partner';
  const canShare = scene.role === 'top' && Boolean(scene.partnerId);
  const status = plan ? planStatus(plan) : 'none';

  async function run(task: () => Promise<void>, done: string) {
    setBusy(true);
    setError('');
    setNote('');
    try {
      await task();
      setNote(done);
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  /** The scene with the latest "to bring" note, saved. */
  async function current(): Promise<Scene> {
    if (!keys || !scene) throw new AccountError('Sign in first.');
    if ((scene.prepare ?? '') === prepare) return scene;
    const saved = await saveScene(keys, { ...scene, prepare });
    setScene(saved);
    return saved;
  }

  return (
    <main className="screen">
      <Link to={`/scenes/${scene.id}`} className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
        ‹ Back to the design
      </Link>
      <h1>Ready to share</h1>
      <p className="lede">
        {canShare ? `This is exactly what ${name} sees: the shape of the scene, never the plan. Surprises show only as a question mark.` : 'This is how the SceneVibe will look.'}
      </p>

      <VibeView vibe={preview} />

      <section className="card">
        <TextArea label="To bring or prepare" hint="Shown in the SceneVibe. For example: comfortable clothes, water, a snack for after." value={prepare} rows={3} max={600} onChange={setPrepare} />
      </section>

      {!canShare ? (
        <p className="card">
          {scene.role === 'bottom'
            ? 'This is a design you made for your Top, so it travels as a request instead. Send it from the design.'
            : 'Choose someone for this scene first (use "Use with someone else" in the design), then share it with them.'}
        </p>
      ) : (
        <>
          <section className="card stack" style={{ gap: 10 }} aria-label="Sharing">
            <div className="eyebrow">Share with {name}</div>
            {scene.share ? (
              <>
                <p className="setting-desc" style={{ margin: 0 }}>
                  Shared {new Date(scene.share.sharedAt).toLocaleDateString()}. It updates by itself whenever you change the design.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run(async () => setScene(await shareVibe(keys!, await current(), colors)), 'Updated.')}>
                    Update now
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        setScene(await stopSharingVibe(keys!, await current()));
                        setPlan(null);
                      }, `${name} no longer sees this SceneVibe.`)
                    }
                  >
                    Stop sharing
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="setting-desc" style={{ margin: 0 }}>
                  {name} sees it in their Scenes, locked so only they can open it.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ alignSelf: 'flex-start' }}
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const shared = await shareVibe(keys!, await current(), colors);
                      setScene(shared);
                      setPlan(await vibePlanState(shared));
                    }, `Shared with ${name}.`)
                  }
                >
                  Share SceneVibe with {name}
                </button>
              </>
            )}
          </section>

          {scene.share && (
            <section className="card stack" style={{ gap: 10 }} aria-label="The full plan">
              <div className="eyebrow">The full plan</div>
              <p className="setting-desc" style={{ margin: 0 }}>
                {status === 'requested'
                  ? `${name} asked to see the full plan. It's your call.`
                  : status === 'declined'
                    ? `You chose to keep it a surprise. ${name} sees a kind note saying so.`
                    : status === 'sent'
                      ? `${name} has the plan. Send it again if you change the design.`
                      : `The plan stays with you. ${name} can ask to see it, and you decide.`}
              </p>
              <label className="check" style={{ minHeight: 0 }}>
                <input type="checkbox" checked={hideSurprises} onChange={(e) => setHideSurprises(e.target.checked)} />
                Keep surprises hidden in the plan
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={status === 'requested' ? 'btn btn-primary' : 'btn btn-outline'}
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const s = await current();
                      await sendPlan(s, !hideSurprises);
                      setPlan(await vibePlanState(s));
                    }, `The plan is with ${name}.`)
                  }
                >
                  {status === 'sent' ? 'Send the latest plan' : status === 'requested' ? 'Send plan' : 'Send full plan'}
                </button>
                {status === 'requested' && (
                  <button
                    type="button"
                    className="btn btn-quiet"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await declinePlan(scene);
                        setPlan(await vibePlanState(scene));
                      }, 'Kept as a surprise.')
                    }
                  >
                    Not this time
                  </button>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {note && (
        <p className="note" role="status">
          {note}
        </p>
      )}
      {error && (
        <p className="note error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
