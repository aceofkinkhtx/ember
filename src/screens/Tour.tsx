import { useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmberMark } from '../components/EmberMark';
import { MiniCurve } from '../components/scene/SceneCurve';
import { roleLabel, tabLabel } from '../content/copy';
import { wordGroups } from '../content/intake';
import type { PhaseType } from '../content/phases';
import { newBeat, type Phase, type Scene } from '../lib/scene/model';
import { useSettings } from '../state/settings';

// The app tour (Michael, Nov 19): once after setup, and again from Me. The
// pictures are drawn with Ember's own parts and sample data, so they match the
// app, follow the theme and discreet mode, and show no one's real data.

type Words = { scene: string; Scene: string; Top: string; bottom: string; gear: string };
type Card = { id: string; title: string; text: string; shot: ReactNode };

export function Tour() {
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const asked = params.get('role');
  const role = asked === 'top' || asked === 'bottom' ? asked : settings.activeRole;
  const d = settings.discreet;
  const w: Words = {
    scene: d ? 'plan' : 'scene',
    Scene: d ? 'Plan' : 'Scene',
    Top: roleLabel('top', d),
    bottom: roleLabel('bottom', d),
    gear: tabLabel('toys', d)
  };
  const cards = role === 'top' ? topCards(w) : bottomCards(w);
  const [at, setAt] = useState(0);
  const card = cards[at];
  const last = at === cards.length - 1;
  const touch = useRef<number | null>(null);

  const finish = () => {
    update({ tourSeenAt: new Date().toISOString() });
    navigate('/', { replace: true });
  };
  const go = (n: number) => setAt(Math.max(0, Math.min(cards.length - 1, n)));

  return (
    <main
      className="tour"
      aria-label="App tour"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (dx < -50) go(at + 1);
        if (dx > 50) go(at - 1);
      }}
    >
      <div className="tour-top">
        <span className="note">
          {at + 1} of {cards.length}
        </span>
        <button type="button" className="btn btn-quiet" onClick={finish}>
          {last ? 'Close' : 'Skip'}
        </button>
      </div>
      <div className="tour-shot" aria-hidden="true" key={card.id}>
        {card.shot}
      </div>
      <div className="tour-words" aria-live="polite">
        <h1>{card.title}</h1>
        <p className="lede">{card.text}</p>
      </div>
      <div className="tour-dots" aria-hidden="true">
        {cards.map((c, i) => (
          <span key={c.id} className={i === at ? 'on' : ''} />
        ))}
      </div>
      <div className="tour-nav">
        {at > 0 && (
          <button type="button" className="btn btn-outline" onClick={() => go(at - 1)}>
            Back
          </button>
        )}
        <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => (last ? finish() : go(at + 1))}>
          {last ? "Let's go" : 'Next'}
        </button>
      </div>
    </main>
  );
}

// The cards ------------------------------------------------------------------------

const welcome = (w: Words): Card => ({
  id: 'welcome',
  title: 'Welcome to Ember',
  text: `${w.Scene}s designed together, from what you've both said yes to. Your limits stay yours, and the safety rules are always on.`,
  shot: (
    <div className="stack" style={{ gap: 18, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <EmberMark large />
      <div style={{ width: '100%' }}>
        <MiniCurve scene={sample} height={70} />
      </div>
    </div>
  )
});

function topCards(w: Words): Card[] {
  return [
    welcome(w),
    {
      id: 'home',
      title: 'Home: what needs you today',
      text: `Check-ins that are due, proposals waiting for your answer, and a countdown to your next ${w.scene}.`,
      shot: <HomeShot w={w} />
    },
    {
      id: 'offer',
      title: 'Tell Ember what you offer',
      text: `Your offerings and your settings. Ember designs only from what you offer and what your partner says yes to.`,
      shot: (
        <Mock eyebrow="Your offerings" title="What you offer">
          <div className="chips">
            {['Sensation', 'Impact', 'Restraint', 'Roles', 'Praise', 'Mind'].map((c, i) => (
              <span key={c} className="chip" aria-pressed={i !== 3}>
                {c}
              </span>
            ))}
          </div>
          <span className="note">Aftercare: at least 20% of every {w.scene}</span>
        </Mock>
      )
    },
    {
      id: 'connect',
      title: 'Connect with a partner',
      text: `Invite with a link. Each of you keeps your own profile and limits. Messages stay between the two of you.`,
      shot: <ConnectShot w={w} other="bottom" />
    },
    {
      id: 'agree',
      title: 'Agree first',
      text: `A ${w.scene} starts as a list: activities, positions, furniture, how it should feel, and how far to go. Either of you can add or take off. Nothing is designed until you both agree.`,
      shot: <AgreeShot w={w} />
    },
    {
      id: 'design',
      title: `Design the ${w.scene}`,
      text: `Ember builds a draft from the agreed list. You shape the curve, the beats and the intensity. Anything outside the agreement or past a limit is blocked. Aftercare always stays last.`,
      shot: (
        <Mock eyebrow="Slow burn · 60 min" title="Your design">
          <MiniCurve scene={sample} height={64} />
          <div className="box">Build · Intensity 6 of 10</div>
          <div className="box box-block">Outside what you agreed. Blocked.</div>
        </Mock>
      )
    },
    {
      id: 'vibe',
      title: `Share the ${d(w, 'SceneVibe', 'vibe')}`,
      text: `Your partner sees the feel of the ${w.scene}, not the script. Before you start, they get a quick check-in.`,
      shot: <VibeShot w={w} />
    },
    {
      id: 'live',
      title: 'Run it live',
      text: `Live ${w.Scene} Mode: dark screen, big buttons, one hand. It follows your design and keeps the signals in reach.`,
      shot: (
        <div className="tour-dark stack" style={{ gap: 10 }}>
          <span className="eyebrow">Build · 12 min left</span>
          <strong style={{ fontSize: 20 }}>Slow strokes, then wait.</strong>
          <span>Say: "Breathe with me."</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
            <span className="tour-big">Pause</span>
            <span className="tour-big">Next</span>
          </div>
          <span className="tour-big tour-stop">Stop</span>
        </div>
      )
    },
    {
      id: 'after',
      title: 'After',
      text: `Aftercare, a debrief, and check-ins the next morning and in the days after.`,
      shot: <AfterShot first="Check in with Wren" />
    },
    {
      id: 'set',
      title: "You're set",
      text: `Gear lives in ${w.gear}. Discreet mode and the app lock are in Me, and so is this tour.`,
      shot: <SetShot />
    }
  ];
}

function bottomCards(w: Words): Card[] {
  return [
    welcome(w),
    {
      id: 'home',
      title: 'Your space',
      text: `Proposals waiting for you, check-ins that are due, and your next ${w.scene}.`,
      shot: <HomeShot w={w} />
    },
    {
      id: 'profile',
      title: 'Your profile',
      text: `Quick words, a vibe map or the detailed form. Every path ends in a profile you control and can change any time.`,
      shot: (
        <Mock eyebrow="Your profile" title="How do you want it to feel?">
          <div className="segmented tour-seg" style={{ alignSelf: 'flex-start' }}>
            <button type="button" aria-selected="true" tabIndex={-1}>
              Quick words
            </button>
            <button type="button" tabIndex={-1}>
              Vibe map
            </button>
            <button type="button" tabIndex={-1}>
              Detailed
            </button>
          </div>
          <div className="chips">
            {wordGroups[0].words.slice(0, 4).map((x, i) => (
              <span key={x.id} className="chip" aria-pressed={i === 0}>
                {x.label}
              </span>
            ))}
          </div>
        </Mock>
      )
    },
    {
      id: 'connect',
      title: `Connect with a ${w.Top}`,
      text: `Accept an invite or send one. They see only what you share, and your limits always count.`,
      shot: <ConnectShot w={w} other="top" />
    },
    {
      id: 'propose',
      title: "Say what you'd like",
      text: `Propose a ${w.scene}: what to do, how it should feel, and how far. Your own requests count as your yes. Your ${w.Top} keeps, takes off or adds, and nothing is designed until you both agree.`,
      shot: <AgreeShot w={w} />
    },
    {
      id: 'vibe',
      title: `Your ${d(w, 'SceneVibe', 'vibe')}`,
      text: `When your ${w.Top} shares the ${w.scene}, you see its feel and shape. A quick check before you start asks how you're doing today.`,
      shot: <VibeShot w={w} />
    },
    {
      id: 'after',
      title: 'During and after',
      text: `During the ${w.scene}, your signals are always respected. After, Ember checks in with you, the next morning and in the days after.`,
      shot: <AfterShot first="How are you, right after?" />
    },
    {
      id: 'set',
      title: "You're set",
      text: `Discreet mode and the app lock are in Me, and so is this tour.`,
      shot: <SetShot />
    }
  ];
}

const d = (w: Words, plain: string, discreet: string) => (w.scene === 'plan' ? discreet : plain);

// The pictures ------------------------------------------------------------------------

function Mock({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="card stack" style={{ gap: 10 }}>
      <div className="eyebrow">{eyebrow}</div>
      <div className="card-title" style={{ margin: 0 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function HomeShot({ w }: { w: Words }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="card" style={{ borderLeft: '6px solid var(--saffron)' }}>
        <div className="eyebrow">Check-ins due</div>
        <div className="card-title" style={{ margin: 0 }}>
          Your follow-up · Day 3
        </div>
      </div>
      <Mock eyebrow="Your turn" title={`A ${w.scene} proposal is waiting for you`} />
      <div className="card stack" style={{ gap: 6 }}>
        <div className="person">
          <span className="eyebrow">Next {w.scene}</span>
          <span className="tag tag-gray">In 3 days</span>
        </div>
        <div className="card-title" style={{ margin: 0 }}>
          Slow burn
        </div>
        <MiniCurve scene={sample} height={40} />
      </div>
    </div>
  );
}

function ConnectShot({ w, other }: { w: Words; other: 'top' | 'bottom' }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      <Mock eyebrow="Invite" title="Send a link">
        <div className="box">ember-50z.pages.dev/join/…</div>
      </Mock>
      <div className="card">
        <div className="person">
          <strong>{other === 'bottom' ? 'Wren' : 'Rook'}</strong>
          <span className="tag tag-gray">{other === 'bottom' ? w.bottom : w.Top}</span>
        </div>
        <span className="note">Connected · Messages</span>
      </div>
    </div>
  );
}

function AgreeShot({ w }: { w: Words }) {
  // Discreet mode keeps the sample list neutral too.
  const items =
    w.scene === 'plan'
      ? [
          ['Slow massage', 'Activity · How far: 6 of 10'],
          ['Seated', 'Position'],
          ['Armchair', 'Furniture'],
          ['Heat: Smolder', 'The feel']
        ]
      : [
          ['Flogging', 'Activity · How far: 6 of 10'],
          ['Kneeling', 'Position'],
          ['Spanking bench', 'Furniture'],
          ['Heat: Smolder', 'The feel']
        ];
  return (
    <Mock eyebrow="The list" title="What you both agree on">
      {items.map(([a, b]) => (
        <div key={a} className="box" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <strong>{a}</strong>
          <span className="note">{b}</span>
        </div>
      ))}
    </Mock>
  );
}

function VibeShot({ w }: { w: Words }) {
  return (
    <Mock eyebrow={`From your ${w.Top}`} title="Slow burn">
      <MiniCurve scene={sample} height={70} />
      <span className="note">Smolder · Cherish me · About an hour</span>
      <div className="box box-info">Your pre-{w.scene} check is waiting. Tap to answer.</div>
    </Mock>
  );
}

function AfterShot({ first }: { first: string }) {
  return (
    <div className="card stack" style={{ gap: 8, borderLeft: '6px solid var(--saffron)' }}>
      <div className="eyebrow">Check-ins due</div>
      {[first, 'Your debrief', 'Your follow-up · Day 3'].map((t) => (
        <div key={t} className="choice" style={{ justifyContent: 'space-between' }}>
          <span className="choice-word">{t}</span>
          <span className="note">›</span>
        </div>
      ))}
    </div>
  );
}

function SetShot() {
  return (
    <Mock eyebrow="Me" title="Yours to control">
      {['Discreet mode', 'App lock', 'Replay the tour'].map((t) => (
        <div key={t} className="box">
          {t}
        </div>
      ))}
    </Mock>
  );
}

// A made-up scene for the curves.
const phase = (type: PhaseType, levels: number[]): Phase => ({
  id: `tour-${type}`,
  type,
  beats: levels.map((intensity) => newBeat({ intensity, minutes: 6 }))
});

const sample: Scene = {
  v: 1,
  id: 'tour',
  title: 'Slow burn',
  connectionId: null,
  partnerId: null,
  partnerName: '',
  role: 'top',
  date: '',
  startTime: '',
  minutes: 60,
  location: '',
  isPublic: false,
  intense: false,
  intakeVersion: 0,
  marks: 'day',
  useSpecificGear: false,
  gearIds: [],
  picks: [],
  notes: '',
  shape: 'climb',
  overrides: [],
  kept: {},
  nextMorningCheckIn: false,
  inLibrary: true,
  createdAt: '',
  updatedAt: '',
  phases: [phase('arrival', [2]), phase('build', [3, 5, 6]), phase('peak', [8, 7]), phase('descent', [4]), phase('aftercare', [1, 1])]
};
