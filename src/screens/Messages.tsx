import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TextArea } from '../components/intake/Bits';
import { AccountError, cardFor, listConnections, type Connection } from '../lib/account';
import { markMessagesSeen } from '../lib/afterScene';
import { block, clearHistory, isBlocked, listThread, markRead, MAX_MESSAGE, report, reportReasons, sendMessage, unblock, unsend, type Message, type ReportReason } from '../lib/messages';
import { useAccount } from '../state/account';
import { useSettings } from '../state/settings';
import { displayName } from './Connections';

// C4 (Top) and BC3 (bottom): messages with one connection. Sealed on the
// phone; block and report in the menu; history can be cleared on this phone.

const POLL_MS = 8000;

export function MessagesPage() {
  const { id = '' } = useParams();
  const { keys } = useAccount();
  const { settings } = useSettings();
  const [connection, setConnection] = useState<Connection | null | undefined>(undefined);
  const [thread, setThread] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState<null | 'menu' | 'report' | 'clear'>(null);
  const [blocked, setBlocked] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!keys) return;
    listConnections(keys, cardFor(settings.identity))
      .then((all) => setConnection(all.find((c) => c.id === id) ?? null))
      .catch(() => setConnection(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, id]);

  const load = () => {
    if (!keys) return;
    listThread(keys, id)
      .then((t) => {
        setThread(t);
        void markRead(keys, id);
      })
      .catch(() => setThread((t) => t ?? []));
  };

  useEffect(() => {
    if (!keys) return;
    load();
    void markMessagesSeen();
    const t = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, id]);

  useEffect(() => {
    if (connection) void isBlocked(connection.otherId).then(setBlocked);
  }, [connection]);

  // Newer browsers return a promise from scrollIntoView; an effect must return nothing.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [thread?.length]);

  if (connection === undefined || !keys) return <main className="screen"><p className="note">Loading...</p></main>;
  if (connection === null)
    return (
      <main className="screen">
        <Link to="/connections" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
          ‹ Connections
        </Link>
        <p className="card">This connection isn't available anymore.</p>
      </main>
    );
  const name = displayName(connection);
  const canSend = connection.status !== 'ended' && !blocked;

  async function send() {
    if (!keys || !connection || !draft.trim()) return;
    setBusy(true);
    setError('');
    try {
      await sendMessage(keys, connection.id, connection.otherId, { text: draft });
      setDraft('');
      load();
    } catch (e) {
      setError(e instanceof AccountError ? e.message : "Ember couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <div className="person">
        <Link to={`/connections/${connection.id}`} className="btn btn-quiet">
          ‹ {name}
        </Link>
        <button type="button" className="btn btn-quiet" aria-haspopup="dialog" onClick={() => setMenu('menu')}>
          ⋯ More
        </button>
      </div>
      <h1>Messages</h1>
      <p className="note" style={{ margin: 0 }}>
        Locked on your phones. Ember can't read them.
      </p>

      <div className="stack" style={{ gap: 8 }} aria-live="polite">
        {thread === null && <p className="note">Loading...</p>}
        {thread?.length === 0 && <p className="card">No messages yet.</p>}
        {thread?.map((m) => (
          <div key={m.id} style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
            <button
              type="button"
              className="card"
              onClick={() => setSelected(selected === m.id ? null : m.id)}
              style={{
                textAlign: 'left',
                padding: '10px 14px',
                background: m.mine ? 'var(--surface-sunk)' : 'var(--surface)',
                border: m.kind === 'checkin' ? '2px solid var(--saffron)' : undefined,
                whiteSpace: 'pre-wrap',
                cursor: 'pointer',
                color: 'inherit',
                font: 'inherit'
              }}
            >
              {m.kind === 'checkin' && <span className="eyebrow" style={{ display: 'block' }}>Check-in</span>}
              {m.text}
            </button>
            <div className="note" style={{ fontSize: 12, textAlign: m.mine ? 'right' : 'left' }}>
              {new Date(m.at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              {m.mine && m.readAt ? ', read' : ''}
            </div>
            {selected === m.id && m.mine && (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() =>
                  void unsend(m.id)
                    .then(load)
                    .catch(() => setError("Ember couldn't remove that."))
                }
              >
                Unsend
              </button>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>

      {canSend ? (
        <section className="card stack" style={{ gap: 8 }}>
          <TextArea label={`Message ${name}`} rows={3} max={MAX_MESSAGE} value={draft} onChange={setDraft} />
          {error && <p className="note error" role="alert">{error}</p>}
          <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-end' }} disabled={busy || !draft.trim()} onClick={() => void send()}>
            Send
          </button>
        </section>
      ) : (
        <p className="card">{blocked ? `You blocked ${name}. Unblock them in the menu to message again.` : 'This connection has ended.'}</p>
      )}

      {menu === 'menu' && (
        <Sheet title="More" onClose={() => setMenu(null)}>
          <button type="button" className="btn btn-outline btn-block" onClick={() => setMenu('clear')}>
            Clear history on this phone
          </button>
          {blocked ? (
            <button type="button" className="btn btn-outline btn-block" onClick={() => void unblock(keys, connection.otherId).then(() => { setBlocked(false); setMenu(null); })}>
              Unblock {name}
            </button>
          ) : (
            <button type="button" className="btn btn-outline btn-block" onClick={() => void block(keys, connection.otherId).then(() => { setBlocked(true); setMenu(null); })}>
              Block {name}
            </button>
          )}
          <button type="button" className="btn btn-danger btn-block" onClick={() => setMenu('report')}>
            Report {name}
          </button>
          <p className="note" style={{ margin: 0 }}>
            Blocking stops their messages from reaching you. They aren't told.
          </p>
        </Sheet>
      )}
      {menu === 'clear' && (
        <Sheet title="Clear history?" onClose={() => setMenu(null)}>
          <p style={{ margin: 0 }}>Messages so far disappear from this phone. {name} keeps their copy, and new messages still arrive.</p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              clearHistory(connection.id);
              setMenu(null);
              load();
            }}
          >
            Clear history
          </button>
        </Sheet>
      )}
      {menu === 'report' && <ReportSheet name={name} thread={thread ?? []} onClose={() => setMenu(null)} onSend={async (reason, details, included) => {
        await report(keys, connection.otherId, reason, details, included);
        setBlocked(true);
      }} />}
    </main>
  );
}

function ReportSheet({ name, thread, onClose, onSend }: { name: string; thread: Message[]; onClose: () => void; onSend: (r: ReportReason, details: string, included: Message[]) => Promise<void> }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [include, setInclude] = useState<Set<string>>(new Set());
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const theirs = thread.filter((m) => !m.mine).slice(-20);
  if (state === 'sent')
    return (
      <Sheet title="Report sent" onClose={onClose}>
        <p style={{ margin: 0 }}>Thank you. {name} is blocked, and Ember will review the report. If you are in danger, call 911.</p>
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
          Close
        </button>
      </Sheet>
    );
  return (
    <Sheet title={`Report ${name}`} onClose={onClose}>
      <div className="chips" role="radiogroup" aria-label="Reason">
        {reportReasons.map((r) => (
          <button key={r.id} type="button" role="radio" className="chip" aria-checked={reason === r.id} aria-pressed={reason === r.id} onClick={() => setReason(r.id)}>
            {r.label}
          </button>
        ))}
      </div>
      <TextArea label="What happened? (optional)" rows={3} max={1000} value={details} onChange={setDetails} />
      {theirs.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="field-label">Include messages (optional)</span>
          <span className="field-hint">Only the ones you tick are sent to Ember as readable text, so they can be reviewed.</span>
          {theirs.map((m) => (
            <label key={m.id} className="check" style={{ minHeight: 0, alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={include.has(m.id)}
                onChange={(e) =>
                  setInclude((s) => {
                    const next = new Set(s);
                    if (e.target.checked) next.add(m.id);
                    else next.delete(m.id);
                    return next;
                  })
                }
              />
              <span>{m.text.length > 140 ? `${m.text.slice(0, 140)}...` : m.text}</span>
            </label>
          ))}
        </div>
      )}
      <p className="note" style={{ margin: 0 }}>
        Reporting also blocks {name}. They aren't told who reported them.
      </p>
      {state === 'error' && <p className="note error" role="alert">Ember couldn't send the report. Please try again.</p>}
      <button
        type="button"
        className="btn btn-danger btn-block"
        disabled={!reason || state === 'busy'}
        onClick={() => {
          if (!reason) return;
          setState('busy');
          onSend(reason, details, thread.filter((m) => include.has(m.id))).then(
            () => setState('sent'),
            () => setState('error')
          );
        }}
      >
        Send report
      </button>
    </Sheet>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="sheet stack" style={{ gap: 12, maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="person">
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
