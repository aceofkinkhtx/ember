import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AccountForm } from '../components/AccountForm';
import { roleLabel, tabLabel } from '../content/copy';
import {
  AccountError,
  cancelInvite,
  cardFor,
  createInvite,
  listConnections,
  listMyInvites,
  openGuestAnswers,
  type Connection,
  type CreatedInvite,
  type GuestAnswers,
  type IntakePath,
  type InviteKind,
  type MyInvite
} from '../lib/account';
import { readJson, writeJson } from '../lib/storage';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';

// C1 (Top) and BC1 (bottom): everyone you play with, plus Invite (C2) and
// joining with a code.

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export const shortDate = (iso: string) => dateFmt.format(new Date(iso));

type SortBy = 'newest' | 'oldest' | 'name';
const SORT_KEY = 'ember.connectionSort';
const sortOptions: { id: SortBy; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'name', label: 'Name' }
];

function sorted(list: Connection[], by: SortBy): Connection[] {
  const copy = [...list];
  if (by === 'name') return copy.sort((a, b) => displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' }));
  copy.sort((a, b) => a.since.localeCompare(b.since));
  return by === 'oldest' ? copy : copy.reverse();
}

export function displayName(c: Connection): string {
  return c.them?.name || (c.ready ? 'Your connection' : 'Finishing setup...');
}

export function connectionSummary(c: Connection, discreet: boolean): string {
  return [c.them?.pronouns, `You're the ${roleLabel(c.myRole, discreet)}`, `Since ${shortDate(c.since)}`].filter(Boolean).join(' · ');
}

export function Connections() {
  const { settings } = useSettings();
  const account = useAccount();
  const title = tabLabel('connections', settings.discreet);

  if (account.status === 'loading') {
    return (
      <main className="screen">
        <h1>{title}</h1>
        <p className="note">Loading...</p>
      </main>
    );
  }

  if (account.status === 'signed-out') {
    return (
      <main className="screen">
        <h1>{title}</h1>
        <AccountForm intro="Connecting with someone needs an account, so your answers can travel to them locked. Everything personal is encrypted on this phone first." />
      </main>
    );
  }

  return <ConnectionsSignedIn title={title} />;
}

function ConnectionsSignedIn({ title }: { title: string }) {
  const { settings } = useSettings();
  const { keys } = useAccount();
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [invites, setInvites] = useState<MyInvite[]>([]);
  const [answers, setAnswers] = useState<Record<string, GuestAnswers | null>>({});
  const [error, setError] = useState('');
  const [inviting, setInviting] = useState(false);
  const me = cardFor(settings.identity);

  const load = useCallback(async () => {
    if (!keys) return;
    try {
      setError('');
      const [conns, mine] = await Promise.all([listConnections(keys, me), listMyInvites(keys)]);
      setConnections(conns);
      setInvites(mine);
      const opened: Record<string, GuestAnswers | null> = {};
      for (const inv of mine) if (inv.sealedAnswers) opened[inv.id] = await openGuestAnswers(keys, inv.sealedAnswers);
      setAnswers(opened);
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Ember couldn't load your connections.");
      setConnections((c) => c ?? []);
    }
    // The card text is what matters, not the object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, me.name, me.pronouns]);

  useEffect(() => {
    void load();
  }, [load]);

  const guests = invites.filter((i) => i.kind === 'guest' && (i.sealedAnswers || new Date(i.expiresAt) > new Date()));
  const pending = invites.filter((i) => i.kind === 'account' && !i.used && new Date(i.expiresAt) > new Date());
  const isTop = settings.activeRole === 'top';
  // Ended connections leave both lists; only a new invite brings them back.
  const active = (connections ?? []).filter((c) => c.status !== 'ended');
  const [sort, setSort] = useState<SortBy>(() => readJson<SortBy>(SORT_KEY) ?? 'newest');
  const chooseSort = (next: SortBy) => {
    setSort(next);
    writeJson(SORT_KEY, next);
  };

  return (
    <main className="screen">
      <div className="topbar">
        <h1>{title}</h1>
      </div>
      {error && <p className="note error" role="alert">{error}</p>}

      <div className="stack">
        <button type="button" className={`btn btn-block ${isTop ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setInviting(true)}>
          Invite someone
        </button>
        <JoinWithCode primary={!isTop} />
      </div>

      <section className="stack" aria-labelledby="people-title">
        <div className="person">
          <h2 id="people-title" className="eyebrow">
            Connected
          </h2>
          {active.length > 1 && (
            <label className="note" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              Sort
              <select className="input" style={{ minHeight: 40, padding: '6px 10px' }} value={sort} onChange={(e) => chooseSort(e.target.value as SortBy)}>
                {sortOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {connections === null ? (
          <p className="note">Loading...</p>
        ) : active.length === 0 ? (
          <div className="card">
            <p>No one yet. Invite someone, or enter the code someone sent you.</p>
          </div>
        ) : (
          <ul className="person-list">
            {sorted(active, sort).map((c) => (
              <li key={c.id}>
                <Link to={`/connections/${c.id}`} className="card person" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <div>
                    <div className="person-name">{displayName(c)}</div>
                    <div className="note">{connectionSummary(c, settings.discreet)}</div>
                  </div>
                  {c.status === 'paused' ? <span className="chip">Paused</span> : <span aria-hidden="true">›</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {guests.length > 0 && (
        <section className="stack" aria-labelledby="guests-title">
          <h2 id="guests-title" className="eyebrow">
            Guest links
          </h2>
          <ul className="person-list">
            {guests.map((g) => {
              const a = answers[g.id];
              return (
                <li key={g.id} className="card stack">
                  {g.sealedAnswers ? (
                    <>
                      <div className="person-name">{a?.name || 'A guest'}</div>
                      {a?.pronouns && <div className="note">{a.pronouns}</div>}
                      {a?.message && <p>{a.message}</p>}
                      {!a && <p className="note">These answers couldn't be opened on this phone.</p>}
                    </>
                  ) : (
                    <>
                      <div className="person-name">Waiting for answers</div>
                      <div className="note">
                        Sent {shortDate(g.createdAt)}, works until {shortDate(g.expiresAt)}
                      </div>
                      <CancelButton id={g.id} onDone={load} />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {pending.length > 0 && (
        <section className="stack" aria-labelledby="pending-title">
          <h2 id="pending-title" className="eyebrow">
            Invites waiting
          </h2>
          <ul className="person-list">
            {pending.map((p) => (
              <li key={p.id} className="card person">
                <div>
                  <div className="person-name code">{p.code}</div>
                  <div className="note">Works until {shortDate(p.expiresAt)}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <CopyButton text={p.code} label="Copy" />
                  <CancelButton id={p.id} onDone={load} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {inviting && (
        <InviteSheet
          onClose={() => {
            setInviting(false);
            void load();
          }}
        />
      )}
    </main>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-quiet"
      onClick={() =>
        void navigator.clipboard?.writeText(text).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          },
          () => undefined
        )
      }
    >
      {copied ? 'Copied' : label}
    </button>
  );
}

function CancelButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-quiet"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await cancelInvite(id).catch(() => undefined);
        onDone();
      }}
    >
      Cancel
    </button>
  );
}

function JoinWithCode({ primary }: { primary: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(primary);
  const [code, setCode] = useState('');
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!open) {
    return (
      <button type="button" className="btn btn-quiet btn-block" onClick={() => setOpen(true)}>
        I have a code
      </button>
    );
  }
  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (clean.length === 8) navigate(`/join/${clean}`);
      }}
    >
      <label className="field">
        <span className="field-label">Join with a code</span>
        <span className="field-hint">Enter the 8-character code someone sent you.</span>
        <input
          className="input code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={12}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      <button type="submit" className="btn btn-secondary btn-block" disabled={clean.length !== 8}>
        Look up code
      </button>
    </form>
  );
}

const paths: { id: IntakePath; label: string; desc: string }[] = [
  { id: 'detailed', label: 'Detailed', desc: 'Every activity, one by one' },
  { id: 'words', label: 'Word groups', desc: 'Quick picks from groups of words' },
  { id: 'map', label: 'Desire map', desc: 'Place feelings on a map' }
];

function InviteSheet({ onClose }: { onClose: () => void }) {
  const { settings } = useSettings();
  const { keys } = useAccount();
  const [kind, setKind] = useState<InviteKind>('account');
  const [path, setPath] = useState<IntakePath>('detailed');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [made, setMade] = useState<CreatedInvite | null>(null);
  const [copied, setCopied] = useState(false);
  const role = settings.activeRole;

  async function make() {
    if (!keys) return;
    setBusy(true);
    setError('');
    try {
      const me = cardFor(settings.identity);
      setMade(
        await createInvite(keys, {
          kind,
          role,
          path: role === 'top' ? path : null,
          note: { name: me.name, pronouns: me.pronouns, message: message.trim() }
        })
      );
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Ember couldn't make the invite. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // The shared text stays plain so it reveals nothing if someone else sees it.
  const shareText = made ? `Here's my private link: ${made.link}` : '';

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="invite-title">
      <div className="sheet stack" style={{ gap: 16 }}>
        <h2 id="invite-title">Invite someone</h2>
        {!made ? (
          <>
            <div className="stack" role="radiogroup" aria-label="Kind of invite">
              {(
                [
                  ['account', 'Invite to Ember', 'They make an account and you stay connected.'],
                  ['guest', 'Send a guest link', 'They answer in the browser, with nothing to install.']
                ] as const
              ).map(([id, label, desc]) => (
                <button key={id} type="button" className="choice" role="radio" aria-checked={kind === id} onClick={() => setKind(id)}>
                  <span>
                    <span className="choice-word">{label}</span>
                    <span className="choice-desc" style={{ display: 'block' }}>
                      {desc}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {role === 'top' && (
              <fieldset className="field">
                <legend className="field-label">Suggested way to answer</legend>
                <span className="field-hint">They can switch anytime.</span>
                <div className="chips">
                  {paths.map((p) => (
                    <button key={p.id} type="button" className="chip" aria-pressed={path === p.id} title={p.desc} onClick={() => setPath(p.id)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <label className="field">
              <span className="field-label">A note from you (optional)</span>
              <span className="field-hint">Locked inside the link, so only they can read it.</span>
              <textarea className="input" rows={2} maxLength={140} value={message} onChange={(e) => setMessage(e.target.value)} />
            </label>

            {error && <p className="note error" role="alert">{error}</p>}
            <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={make}>
              {busy ? 'Making your link...' : 'Make link'}
            </button>
          </>
        ) : (
          <>
            <p>
              {kind === 'guest'
                ? 'Send this link to your guest. It works once and expires in 7 days.'
                : 'Send this link, or read them the code to type in Ember. It works once and expires in 7 days.'}
            </p>
            <div className="card person">
              <div>
                <div className="eyebrow">Code</div>
                <div className="code" style={{ fontSize: 22 }}>
                  {made.code}
                </div>
              </div>
              <CopyButton text={made.code} label="Copy code" />
            </div>
            {typeof navigator.share === 'function' && (
              <button type="button" className="btn btn-primary btn-block" onClick={() => void navigator.share({ text: shareText }).catch(() => undefined)}>
                Share link
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => void navigator.clipboard?.writeText(made.link).then(() => setCopied(true), () => undefined)}
            >
              {copied ? 'Link copied' : 'Copy link'}
            </button>
            <p className="note">Your note only shows when they open the link. Typing the code shows your role, not your note.</p>
          </>
        )}
        <button type="button" className="btn btn-quiet btn-block" onClick={onClose}>
          {made ? 'Done' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}
