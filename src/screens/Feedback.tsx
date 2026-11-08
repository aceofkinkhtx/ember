import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chips, Segments, TextArea } from '../components/intake/Bits';
import { aboutYou, feedbackPrivacy, problemQuestions, sectionsFor, tried, type FeedbackSection, type Question } from '../content/feedback';
import { AccountError } from '../lib/account';
import { emptyDraft, loadFeedbackDraft, saveFeedbackDraft, sendFeedback, trimAll, trimAnswers, type Answer, type FeedbackDraft } from '../lib/feedback';
import { useAccount } from '../state/account';

// Me > Beta feedback: questions on each feature, with what to try first, and a
// separate form for reporting a problem. Answers wait on this phone until sent.

const five = ['1', '2', '3', '4', '5'].map((id) => ({ id, label: id }));

function Ask({ q, value, onChange }: { q: Question; value: Answer | undefined; onChange: (a: Answer) => void }) {
  const id = useId();
  switch (q.kind) {
    case 'scale':
      return (
        <div className="stack" style={{ gap: 2 }}>
          <Segments label={q.prompt} options={five} value={value ? String(value) : null} onChange={(v) => onChange(Number(v))} />
          <span className="note">
            1 is {q.low.toLowerCase()}, 5 is {q.high.toLowerCase()}
          </span>
        </div>
      );
    case 'text':
      return <TextArea label={q.prompt} hint={q.hint} rows={3} max={1000} value={(value as string) ?? ''} onChange={onChange} />;
    case 'many':
      return <Chips legend={q.prompt} options={q.options.map((o) => ({ id: o, label: o }))} value={(value as string[]) ?? []} onChange={onChange} />;
    case 'one':
      return (
        <div className="field">
          <span className="field-label" id={id}>
            {q.prompt}
          </span>
          <div className="chips" role="radiogroup" aria-labelledby={id}>
            {q.options.map((o) => (
              <button key={o} type="button" className="chip" role="radio" aria-checked={value === o} aria-pressed={value === o} onClick={() => onChange(value === o ? '' : o)}>
                {o}
              </button>
            ))}
          </div>
        </div>
      );
  }
}

function SectionCard({
  section,
  answers,
  onChange
}: {
  section: FeedbackSection;
  answers: Record<string, Answer>;
  onChange: (qid: string, a: Answer) => void;
}) {
  const count = Object.keys(trimAnswers(answers)).filter((k) => k !== 'tried').length;
  const notYet = answers.tried === 'Not yet';
  return (
    <details className="card">
      <summary className="card-title" style={{ cursor: 'pointer', minHeight: 'var(--touch)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span>{section.title}</span>
        <span className="note" style={{ margin: 0, fontWeight: 400 }}>
          {notYet ? 'Not tried yet' : count ? `${count} answered` : 'Not started'}
        </span>
      </summary>
      <div className="stack" style={{ gap: 16, paddingTop: 8 }}>
        {section.tryThis.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">Try this first</span>
            <ul style={{ margin: 0, paddingLeft: 20 }} className="stack">
              {section.tryThis.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
        {section.tryThis.length > 0 && (
          <Segments label="Did you try this?" options={tried.map((t) => ({ id: t, label: t }))} value={(answers.tried as string) ?? null} onChange={(v) => onChange('tried', v)} />
        )}
        {notYet ? (
          <p className="note" style={{ margin: 0 }}>
            Come back to this part once you've tried it.
          </p>
        ) : (
          section.questions.map((q) => <Ask key={q.id} q={q} value={answers[q.id]} onChange={(a) => onChange(q.id, a)} />)
        )}
      </div>
    </details>
  );
}

export function FeedbackPage() {
  const { status } = useAccount();
  const [draft, setDraft] = useState<FeedbackDraft>(loadFeedbackDraft);
  const [tab, setTab] = useState<'feedback' | 'problem'>('feedback');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<null | 'feedback' | 'problem'>(null);

  useEffect(() => saveFeedbackDraft(draft), [draft]);

  const about = draft.feedback.about ?? {};
  const sections = sectionsFor((about.roles as string[]) ?? []);
  const setAnswer = (section: string, qid: string, a: Answer) =>
    setDraft((d) => ({ ...d, feedback: { ...d.feedback, [section]: { ...d.feedback[section], [qid]: a } } }));
  const setProblem = (qid: string, a: Answer) => setDraft((d) => ({ ...d, problem: { ...d.problem, [qid]: a } }));

  const feedbackToSend = trimAll(draft.feedback);
  const sectionsAnswered = Object.keys(feedbackToSend).filter((k) => k !== 'about').length;
  const problemToSend = trimAnswers(draft.problem);
  const problemReady = Boolean(problemToSend.happened);

  async function send(kind: 'feedback' | 'problem') {
    setBusy(true);
    setError('');
    try {
      await sendFeedback(kind, kind === 'feedback' ? feedbackToSend : { ...problemToSend, about: trimAnswers(about) });
      setDraft((d) => (kind === 'feedback' ? { ...d, feedback: { about: d.feedback.about ?? {} } } : { ...d, problem: emptyDraft().problem }));
      setSent(kind);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof AccountError ? e.message : "Ember couldn't send that. Your answers are still here. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen">
      <Link to="/me" className="btn btn-quiet" style={{ alignSelf: 'flex-start' }}>
        ‹ Me
      </Link>
      <h1>Beta feedback</h1>
      <p className="lede" style={{ margin: 0 }}>
        Thank you for testing Ember. Try each part, then say how it went. Answer as much or as little as you like: your answers wait on this phone until
        you send them, and you can send more anytime.
      </p>
      <p className="note" style={{ margin: 0 }}>
        {feedbackPrivacy}
      </p>

      {sent && (
        <p className="card" role="status">
          {sent === 'feedback' ? 'Thank you. Your feedback was sent. Come back and add more as you try other parts.' : 'Thank you. Your report was sent.'}
        </p>
      )}

      <div className="segmented" role="tablist" aria-label="Kind of feedback" style={{ alignSelf: 'flex-start' }}>
        <button type="button" role="tab" aria-selected={tab === 'feedback'} onClick={() => setTab('feedback')}>
          By feature
        </button>
        <button type="button" role="tab" aria-selected={tab === 'problem'} onClick={() => setTab('problem')}>
          Report a problem
        </button>
      </div>

      {status !== 'signed-in' && <p className="card">Sign in (in Connections) to send feedback. Your answers are kept on this phone until then.</p>}

      {tab === 'feedback' ? (
        <>
          <section className="card stack" style={{ gap: 16 }} aria-label="About you">
            <h2 className="eyebrow">About you</h2>
            {aboutYou.map((q) => (
              <Ask key={q.id} q={q} value={about[q.id]} onChange={(a) => setAnswer('about', q.id, a)} />
            ))}
          </section>
          {sections.map((s) => (
            <SectionCard key={s.id} section={s} answers={draft.feedback[s.id] ?? {}} onChange={(qid, a) => setAnswer(s.id, qid, a)} />
          ))}
          {error && (
            <p className="note error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="btn btn-primary btn-block" disabled={busy || status !== 'signed-in' || sectionsAnswered === 0} onClick={() => void send('feedback')}>
            {busy ? 'Sending...' : sectionsAnswered ? `Send feedback on ${sectionsAnswered} ${sectionsAnswered === 1 ? 'part' : 'parts'}` : 'Answer a part to send'}
          </button>
        </>
      ) : (
        <section className="card stack" style={{ gap: 16 }} aria-label="Report a problem">
          <p style={{ margin: 0 }}>Something broke, looked wrong or didn't do what you expected? The more exact, the faster it gets fixed.</p>
          {problemQuestions.map((q) => (
            <Ask key={q.id} q={q} value={draft.problem[q.id]} onChange={(a) => setProblem(q.id, a)} />
          ))}
          {error && (
            <p className="note error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="btn btn-primary btn-block" disabled={busy || status !== 'signed-in' || !problemReady} onClick={() => void send('problem')}>
            {busy ? 'Sending...' : problemReady ? 'Send report' : 'Say what happened to send'}
          </button>
        </section>
      )}
    </main>
  );
}
