import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MiniCurve, sceneFacts } from '../components/scene/SceneCurve';
import { listScenes } from '../lib/scenes';
import { TextArea, TextInput } from '../components/intake/Bits';
import { ToyGrid } from '../components/toys/ToyCard';
import { feelings } from '../content/feelings';
import { furniture, positions } from '../data/positions';
import { allTopActivities } from '../content/topSetup';
import { activities, categories, type Activity } from '../data/activities';
import { AccountError, cardFor, listConnections, type Connection } from '../lib/account';
import { listVersions, readSharedProfile, type Choice, type Intake } from '../lib/intake';
import {
  answerNegotiation,
  cleanDesign,
  describeChanges,
  itemsFromDesign,
  getNegotiation,
  liveItems,
  MAX_ITEMS,
  removeNegotiation,
  sameItems,
  startNegotiation,
  type NegBody,
  type NegItem,
  type Negotiation
} from '../lib/negotiations';
import { listOptOuts, readTheirToys, type Toy, type ToyKeyGen } from '../lib/toys';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';
import { displayName } from './Connections';

// Scene proposals (Michael, Nov 16). Either person proposes what they want to
// do, feel or experience in a scene; the other keeps, removes or adds items,
// and it goes back and forth until one approves the other's version as is.
// Then the Top designs from exactly that list.
//
// Safety: the bottom's own phone shows a warning on every item that's a "no"
// in her profile, and she must tick it before she can send or approve. A Top
// can't propose her "no" items at all unless she allows exceptions.

const kindLabel = { activity: 'To do', custom: 'To do, in their own words', position: 'Positions', furniture: 'Furniture', feel: 'To feel or experience' } as const;

const newId = (prefix: string) => `${prefix}:${crypto.randomUUID().slice(0, 8)}`;

function emptyBody(topId: string): NegBody {
  return { v: 1, topId, when: '', note: '', items: [], notThisTime: [], noAllowed: [], history: [] };
}

/** What the bottom's profile says about each activity, as far as this phone can see. */
interface BottomView {
  choice: (activityId: string) => Choice | null;
  allowNo: boolean;
  /** False when only her essentials are shared, so her answers aren't visible. */
  known: boolean;
}

const noView: BottomView = { choice: () => null, allowNo: false, known: false };

function viewOf(intake: Intake | null | undefined): BottomView {
  if (!intake) return noView;
  return {
    choice: (id) => intake.detailed?.answers[id]?.choice ?? null,
    allowNo: Boolean(intake.essentials.allowNoOverride.on),
    known: Boolean(intake.detailed)
  };
}

export function NegotiationPage() {
  const { id: connectionParam, negId } = useParams();
  const navigate = useNavigate();
  const { keys } = useAccount();
  const { settings } = useSettings();
  const [connection, setConnection] = useState<Connection | null | undefined>(undefined);
  const [neg, setNeg] = useState<Negotiation | null | undefined>(negId ? undefined : null);
  const [draft, setDraft] = useState<NegBody | null>(null);
  const [bottom, setBottom] = useState<BottomView>(noView);
  const [acks, setAcks] = useState<string[]>([]);
  const [reopening, setReopening] = useState(false);
  const [gear, setGear] = useState<{ toys: Toy[]; gens: ToyKeyGen[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [params] = useSearchParams();
  const designId = params.get('design');
  /** Items the person a design was shared with has accepted: their maybes, or what's outside their offerings. */
  const [accepted, setAccepted] = useState<string[]>([]);

  // The proposal, then its connection.
  useEffect(() => {
    if (!keys) return;
    (async () => {
      const n = negId ? await getNegotiation(keys, negId) : null;
      if (negId) setNeg(n);
      const connId = n?.connectionId ?? connectionParam;
      const all = await listConnections(keys, cardFor(settings.identity));
      const c = all.find((x) => x.id === connId) ?? null;
      setConnection(c);
      if (n) setDraft(structuredClone(n.body));
      else if (c) {
        const body = emptyBody(c.myRole === 'bottom' ? c.otherId : keys.userId);
        const design = designId ? (await listScenes(keys)).find((x) => x.id === designId) : undefined;
        if (design) {
          const label = (id: string) => [...activities, ...allTopActivities(settings.top.offerings)].find((a) => a.id === id)?.label;
          body.items = itemsFromDesign(design, keys.userId, label);
          body.design = cleanDesign(design);
          body.history = [];
        }
        setDraft(body);
      }
    })().catch(() => setConnection(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, negId, connectionParam, designId]);

  const me = keys?.userId ?? '';
  const iAmTop = draft?.topId === me;
  const otherId = connection?.otherId ?? '';
  const topId = draft?.topId ?? '';

  // The bottom's answers: her own on her phone, or what she shares with her Top.
  useEffect(() => {
    if (!keys || !draft || !otherId) return;
    if (iAmTop) {
      readSharedProfile(keys, otherId)
        .then((p) => setBottom(viewOf(p?.intake)))
        .catch(() => setBottom(noView));
    } else {
      listVersions(keys)
        .then((v) => setBottom(viewOf(v[0]?.intake)))
        .catch(() => setBottom(noView));
      // Her Top's gear, for "Not this time"; gear she marked "Not for me" is already out for good.
      Promise.all([readTheirToys(keys, topId), listOptOuts()])
        .then(([got, outs]) => {
          const gone = new Set(outs.filter((o) => o.connectionId === connection?.id).map((o) => o.toyId));
          setGear(got && { ...got, toys: got.toys.filter((t) => !gone.has(t.id)) });
        })
        .catch(() => setGear(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, iAmTop, otherId, topId]);

  // Her earlier "allow this no" choices carry over.
  useEffect(() => {
    if (neg) setAcks(neg.body.noAllowed.map((n) => n.activityId));
  }, [neg]);

  const offered = useMemo(() => {
    const own = allTopActivities(settings.top.offerings).filter((a) => !activities.some((b) => b.id === a.id));
    return [...activities, ...own];
  }, [settings.top.offerings]);

  if (!keys) return <main className="screen"><p className="card">Sign in to propose scenes.</p></main>;
  if (connection === undefined || neg === undefined || (connection && !draft)) {
    return (
      <main className="screen">
        <p className="note">Opening...</p>
      </main>
    );
  }
  if (!connection || !draft || (negId && !neg)) {
    return (
      <main className="screen">
        <Link to="/connections" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
          ‹ Connections
        </Link>
        <p className="card">This proposal isn't here anymore. It may have been removed, or the connection ended.</p>
      </main>
    );
  }

  const name = displayName(connection);
  const isNew = !neg;
  const myTurn = isNew || reopening || (neg?.status === 'open' && neg.turnId === me);
  const agreed = neg?.status === 'agreed' && !reopening;
  const live = liveItems(draft);
  const has = (id: string) => draft.items.some((i) => i.id === id && !i.removedBy);
  const labelOf = (id: string) => (id === me ? 'you' : name);
  const bothSwitch = connection.myRole === 'switch' && connection.theirRole === 'switch';

  const set = (patch: Partial<NegBody>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const add = (item: Omit<NegItem, 'addedBy' | 'removedBy'>) =>
    setDraft((d) => {
      if (!d) return d;
      const existing = d.items.find((i) => i.id === item.id);
      if (existing) return { ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, removedBy: null } : i)) };
      if (liveItems(d).length >= MAX_ITEMS) return d;
      return { ...d, items: [...d.items, { ...item, addedBy: me, removedBy: null }] };
    });
  const remove = (id: string) =>
    setDraft((d) => {
      if (!d) return d;
      const item = d.items.find((i) => i.id === id);
      // Something you added this turn just disappears; anything else is crossed out so the change shows.
      const original = neg?.body.items.some((i) => i.id === id && !i.removedBy);
      if (item && !original && item.addedBy === me) return { ...d, items: d.items.filter((i) => i.id !== id) };
      return { ...d, items: d.items.map((i) => (i.id === id ? { ...i, removedBy: me } : i)) };
    });

  // The bottom's "no" items: on her phone they each need her tick.
  const myNos = !iAmTop ? live.filter((i) => i.kind === 'activity' && i.ref && bottom.choice(i.ref) === 'no') : [];
  const unticked = myNos.filter((i) => !acks.includes(i.ref!));
  const changed = neg ? !sameItems(draft, neg.body) : true;

  // A shared design: the person it was shared with accepts each of their own
  // maybes, or (as the Top) anything outside their offerings, or takes it off.
  // Their own "no" items use the warning tick above. Taking things off is part
  // of accepting; adding something sends it back for the other to approve.
  const shared = draft.design;
  const offeredByMe = (id: string) => {
    const a = offered.find((x) => x.id === id);
    return Boolean(a && settings.top.offerings.categories[a.category]?.on);
  };
  const toAccept = (i: NegItem): string | null => {
    if (!shared || i.kind !== 'activity' || !i.ref || i.addedBy === me) return null;
    if (iAmTop) return offeredByMe(i.ref) ? null : 'Not in your offerings. Accept it for this scene?';
    return bottom.choice(i.ref) === 'maybe' ? 'A maybe for you. Accept it for this scene?' : null;
  };
  const unaccepted = myTurn && !agreed ? live.filter((i) => toAccept(i) && !accepted.includes(i.id)) : [];
  const before = new Set(neg ? liveItems(neg.body).map((i) => i.id) : []);
  const addedSome = live.some((i) => !before.has(i.id));
  const acceptAsIs = Boolean(shared && neg && !reopening && !addedSome);

  function finalBody(action: 'send' | 'approve'): NegBody {
    const at = new Date().toISOString();
    const noAllowed = iAmTop
      ? draft!.noAllowed.filter((n) => live.some((i) => i.ref === n.activityId))
      : myNos.map((i) => draft!.noAllowed.find((n) => n.activityId === i.ref) ?? { activityId: i.ref!, at });
    const body: NegBody = { ...draft!, noAllowed, notThisTime: iAmTop ? draft!.notThisTime : draft!.notThisTime };
    const text =
      action === 'approve'
        ? changed
          ? `Accepted it. ${describeChanges(neg?.body ?? null, body)}`
          : 'Approved it as is.'
        : isNew && body.design
          ? `Shared the design "${body.design.title || 'A scene'}".`
          : describeChanges(neg?.body ?? null, body);
    return { ...body, history: [...body.history, { by: me, at, text }] };
  }

  async function submit(action: 'send' | 'approve') {
    if (!keys || !connection) return;
    setBusy(true);
    setError('');
    try {
      const body = finalBody(action);
      if (isNew) {
        const id = await startNegotiation(keys, connection.id, connection.otherId, body);
        navigate(`/negotiations/${id}`, { replace: true });
      } else {
        await answerNegotiation(keys, neg!, body, action);
        const fresh = await getNegotiation(keys, neg!.id);
        setNeg(fresh);
        if (fresh) setDraft(structuredClone(fresh.body));
        setReopening(false);
      }
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Ember couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const status = isNew
    ? null
    : agreed
      ? `Agreed${neg!.lastBy === me ? '. You approved it.' : `. ${name} approved it.`}`
      : neg!.turnId === me
        ? `Your turn. Keep, remove or add, then send it back, or approve it as is.`
        : `Waiting for ${name}. You'll get an alert when they answer.`;

  const activityItems = live.filter((i) => i.kind === 'activity');
  const removedItems = draft.items.filter((i) => i.removedBy);

  return (
    <main className="screen">
      <Link to={`/connections/${connection.id}`} className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
        ‹ {name}
      </Link>
      <h1>{isNew ? `Propose a scene with ${name}` : `Scene with ${name}`}</h1>
      {status && (
        <p className={`card ${agreed ? 'card-teal' : ''}`} role="status" style={{ margin: 0 }}>
          {status}
        </p>
      )}
      {isNew && (
        <p className="lede" style={{ margin: 0 }}>
          Not a design yet: just the activities, positions, furniture and feelings you'd like this time. {name} keeps, removes or adds, and once you both agree,{' '}
          {iAmTop ? 'you design' : `${name} designs`} the scene from it.
        </p>
      )}

      {shared && (
        <section className="card stack" style={{ gap: 8 }} aria-label="Shared design">
          <div className="eyebrow">{isNew ? 'Sharing a design' : neg!.starterId === me ? 'The design you shared' : `A design ${name} shared`}</div>
          <div className="card-title">{shared.title || 'A scene'}</div>
          <MiniCurve scene={shared} height={44} />
          <span className="note">{sceneFacts(shared)}</span>
          {!isNew && neg!.starterId !== me && myTurn && !agreed && (
            <p className="note" style={{ margin: 0 }}>
              Accept or take off anything that's a no or maybe for you. Taking things off still counts as accepting. Adding something sends it back to {name} to
              approve.
            </p>
          )}
        </section>
      )}

      {isNew && bothSwitch && (
        <div className="field">
          <span className="field-label">Who Tops this scene?</span>
          <div className="segmented" role="radiogroup" aria-label="Who Tops this scene?" style={{ alignSelf: 'flex-start' }}>
            <button type="button" role="radio" aria-checked={iAmTop} onClick={() => set({ topId: me, notThisTime: [] })}>
              Me
            </button>
            <button type="button" role="radio" aria-checked={!iAmTop} onClick={() => set({ topId: connection.otherId, notThisTime: [] })}>
              {name}
            </button>
          </div>
        </div>
      )}

      <section className="card stack" style={{ gap: 12 }} aria-label="Details">
        {myTurn && !agreed ? (
          <>
            <TextInput label="When, roughly" value={draft.when} max={120} onChange={(when) => set({ when })} />
            <TextArea label="Anything to say about it" rows={3} max={1000} value={draft.note} onChange={(note) => set({ note })} />
          </>
        ) : (
          <>
            <p style={{ margin: 0 }}>
              <strong>When:</strong> {draft.when || 'Not set'}
            </p>
            {draft.note && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{draft.note}</p>}
          </>
        )}
      </section>

      <section className="card stack" style={{ gap: 10 }} aria-label="On the list">
        <h2 className="eyebrow">On the list ({live.length})</h2>
        {live.length === 0 && <p className="note" style={{ margin: 0 }}>Nothing yet. Add what you'd like below.</p>}
        {(['activity', 'custom', 'position', 'furniture', 'feel'] as const).map((kind) => {
          const items = live.filter((i) => i.kind === kind);
          if (!items.length) return null;
          return (
            <div key={kind} className="stack" style={{ gap: 6 }}>
              <span className="field-label">{kindLabel[kind]}</span>
              {items.map((i) => (
                <ItemRow
                  key={i.id}
                  item={i}
                  who={labelOf(i.addedBy)}
                  canEdit={myTurn && !agreed}
                  iAmTop={iAmTop}
                  name={name}
                  bottom={bottom}
                  activity={i.ref ? offered.find((a) => a.id === i.ref) : undefined}
                  allowedNo={draft.noAllowed.some((n) => n.activityId === i.ref)}
                  ticked={i.ref ? acks.includes(i.ref) : false}
                  onTick={(on) => setAcks((a) => (on ? [...a, i.ref!] : a.filter((x) => x !== i.ref)))}
                  onRemove={() => remove(i.id)}
                  acceptText={myTurn && !agreed ? toAccept(i) : null}
                  accepted={accepted.includes(i.id)}
                  onAccept={(on) => setAccepted((a) => (on ? [...a, i.id] : a.filter((x) => x !== i.id)))}
                />
              ))}
            </div>
          );
        })}
        {removedItems.length > 0 && (
          <details>
            <summary className="note" style={{ cursor: 'pointer', minHeight: 'var(--touch)', display: 'flex', alignItems: 'center' }}>
              Taken off ({removedItems.length})
            </summary>
            <ul className="stack" style={{ gap: 6, margin: 0, paddingLeft: 20 }}>
              {removedItems.map((i) => (
                <li key={i.id}>
                  <s>{i.label}</s> <span className="note">, removed by {labelOf(i.removedBy!)}</span>
                  {myTurn && !agreed && (
                    <button type="button" className="btn btn-quiet" style={{ minHeight: 32, padding: '2px 8px' }} onClick={() => add(i)}>
                      Put back
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {myTurn && !agreed && (
        <AddPanel
          offered={offered}
          has={has}
          iAmTop={iAmTop}
          name={name}
          bottom={bottom}
          onAdd={add}
          onRemove={remove}
        />
      )}

      {!iAmTop && gear && gear.toys.length > 0 && (
        <section className="card stack" style={{ gap: 10 }} aria-label="Not this time">
          <h2 className="eyebrow">{name}'s gear: not this time</h2>
          <p className="note" style={{ margin: 0 }}>
            Anything you'd rather skip in this scene only. To rule something out for good, use "Not for me" on {name}'s page.
          </p>
          <ToyGrid
            toys={gear.toys}
            gens={gear.gens}
            below={(t) => {
              const out = draft.notThisTime.includes(t.id);
              return (
                <button
                  type="button"
                  className="chip"
                  aria-pressed={out}
                  disabled={!myTurn || agreed}
                  style={{ marginTop: 6 }}
                  onClick={() => set({ notThisTime: out ? draft.notThisTime.filter((x) => x !== t.id) : [...draft.notThisTime, t.id] })}
                >
                  {out ? '✕ Not this time' : 'Not this time'}
                </button>
              );
            }}
          />
        </section>
      )}
      {iAmTop && draft.notThisTime.length > 0 && (
        <p className="card" style={{ margin: 0 }}>
          {name} marked {draft.notThisTime.length} {draft.notThisTime.length === 1 ? 'piece' : 'pieces'} of your gear "Not this time". They stay out of this scene's design.
        </p>
      )}

      {error && (
        <p className="note error" role="alert">
          {error}
        </p>
      )}
      {unaccepted.length > 0 && (
        <p className="box box-warn" style={{ margin: 0 }}>
          Accept or take off each flagged item before you answer.
        </p>
      )}
      {unticked.length > 0 && myTurn && !agreed && (
        <p className="box box-warn" style={{ margin: 0 }}>
          Tick the warning on each item your profile says no to, or take it off the list, before you send.
        </p>
      )}

      {myTurn && !agreed && (
        <div className="stack" style={{ gap: 8 }}>
          {acceptAsIs ? (
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={busy || unticked.length > 0 || unaccepted.length > 0 || live.length === 0}
              onClick={() => void submit('approve')}
            >
              {busy ? 'Sending...' : changed ? 'Accept without what I took off' : 'Accept the scene'}
            </button>
          ) : !isNew && !changed && !reopening ? (
            <button type="button" className="btn btn-primary btn-block" disabled={busy || unticked.length > 0 || live.length === 0} onClick={() => void submit('approve')}>
              {busy ? 'Sending...' : 'Approve as is'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={busy || unticked.length > 0 || unaccepted.length > 0 || live.length === 0 || (!isNew && !changed)}
              onClick={() => void submit('send')}
            >
              {busy ? 'Sending...' : isNew ? `Send to ${name}` : `Send back to ${name}`}
            </button>
          )}
          {!isNew && !changed && !reopening && !acceptAsIs && (
            <p className="note" style={{ margin: 0, textAlign: 'center' }}>
              Change anything and this becomes "Send back".
            </p>
          )}
          {reopening && (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => {
                setReopening(false);
                setDraft(structuredClone(neg!.body));
              }}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {agreed && (
        <div className="stack" style={{ gap: 8 }}>
          {iAmTop && (
            <Link to={`/scenes/new?negotiation=${neg!.id}`} className="btn btn-primary btn-block">
              {draft.design ? 'Open the design' : 'Design this scene'}
            </Link>
          )}
          {!iAmTop && (
            <p className="note" style={{ margin: 0 }}>
              {draft.design ? `${name} gets the design, ready to run.` : `${name} designs the scene from this list.`}
            </p>
          )}
          <button type="button" className="btn btn-outline btn-block" onClick={() => setReopening(true)}>
            Ask to add or change something
          </button>
        </div>
      )}

      {!isNew && draft.history.length > 0 && (
        <details className="card">
          <summary className="card-title" style={{ cursor: 'pointer', minHeight: 'var(--touch)', display: 'flex', alignItems: 'center' }}>
            What's changed
          </summary>
          <ol className="stack" style={{ gap: 6, margin: 0, paddingLeft: 20 }}>
            {draft.history.map((h, k) => (
              <li key={k}>
                <strong>{h.by === me ? 'You' : name}</strong> <span className="note">{new Date(h.at).toLocaleString()}</span>
                <br />
                {h.text}
              </li>
            ))}
          </ol>
        </details>
      )}

      {!isNew && (
        <button type="button" className="btn btn-quiet" style={{ alignSelf: 'center' }} onClick={() => setConfirmRemove(true)}>
          Remove this proposal
        </button>
      )}
      {confirmRemove && (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="neg-remove-title">
          <div className="sheet">
            <h2 id="neg-remove-title">Remove this proposal?</h2>
            <p>It's removed for both of you. A scene already designed from it stays.</p>
            <button
              type="button"
              className="btn btn-danger btn-block"
              onClick={() =>
                removeNegotiation(neg!.id)
                  .then(() => navigate(`/connections/${connection.id}`, { replace: true }))
                  .catch((e) => setError(e instanceof AccountError ? e.message : "Ember couldn't remove it."))
              }
            >
              Remove
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirmRemove(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
      {activityItems.length === 0 && live.length > 0 && (
        <p className="note" style={{ margin: 0 }}>
          Only feelings and your own words so far. The design works from activities, so add at least one to do.
        </p>
      )}
    </main>
  );
}

function ItemRow({
  item,
  who,
  canEdit,
  iAmTop,
  name,
  bottom,
  activity,
  allowedNo,
  ticked,
  onTick,
  onRemove,
  acceptText,
  accepted,
  onAccept
}: {
  item: NegItem;
  who: string;
  canEdit: boolean;
  iAmTop: boolean;
  name: string;
  bottom: BottomView;
  activity: Activity | undefined;
  allowedNo: boolean;
  ticked: boolean;
  onTick: (on: boolean) => void;
  onRemove: () => void;
  acceptText?: string | null;
  accepted?: boolean;
  onAccept?: (on: boolean) => void;
}) {
  const choice = item.ref ? bottom.choice(item.ref) : null;
  const tags = [
    `added by ${who}`,
    activity?.edge ? 'edge play' : '',
    choice === 'maybe' ? (iAmTop ? `a maybe for ${name}` : 'a maybe for you') : '',
    choice === 'no' && iAmTop ? (allowedNo ? `a no for ${name}, allowed for this scene` : `a no for ${name}`) : ''
  ].filter(Boolean);
  const myNo = !iAmTop && choice === 'no';
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="person">
        <span>
          <strong>{item.label}</strong> <span className="note">({tags.join(', ')})</span>
        </span>
        {canEdit && (
          <button type="button" className="btn btn-quiet" aria-label={`Take ${item.label} off the list`} onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      {activity?.edge && (
        <p className="note" style={{ margin: 0 }}>
          Edge play: even once agreed, the Top confirms it again in the design.
        </p>
      )}
      {acceptText && (
        <label className="box" style={{ margin: 0, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={Boolean(accepted)} onChange={(e) => onAccept?.(e.target.checked)} style={{ marginTop: 4, width: 22, height: 22 }} />
          <span>{acceptText} Or take it off the list.</span>
        </label>
      )}
      {myNo && (
        <label className="box box-warn" style={{ margin: 0, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <input type="checkbox" checked={ticked} disabled={!canEdit} onChange={(e) => onTick(e.target.checked)} style={{ marginTop: 4, width: 22, height: 22 }} />
          <span>
            <strong>Your profile says no to this.</strong> Ticking allows it for this scene only. Your profile stays the same.
            {!bottom.allowNo && ' Your profile also says every no is a hard block; this is your own exception, just this once.'} You can still stop at any time,
            and your safewords always come first.
          </span>
        </label>
      )}
    </div>
  );
}

function AddPanel({
  offered,
  has,
  iAmTop,
  name,
  bottom,
  onAdd,
  onRemove
}: {
  offered: Activity[];
  has: (id: string) => boolean;
  iAmTop: boolean;
  name: string;
  bottom: BottomView;
  onAdd: (item: Omit<NegItem, 'addedBy' | 'removedBy'>) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [own, setOwn] = useState('');
  const [ownFeel, setOwnFeel] = useState('');
  return (
    <section className="card stack" style={{ gap: 12 }} aria-label="Add to the list">
      <h2 className="eyebrow">Add to the list</h2>
      <span className="field-label">To do</span>
      {categories.map((c) => {
        const items = offered.filter((a) => a.category === c.id);
        if (!items.length) return null;
        return (
          <div key={c.id} className="stack" style={{ gap: 8 }}>
            <button type="button" className="choice" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)} style={{ justifyContent: 'space-between' }}>
              <span className="choice-word">{c.label}</span>
              <span className="note">{open === c.id ? '▴' : '▾'}</span>
            </button>
            {open === c.id && (
              <div className="chips">
                {items.map((a) => {
                  const id = `a:${a.id}`;
                  const on = has(id);
                  const theirNo = iAmTop && bottom.choice(a.id) === 'no';
                  const blocked = theirNo && !bottom.allowNo;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className="chip"
                      aria-pressed={on}
                      disabled={blocked && !on}
                      title={blocked ? `A no for ${name}, and they don't allow exceptions` : undefined}
                      onClick={() => (on ? onRemove(id) : onAdd({ id, kind: 'activity', ref: a.id, label: a.label }))}
                    >
                      {a.label}
                      {theirNo && <span className="note"> ({blocked ? `a no for ${name}` : `${name}'s no`})</span>}
                      {a.edge && <span className="note"> (edge)</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {iAmTop && !bottom.known && (
        <p className="note" style={{ margin: 0 }}>
          {name} shares only their essentials with you, so their yes, maybe and no answers don't show here. Their phone shows them anything that's a no for
          them.
        </p>
      )}
      <div className="field" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <TextInput label="Something else to do, in your own words" value={own} max={80} onChange={setOwn} />
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!own.trim()}
          onClick={() => {
            onAdd({ id: newId('c'), kind: 'custom', ref: null, label: own.trim() });
            setOwn('');
          }}
        >
          Add
        </button>
      </div>

      <span className="field-label">Positions</span>
      <div className="chips">
        {positions.map((o) => {
          const id = `p:${o.id}`;
          const on = has(id);
          return (
            <button key={o.id} type="button" className="chip" aria-pressed={on} onClick={() => (on ? onRemove(id) : onAdd({ id, kind: 'position', ref: o.id, label: o.label }))}>
              {o.label}
            </button>
          );
        })}
      </div>
      <span className="field-label">Furniture</span>
      <div className="chips">
        {furniture.map((o) => {
          const id = `u:${o.id}`;
          const on = has(id);
          return (
            <button key={o.id} type="button" className="chip" aria-pressed={on} onClick={() => (on ? onRemove(id) : onAdd({ id, kind: 'furniture', ref: o.id, label: o.label }))}>
              {o.label}
            </button>
          );
        })}
      </div>

      <span className="field-label">To feel or experience</span>
      <div className="chips">
        {feelings.map((f) => {
          const id = `f:${f}`;
          const on = has(id);
          return (
            <button key={f} type="button" className="chip" aria-pressed={on} onClick={() => (on ? onRemove(id) : onAdd({ id, kind: 'feel', ref: null, label: f }))}>
              {f}
            </button>
          );
        })}
      </div>
      <div className="field" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <TextInput label="Another feeling, in your own words" value={ownFeel} max={60} onChange={setOwnFeel} />
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!ownFeel.trim()}
          onClick={() => {
            onAdd({ id: `f:${ownFeel.trim()}`, kind: 'feel', ref: null, label: ownFeel.trim() });
            setOwnFeel('');
          }}
        >
          Add
        </button>
      </div>
    </section>
  );
}
