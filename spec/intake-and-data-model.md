# Intake and Data Model

This tab turns A.C.E.'s working materials (the current pre-negotiation form, the Scene Design Framework, and the Brii and Henna session guides) into the structures Ember is built on. Client details are left out; only structure carries over.

## Detailed intake

The detailed path rebuilds the current A.C.E. Pre-Negotiation Form as eleven app sections. The biggest change: every activity becomes a three-way choice (yes, maybe, no) with an optional intensity slider, so silence is never read as consent and limits come straight out of the same screen.

| # | Section | What it asks | Input in Ember | Change from the current form |
| --- | --- | --- | --- | --- |
| 1 | About you | Name or scene name, what to be called, preferred check-in channel, emergency contact and whether they know about kink | Text fields; one icon choice for contact awareness | Unchanged; contact moves to the account so it is entered once |
| 2 | Experience and voice | Experience level; how easily they speak up during a scene | Icon choice for each | Speak-up answer sets the self-advocacy flag and check-in frequency |
| 3 | Signals | Traffic light words, hand signs, any custom signal | Icon choice plus optional custom word | Custom signal added |
| 4 | Purpose | What the scene is for; how they want to feel | Desire map dot, word groups, or the current "I want to feel" icons | Free text becomes the desire map, with the decoder for loaded choices |
| 5 | Activities | Bondage, sensation, impact, touch and intimacy, penetration | Yes / maybe / no per item, intensity slider on yes | Checkboxes become three-way choices; choking moves to its own edge play line |
| 6 | Impact details | Areas (with risk level shown), positions, feel (thuddy, stingy or sharp), marks | Body map tap for areas; icons for positions; one choice for marks | Marks confirmed per scene, not just as a standing preference |
| 7 | Limits and language | Hard limits, soft limits, places not to be touched, words welcome and words off-limits | Auto-filled from section 5: no answers fill the limit strip; plus text fields | Words section added, since degradation language is a common source of trouble |
| 8 | Body and health | Medical conditions, injuries, mobility, positions that don't work, allergies | Text fields; body map tap for injuries | STI status becomes checkboxes confirmed in person, never stored as results |
| 9 | Mind and emotion | Triggers; overwhelm plan (what helps, what to do or avoid) | Text fields with example chips to tap | Unchanged in substance |
| 10 | Presence and privacy | Video consent, others watching or participating, public scene conditions | Icon choices | "My partners" generalizes to "others present" for any Top |
| 11 | Aftercare and curiosity | Aftercare wants; anything curious but never tried | Aftercare map dot plus icon extras; text field | Aftercare list becomes the aftercare map; curiosity stays last, after the full menu |

**Substance policy.** The current agreement (no play when noticeably intoxicated) stays as a required checkbox. The pre-scene check confirms it on the day.

**Starter activity list.** The five activity groups seed from the current form: bondage (blindfolds through mummification), sensation (biting through erotic massage), impact (hand through whips, plus stingy and thuddy), touch and intimacy, and penetration. Tops can hide, rename or add items in their offerings.

## Pre-scene check

The framework says some things are confirmed before every scene, whatever the history. In Ember these become a short check both people complete on the day, mostly by tap, before Live Scene Mode unlocks.

**Bottom answers:**

- Body today: a quick slider plus a tap on anything sore or new. Bodies change.
- Emotional state going in: a slider and an optional note. A bad week matters.
- Anything new since the last negotiation: yes or no, with a field if yes.
- Substance policy confirmed for today.
- Readiness: which ingredients of their yes are present today (curiosity, choice, desire, trust, safety, room to change).

**Top answers:**

- Top capacity today: energy and focus slider, which scales the design.
- Safety kit ready: shears, water, first aid, phone charged and nearby.
- Space set: phones silenced, lighting, music, supplies laid out.

**Confirmed together, aloud:**

- Safe words and signals, said back to each other.
- Honorific, if one is used.
- Consent to anyone else present, watching or participating.
- Marks for this scene.

The check takes under two minutes and appears as the first card of the arrival phase in Live Scene Mode.

## Scene data model

Every scene is a nest of four levels, taken directly from the session guides: a scene holds phases, a phase holds beats (the time-block cards), and a beat holds steps. Moving a phase moves its beats; moving a beat moves its steps.

| Level | What it is | Fields |
| --- | --- | --- |
| Scene | One planned session with one connection | Title, date, start time, duration, location, public or private, connection, Top and bottom, consent snapshot, signals, limit strip, overall Heat / Hold / Flow, SceneVibe settings |
| Phase | A labeled stage of the arc | Type (arrival, ritual, build, peak, recovery, descent, close, aftercare), color, order, target intensity range, required or optional |
| Beat | One card in Live Scene Mode | Start time and length, phase, intensity (1 to 10), goal in one line, positions, body areas, toys, flags |
| Step | One action inside a beat | Order, DO text, SAY lines, WATCH signals, NOTES, linked toy, linked activity from the intake, surprise flag |

**Attached to the scene, always visible in Live Scene Mode:**

- **Signals bar:** red, yellow, green, hand sign, any custom signal.
- **Limit strip:** hard limits in red, soft limits in amber, physical care notes in blue, filled from the intake.
- **Bottom nav:** one dot per phase, color-coded, tap to jump.

**Attached to beats and steps, as needed:**

- **Warning box** (red): a critical moment, such as a likely trigger or cathartic release.
- **Info box** (blue): context worth knowing in the moment.
- **Watch tag** (amber for monitor, red for urgent): a behavioral signal to look for.
- **Partner tag** (purple): a planned call or partner involvement.
- **Restraint timer:** starts automatically when a step uses bondage.

**Aftercare** is its own phase with sub-phases (immediate, settled, close), each with timing, physical care, SAY lines and the aftercare map setting. The **close card** always ends the scene: readiness check before the bottom leaves and the next check-in time.

## Design rules

The Scene Design Framework becomes the rulebook the auto-designer follows and the manual editor checks against. Rules marked **block** cannot be broken; rules marked **warn** can be overridden by the Top with a tap and a reason.

| Area | Rule | Strength |
| --- | --- | --- |
| Arc | Every scene has arrival, at least one peak, a descent, a close and aftercare | Block |
| Arc | The descent includes a spoken landing line ("We are coming down now" or the Top's own) | Block |
| Arc | The close comes before aftercare and includes one specific, true thing named about what the bottom did | Warn |
| Warm-up | No beat above intensity 4 before a warm-up beat | Block |
| Escalation | Impact follows bare hand, then light, then moderate, then heavy implement | Warn |
| Escalation | Intensity never drops mid-build except as a planned recovery or descent | Warn |
| Peaks | Multiple peaks need an active recovery beat between them (water, physical care, check-in, presence) | Block |
| Peaks | The first of several peaks is shorter and lighter than the next | Warn |
| Impact areas | Areas carry a risk level (low: butt, back and front of thigh, forearms; moderate: breasts, upper back, upper arm, inner thigh, calves, soles; high: face, vulva) | Shown on every beat |
| Impact areas | Kidneys are never a target | Block |
| Impact feel | Thuddy, stingy and sharp are tracked separately and matched to the bottom's preference | Warn |
| Marks | Marks follow the setting confirmed for this scene | Block |
| Insertables | Plugs go in during a calm beat, never at a peak; size changes only as a reward or milestone | Warn |
| Limits | No step may include a no item without the Top's confirmed override, or a toy opted out for this bottom | Block |
| Edge play | High-risk categories are never auto-added and require Studio mode and explicit negotiation | Block |
| Psychology | Known triggers appear as warning boxes on the beats where they are most likely to surface | Block |
| Aftercare | Every scene has aftercare; length is a Top setting with a minimum for intense scenes | Block |
| Check-in | Any scene that reaches subspace or cathartic release schedules a next-morning check-in | Block |
| Watch signals | Every peak and build beat carries the core watch list: vocal to silent, breath changes, rigid body, glassy or absent eyes, crying (release or distress), panic | Automatic |
| Crying | Crying is not treated as stop unless a signal is used; the guidance is stay close, stay quiet, let them lead | Shown on peak beats |

**What the designer may use.** The auto-designer builds only from items the bottom marked yes. The Top can add other items by hand, each flagged:

- **Maybe** items get an amber flag and the note "Discussed together?"
- **No** items get an immediate red flag and a required question before the item is saved: "They marked this as no. Have you talked and agreed to include it?" The red flag stays visible on the beat, in the limit strip and in Live Scene Mode.
- Every override is recorded with its date in the connection's history.

The consent snapshot locks automatically at the pre-scene check, when the bottom confirms nothing has changed.

## Universal rules versus Top settings

Some of A.C.E.'s practice is good scene craft for everyone; some is his personal standard. The universal parts are the safety floor and the block rules above. His personal standards become settings any Top can set for themselves, with A.C.E.'s values as one ready-made profile.

| Setting | A.C.E. value | Range for other Tops |
| --- | --- | --- |
| Default aftercare length | 25% of scene length (33% for intense scenes), more if needed | Any length; a minimum still applies to scenes marked intense |
| Penile or oral sex | Never included unless explicitly negotiated for that scene | Off by default for everyone; each Top decides whether it can appear at all |
| Between-session check-ins | Two a week, each with one purpose (accountability, maintenance, connection or task) | None to daily, or per connection |
| Points system | Merit and accountability points with rewards and punishments | Optional module, off by default |
| SAY voice | Direct, warm, unhurried, observational, specific | Each Top describes their own voice; the AI layer writes in it |
| Honorifics and body language | Per bottom, from the intake | Same, per bottom |
| Others present | Partners may watch or join with consent | Generalized to any named others |
| Phase colors | Amber, purple, green, gray, blue, deep red | Customizable |

**Living document rule.** Any change to limits or agreements is dated, confirmed by both people, and kept in the connection's history, so the written record always matches the lived agreement.

## Debrief template

The framework ends with three questions every scene should answer yes to. They become the spine of the Top's debrief, each with a slider and an optional note, and a "no" on any of them opens a prompt for what to change next time.

**Top debrief:**

1. **Authentic.** Did I show up as myself, honest about my capacity and intentions?
2. **Communicative.** Did I listen, observe and check in, holding space for what actually happened rather than what I planned?
3. **Exploratory.** Did I follow the experience rather than just execute the plan, staying curious about this person in this moment?
4. **Mattering.** Did they feel seen and important to me in there? (From the deeper debrief.)
5. **Observations.** What did their body tell me? Anything new for their profile?
6. **My own state.** How am I after this, and what do I need? (Top aftercare.)

**Bottom debrief** (separate, through their view or guest link):

1. How do you feel right now? (Slider and optional note.)
2. Did you feel seen and that you mattered?
3. What was different from what you imagined, and what do you want to keep?
4. One-tap replies: "Loved that, again please," "Yes to this, but another way," "That's a no for me now," "Something felt off, let's talk."
5. Anything to add or change in your profile?

Both debriefs feed the bottom's profile and appear side by side in the connection's history. If something went wrong or unexpectedly, the app prompts a talk rather than letting it be absorbed silently.
