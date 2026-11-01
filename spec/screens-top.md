# Screens: Top

Every screen in the Top's view of Ember for Phase 1, in the order a Top meets them. Each table lists what the screen is for, what's on it, and where it leads, so Claude Code can build without guessing. Phone-first throughout: one-handed, tap and slide over typing.

## The core loop

&#91;embedded content: Top's core loop · 14 screens\]

After onboarding (O1 to O7), every scene follows this path. The debrief and check-in feed the connection profile, so the next scene starts smarter than the last.

## Navigation and onboarding

A bottom tab bar holds five places: **Home, Connections, Scenes, Toys, Me**. The role toggle sits at the top of Home for anyone with both views. Onboarding runs once and every step past the first can be skipped and finished later.

| ID | Screen | What it's for | Key elements | Leads to |
| --- | --- | --- | --- | --- |
| O1 | Welcome | First open; choose a role | Ember mark; three large icons: Top, bottom, both; one-line description each | O2 |
| O2 | Privacy setup | Protect the app before any data goes in | Discreet mode toggle (neutral icon and name, vague notifications), PIN or Face ID, short plain-language privacy promise | O3 |
| O3 | Depth | Pick Simple or Studio | Two cards with an info icon each; note that it can be changed anytime in Me | O4 |
| O4 | Your offerings | What this Top does and to what degree | Play categories as one-word icons; tap to include, slider for degree; "add your own"; skip | O5 |
| O5 | Your settings | The Top's personal standards | Aftercare as a percentage of scene length (separate value for intense scenes), check-in cadence, phase colors, one line describing their voice; A.C.E. profile offered as a ready-made starting point | O6 |
| O6 | Safety floor | Acknowledge what never changes | Short list of the safety floor items; single "I understand" button | O7 |
| O7 | First toys (optional) | Seed the toy directory | Camera button, three-tap tagging, "do this later" | H1 |

## Home and connections

Home answers "what needs me today?" Connections holds everyone the Top plays with and everything known about them.

| ID | Screen | What it's for | Key elements | Leads to |
| --- | --- | --- | --- | --- |
| H1 | Home | Today at a glance | Role toggle (if both); due check-ins first, in amber; next scene card with countdown; today's tip card; quick actions: New scene, Invite | S1, C3, A4, C2 |
| C1 | Connections | Everyone the Top plays with | List with name, last scene date, a dot if a check-in is due or intake is incomplete; Invite button | C2, C3 |
| C2 | Invite | Bring someone in | Two choices: invite to Ember (full account) or send a guest link; suggested intake path (detailed, word groups or desire map); share sheet for text or email | C1 |
| C3 | Connection profile | Everything about this person, at a glance | Limit strip at the top; their Heat / Hold / Flow picks; desire and aftercare map dots; conflict flags in red; toy opt-outs; scope of the power exchange; scene history; buttons: Message, New scene | C4, S1, C5 |
| C4 | Messages | Talk with this person | Chat thread; scene requests from the bottom appear as cards with "Design this," and plan requests appear with "Send plan"; block and report in the menu | S1 |
| C5 | Full intake view | Read every intake answer | Sections from the detailed intake, collapsible; yes / maybe / no shown as colored chips; date of last update | C3 |

## Scene creation

Six screens take a Top from "new scene" to a confirmed plan. The plan stays private to the Top by default; the bottom sees the SceneVibe. The bottom can request the full plan, and the Top decides whether to send it.

| ID | Screen | What it's for | Key elements | Leads to |
| --- | --- | --- | --- | --- |
| S1 | Scene basics | Set the frame | Connection picker; date and start time; duration slider; location; private or public; "intense scene" toggle (sets the aftercare percentage); optional template | S2 |
| S2 | Mutual actions | Choose what you'll actually do | Activities where the bottom said yes and the Top offers them, as icons grouped by category; an "Add more" drawer holds maybe items (amber flag) and no items (red flag plus a required confirmation question); tap to include; intensity slider per pick; toy picker (opted-out toys hidden); notes field for surprises and unusual combinations; surprise toggle per item | S3 or S4 |
| S3 | Conflict check | Resolve anything that clashes | Only appears if needed; each conflict as a card (desire versus trigger, injury versus position); choices: adjust, remove, or keep with a note | S4 |
| S4 | Design options | Pick a starting design | Two or three cards, each with a mini intensity curve, phase strip in phase colors, total time and peak count; tap to preview; "Use this one" | S5 |
| S5 | Scene editor | Shape every detail | Phases as collapsible color bands; beats as cards inside; steps inside beats; drag handles on all three levels; tap anything for a drop-down edit sheet; rule warnings inline in amber (warn) or red (block); add beat, ritual beat or recovery; aftercare phase always last; Save to library; Share SceneVibe | S6 |
| S6 | Ready to share | Show the bottom the vibe, keep the plan private | SceneVibe preview exactly as the bottom will see it; Share SceneVibe button; the full plan stays with the Top unless they tap Send full plan; any plan request from the bottom appears here with Send plan or Not this time | H1 |

**Edit sheet (from S5).** One sheet handles any beat or step: time and length, intensity slider, activity, toy, body area (with risk shown), positions, DO / SAY / WATCH / NOTES fields, and flags (warning, info, watch, partner, surprise). Changes that break a block rule are refused with a one-line reason.

## Live Scene Mode

The in-session view switches to the dark, high-contrast look and keeps everything a single tap away. The screen stays awake while it's open.

| ID | Screen | What it's for | Key elements | Leads to |
| --- | --- | --- | --- | --- |
| L1 | Pre-scene check | Confirm today before starting | The Top's part (capacity slider, safety kit, space set); the bottom's part shown as it arrives from their phone; the "say aloud together" list with a tick for each; Start button unlocks when all are done | L2 |
| L2 | Scene guide | Run the scene | Sticky header (scene name, elapsed time, current phase); signals bar; limit strip; one card per beat with DO / SAY / WATCH / NOTES tabs; beat timer; restraint timer when bondage is active; bottom nav dots per phase; floating buttons: red, toolkit, log, pause | L3, L4, L5, A1 |
| L3 | Red | Stop safely | Full-screen calm red; step-by-step stop guidance; the bottom's aftercare plan and overwhelm plan; emergency contact with call button; first aid basics; "resume" only after a deliberate confirmation | L2 or A1 |
| L4 | Regulation toolkit | Steady the moment | Bottom sheet with four groups (body, mind, emotion, support), each a few large one-tap prompts; opens automatically on a logged yellow | L2 |
| L5 | Quick log | Capture a moment without breaking flow | One tap logs a yellow, a highlight or a note at the current time; optional voice note | L2 |

**Pause** dims the guide, stops all timers and shows a single Resume button, for interruptions from the outside world.

## After the scene

| ID | Screen | What it's for | Key elements | Leads to |
| --- | --- | --- | --- | --- |
| A1 | End and aftercare | Move into aftercare without leaving the guide | Aftercare phase cards (immediate, settled, close) with timers; the bottom's aftercare map setting at the top; "more if needed" extends time with one tap; close card with the readiness check before the bottom leaves and next check-in time | A2 |
| A2 | Top debrief | Reflect while it's fresh | The six debrief questions (authentic, communicative, exploratory, mattering, observations, my own state) as sliders with optional notes; logged moments from the scene shown for reference; skip any question | A3 |
| A3 | Profile updates | Keep the bottom's profile current | Suggested changes from both debriefs (new yes, new limit, toy reaction) as cards; accept or dismiss each; limit changes marked "needs bottom's confirmation" | H1 |
| A4 | Check-in | Follow up about 18 hours later | Opens from the reminder; the bottom's debrief if submitted; a suggested check-in message in the Top's voice to edit and send; marks the check-in done | C4 |

## Library, toys and settings

| ID | Screen | What it's for | Key elements | Leads to |
| --- | --- | --- | --- | --- |
| B1 | Scenes | Every scene, past and planned | Tabs: Upcoming, Past, Library; each scene as a card with its mini curve; duplicate or reuse a saved design for another connection | S5, A2 |
| T1 | Toy directory | See and manage every toy | Photo grid; filter chips (thuddy, stingy, sharp, other; impact, sensation, insertable); add button | T2 |
| T2 | Add or edit toy | Catalog a toy in seconds | Camera; feel icons (thuddy / stingy / sharp / other); play type icons; name; notes; which bottoms it's opted out for | T1 |
| M1 | Me | Settings and account | Offerings; Top settings (aftercare, check-in cadence, voice, phase colors); Simple or Studio; discreet mode and PIN; daily tips (on by default) and tip time; export or delete my data; support Ember (donation link) | O4, O5 |

**Home link from the role toggle.** Tapping the toggle at the top of Home switches to the bottom view; that view is mapped separately.
