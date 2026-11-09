# Decisions log

Decisions Michael made outside the spec tabs, newest first. The spec still wins where it is more specific.

## Nov 7, 2026

- **Password reset (Michael asked, Nov 9; details are Claude's proposal):** Sign in has "Forgot your password?", which emails a reset link (through Supabase's email, Brevo once connected). The link opens a reset page that asks for the recovery code and a new password. The code unlocks the private key on the phone, which is then locked again with the new password, so the data comes back and Ember still never sees either. A wrong code changes nothing. Without the code, the data can't be recovered by anyone; the page says so and offers no "start over" (deleting from an emailed link alone would let anyone with access to the inbox wipe the account). The recovery code stays the same after a reset. "Change password" in Me asks for the current password first. Awaiting Michael's OK.
- **Marks/bruises asked up front (Michael, Nov 8):** the bottom's intake asks "Marks/bruises" (None, A day, A week, Open) on the Body and mind page, before choosing Quick, Map or Detailed, so every bottom answers it whatever path they take. It moved out of the detailed path's Impact page; older intakes that answered it there still count. It sits with the essentials, so "safety essentials" sharing includes it. The scene and live guide now say "Marks/bruises".
- **Placing a profile picture (Michael, Nov 8):** after choosing a picture, a "Place your picture" screen shows it in its circle; drag to move, pinch or the slider to zoom (arrow keys and plus or minus too). Only the part inside the circle is kept, saved at 400 px. The picture always fills the circle.
- **Gear photos from the gallery (Michael, Nov 8):** the "Choose from your photos" button has been there since Nov 7. Claude's fix for photos that wouldn't open: Ember now falls back to the browser's own image loading, and a photo it still can't open (some gallery formats, such as HEIC on some phones) gets a clear message with what to try.
- **M7 went live** with Michael's OK: the database change, the alert sender and its 5-minute job.
- **Simple and Studio are merged (Michael):** "the distinction doesn't offer enough to be two different modes." There is one mode. The Depth step in onboarding and the Depth control in Me are gone.
  - Claude's call, by the safety rules: edge play is still never on by default. A Top turns on each kind in Offerings, it is never suggested in a design, and it is added to a scene only after the Top confirms it was negotiated for that scene (a block rule, unchanged). The only thing removed is the extra Studio switch in front of it.
- **M9 went live** with Michael's OK (Nov 8).
- **Beta feedback in Ember (Michael, Nov 8):** a "Beta feedback" page in Me. Each feature has "Try this first" steps, "Did you try this?", 1 to 5 ratings and comment boxes; a separate "Report a problem" form. Sections follow the roles the tester chose. Answers wait on the phone until sent, and are saved as plain text in a beta_feedback table that only Michael reads, in the Supabase dashboard; the page says feedback isn't locked. Feedback goes with the tester's account if they delete it.
- **M9 Hardening** (Michael: "run M9 and push it"). Claude's choices, for Michael to confirm:
  - **Download my data** (Me, Your data): unlocks everything the person can read on that phone (profile versions, gear with photos, scenes, connections with their messages, their own check-ins and debriefs, and this phone's settings without the PIN) into one JSON file saved on the phone. Nothing is sent anywhere. The file is not locked, and Me says so.
  - **Delete my account:** typed confirmation ("DELETE"). It removes the person's photo files first, then the account; every table that belongs to the account goes with it, including their connections, and the messages and check-ins on both sides. The other person isn't told.
  - **Reports survive the reported person deleting their account,** so deleting can't erase a report. The reporter's own reports still go with the reporter's account.
  - **Face ID or fingerprint** (Me, Privacy, shown only with a PIN, on phones that support it): uses the phone's own passkey check. It's a screen lock like the PIN, nothing about a face or finger reaches Ember, and the PIN always still works.
  - **"Forgot PIN?"** now also says that signing in again brings back locked account data.
  - **Security review:** every table has row-level security; every privileged database function fixes its search path; the only things that work without signing in are the invite, guest link and personal code lookups, as designed.
  - **Accessibility pass:** an automated WCAG 2.1 AA check of the main Top and bottom screens found no problems. The role buttons and on/off switches now have 44 px touch areas.
  - **Offline check:** the whole app and its fonts are stored on the phone, so it opens without signal; a running scene works from the phone, and a Red that can't reach the Top's phone tells the bottom to say it out loud.

- **Michael approved every pending choice** ("yes to all"): the M6 choices marked as Claude's, the M5 SceneVibe choices, the M4b choices, the M3 choices and the edge play list below now stand as decisions.
- **M6 went live:** the database change was applied to the real database with Michael's OK.
- **Build your own (Michael):** alongside the starting designs there is a custom design. It has the usual sections (arrival, build, peak, descent, close), each with one empty beat that the Top or bottom adds to, moves, resizes and fills with their own actions. It is always offered, and it is the only choice when nothing is picked. Section lengths add up to the play time.
  - Claude's call, by the safety rules: the descent keeps its spoken landing line (a block rule) and aftercare comes filled in, so an empty design never breaks the safety floor. The close starts empty and shows its usual amber reminder.
- **Gear is added inside each section (Michael):** the "Use specific gear" toggle before the design is gone. Every beat in every section has "+ Add gear": pick a piece (yours, or theirs after "Show their gear"), and it becomes a step in that beat, opened so you can choose what it is for. Gear kept out of scenes with that person is never offered. Replaces the Nov 3 "Specific toys are a toggle" decision.
  - Claude's call: "Gear, in order" inside Impact stays, since it plans the impact progression; it now notes that gear can also be added in the editor.
- **Small changes (Michael):** typed text in the dark live screens is the same grey as the 1 to 5 numbers; gear photos can be taken or chosen from the phone's photos; Me describes Simple and Studio. Claude's note: the Me wording says what Studio does today (edge play with a confirmed negotiation). The onboarding still promises "more categories, the full gear directory and advanced options", which aren't built.
- **Web push approved (Michael):** phone alerts go through the phone maker's push service (Apple, Google or Mozilla). The text is always generic: "A check-in is waiting in Ember." or "You have a new message in Ember." It never names a person, a scene or an act. A small scheduled job checks every 5 minutes for anything due.
- **Reports (Michael):** a report holds the reason, optional details, and only the messages the reporter ticks, as readable text. Only Michael can read reports, in the Supabase dashboard. Reporting also blocks the person.
- **M7 After the scene and messaging** (Claude's choices, for Michael to confirm):
  - **What's shared:** the bottom's check-in right after and their debrief go to the Top (A4 shows them). The Top's check-in right after is private, apart from the list of activities in the scene, which the bottom's debrief uses. The Top's debrief is shared by default (a tick box), except "how are you doing" which always stays private. In the follow-ups, only the notes for the other person are shared, as the Nov 4 decision says.
  - **Timing:** both get the check-in right after; the bottom's debrief is due 3 hours later (it can be done earlier, or "Later"); the Top's check-in with the bottom about 18 hours later; follow-ups for both at 1, 2 and 3 days, after every scene (the Nov 4 decision, rather than the spec's one day after lighter scenes).
  - **The Top's debrief:** how real it felt, communication, how much new ground, whether the bottom seemed to feel seen and that they mattered, observations, and the Top's own state. Plus, per activity, "They loved it", "Needs more care next time" or "Didn't seem right for them".
  - **Profile updates (A3):** only the bottom changes their profile. "That's a no for me now" offers to change that item to no; the Top's "Didn't seem right for them" offers to change it to maybe. Each change saves a new, dated intake version. The Top sees these as suggestions, marked as needing the bottom's confirmation.
  - **Send the real design afterward:** on the Top's after-scene screen, one tap sends the plan with surprises revealed (private notes and records stay with the Top).
  - **A low rating:** the Top sees an amber note when the bottom rates how they feel 1 or 2 right after. In the follow-ups, a 1 or 2 offers "Message (them)" and "Text someone you trust".
  - **Messages:** sealed to both people. You can unsend your own message, and "Clear history on this phone" hides past messages on your phone only. A block is silent: the other person can still send, but nothing reaches you. Unread counts show on the connection page.
  - **Me:** "Check-in reminders" and "Message alerts" switches, plus "Turn on alerts on this phone" (permission needs a tap). On iPhone it explains adding Ember to the Home Screen first.

## Nov 6, 2026

- **M6 Live Scene Mode** (Michael's choices, and Claude's where marked, approved Nov 7):
  - **Every maybe needs the bottom's answer** (Michael). Before the scene, the bottom sees every maybe and unanswered item in the plan by name, surprises included (they learn what, not when), and answers yes, no or "let's talk". A no takes it out of the plan. "Let's talk" needs the Top to mark "talked: keep it" or "take it out" before starting. This replaces the Nov 3 "Surprise me: don't tell me about maybes" option. Items the Top already confirmed (a no they talked through, edge play, a sex act) were agreed separately and aren't asked again.
  - **One check, not two** (Claude): the pre-scene check-in (feeling, final negotiation, excitement) and the day-of check (body, emotions, anything new, substance agreement, readiness) are one form for the bottom, under two minutes.
  - **Where the bottom answers:** on their own phone (the check travels sealed on the shared SceneVibe), or on the Top's phone handed over, for a partner without the app or without signal.
  - **Starting needs:** the bottom's part, every "let's talk" settled, the Top's energy and focus (1 to 5), all four safety kit items, and every "say aloud" tick (signals, honorific, others present, marks). "Space set" is there to tick but isn't required (Claude). Low energy shows a gentle note; it doesn't change the design by itself (Claude; the spec said capacity scales the design).
  - **The consent snapshot** locks at Start: both parts, the aloud list, every maybe and its answer, what was taken out, and the bottom's care details (signals, limits, body notes, aftercare, overwhelm plan, emergency contact), so the guide works offline.
  - **The bottom's phone during the scene** (Michael): a simple dark view with the wave and a line showing where the scene is, Red and Yellow buttons that reach the Top's phone, and the regulation toolkit. Never the plan. Spoken signals stay first; the buttons are a backup and need a connection.
  - **Red** (Michael): stops every timer, shows "Stop. Check in." with the stop steps, the bottom's aftercare and overwhelm plan, an emergency call button (their contact, and 911 always), first aid basics, and "Go to aftercare". Resuming the scene needs a second tap confirming you've both checked in and want to go on. A red from the bottom's phone opens it on the Top's phone.
  - **Timers** (Claude): the scene clock and each beat's clock count up; the beat clock turns amber when the beat runs long. The Top moves between beats; nothing advances on its own.
  - **Restraint timer** (Claude): runs only for activities that bind (cuffs, rope, a cross, a bench, a swing, mummification), not blindfolds, gags or a collar. A circulation check is asked for every 10 minutes and logged.
  - **The toolkit** opens by itself on a yellow (from either phone) and at the start of each recovery beat.
  - **Quick log:** yellow, highlight or a short note, with the time. A voice note isn't built (optional in the spec).
  - **Copies** of a scene no longer carry its SceneVibe link, request or live record (fixed while building M6).

- **Editor changes after M5** (Michael):
  - **Drag anywhere:** a step drags into any beat, in any section, and a beat drags into any section. The arrow keys move them too, crossing into the next beat or section at either end. Every drop still goes through the rules, so a move that breaks a block rule is refused with its reason.
  - **Aftercare follows the scene:** when an edit makes play longer (a new beat or section, a longer beat or section), the scene's total grows and aftercare grows to match your setting, with a note saying by how much. Aftercare never shrinks by itself. Shortening aftercare yourself below your setting is still refused (safety floor).
  - **Smooth wave map** (Michael chose option B): the scene map and the SceneVibe curve are a smooth wave through the middle of each beat, filled with the phase colors underneath. The curve never rises above or dips below the beats on either side, so it never shows a beat as more intense than planned. The animated SceneVibe (Phase 2) will build on this shape. On the SceneVibe, the play shapes sit on the line itself (Michael), each on a small light disc so it reads over any phase color; they keep their own shapes and colors, are a little smaller, and slide apart along the line when they would touch.
  - **Live scene map:** the map stays pinned at the top of the editor while you scroll, shows where a dragged beat would land, and appears in the beat and length sheets, updating as you move the sliders.

- **M5 SceneVibe choices** (Claude, approved Nov 7):
  - **What the SceneVibe shows:** the intensity curve in the Top's phase colors, one marker per kind of play per beat, the date, time, length, place, a "to bring or prepare" note, and the aftercare steps by name. It never shows activity names, gear, DO or SAY words, notes or flags.
  - **Shapes and colors:** impact is an ember triangle, sensation a gold star, restraint a teal square outline, touch a rose circle, fingers (digital) a violet diamond, penetration a garnet hexagon, and a surprise is a question mark in a dashed saffron circle. Surprise markers never show their kind, and each surprise is counted once even if it comes back in a later beat.
  - **Sharing:** the Top shares from "Ready to share", which shows the SceneVibe exactly as the bottom will see it. It's sealed so only the bottom can open it, updates by itself whenever the design changes, and "Stop sharing" withdraws it. Deleting the scene or ending the connection removes it.
  - **The full plan:** the bottom can ask; the Top sends it or answers "Not this time", and the bottom then sees a kind note that the Top would like to keep it a surprise (and can ask again later). The Top can also send it unasked. Surprises stay hidden in a sent plan unless the Top unticks "Keep surprises hidden", and the Top's private step notes, overrides and kept warnings are never sent.
  - **Home** shows the next dated scene with a countdown: a Top's own design, or the next SceneVibe a Top shared with a bottom.
  - **Not yet:** SceneVibes for guests (they have no account to lock it for), animation, and Draw Your Wave (Phase 2, as the spec says).

- **"S/switch"** (Michael): wherever "switch" names the role, Ember writes "S/switch" (plural "S/switches"): the role picker, connections, onboarding, scene basics and all copy. Where it's a verb ("switch views") or an on/off control, it stays as is.

## Nov 4, 2026

- **After M4, from Michael's review:**
  - **Profile pictures for everyone** (Michael). Optional, shown on Me, connections, a connection's page and scene requests, with initials when there's none. Each picture is shrunk to 400 px, cleared of location and camera details, and locked on the phone with its own key; the key travels in the locked connection card, so only connections can open it, and the database lets them download it only while connected. A new picture gets a new key. Known gap for M9: deleting an account must also delete the picture file, like gear photos.
  - **Sharing levels say exactly what the Top sees** (Michael): Not shared (scene name and pronouns only), Essentials (everything that keeps the bottom safe, no desires or yes answers), Full (everything, and Ember designs from the yes answers).
  - **Play time goes up to 8 hours** (Michael).
  - **Design with no one in mind** (Michael), as a Top or a bottom: the design goes to the library and is checked against a person's limits when it's used with them ("Use with someone else"). A bottom's library design can then be sent to a Top. Maybe and unanswered flags apply only to a partner's answers; your own no answers are always blocked.
  - **Categories first** (Michael): picks and the "Add more" list show only categories until one is opened.
  - **Impact gear in order** (Michael): in the Impact category, "Gear, in order" lists impact gear in the order to use it, each as one of the impact picks (guessed from its name, changeable). The design spreads it from the warm-up (about a quarter) through the build (about a third) to the peaks.
  - **Editing time** (Michael): the whole scene's length and each section's length can be changed; beats keep their share, and aftercare grows to fit. Any step can be moved to another beat from its edit sheet.

- **M4b choices** (Claude, approved Nov 7):
  - **A bottom designs for their Top** from the bottom's own latest intake, with every category open, since the Top's offerings aren't shared. Picks start at 6 of 10. The design is sent as a request, sealed so only the Top can open it; the server sees only who sent it to whom, when, and the answer.
  - **The Top accepts or passes.** Accepting saves the Top's own copy with their offerings and settings applied: anything that needs the Top's own confirmation (a no override, edge play, a negotiated act) is taken out and listed, aftercare grows to the Top's setting, and the Top's range shows as warnings. Passing is quiet: the bottom sees that the Top passed and can change the design and send it again. Either person can remove a request, and ending the connection removes them.
  - **A switch chooses the role per scene** in Scene basics. Designing as the bottom sends a request; designing as the Top works as before.
  - **Gear:** either designer can tap "Show their gear" to add the partner's shared gear to the design. Gear either person keeps out of scenes with the other never appears.
  - **Use with someone else** copies a design for another connection, checked against their limits and gear. Anything that doesn't fit is taken out and listed; overrides and kept warnings don't carry over.

- **M4 is split in two** (Michael): M4a is the rules engine, scene basics, mutual picks, design options, the editor with drag and edit sheets, flags and overrides, and the saved library. M4b is a bottom designing for a Top as a request, and reusing a library design for another connection.
- **Design options differ by arc shape** (Michael): one long climb, two peaks, or waves of three. The shape that fits the bottom's Flow word comes first (Slow Climb, Surge and Drift: one climb; Staircase and Storm: two peaks; Ripple, Edge and Pulse: waves). Shorter scenes get fewer shapes (two peaks from 40 minutes, waves from 60).
- **Scenes are saved on the server, locked** (Michael): each design is sealed to the designer's own key before upload. The server sees only a locked box and two dates, not the title, the partner or anything in it.
- **M4a choices** (Claude proposed; Michael's answers in brackets):
  - **Play time and aftercare:** the duration slider is play time; aftercare is added after it, at the Top's percentage. (Approved.)
  - **Starting intensity** for each pick is the top of the Top's range for that category, or the bottom's own number if they gave one. The Top can lower any pick.
  - **Marks place no limits** (Michael): the marks setting is recorded with each scene, but it never restricts implements or intensity. This replaces the "Marks follow the setting" block rule. The Top can still choose less than the bottom agreed to, never more.
  - **Next-morning check-in** is required when any beat reaches 8 or more, or the bottom's decoder answers include emotional release or losing themselves in sensation. It turns on by itself. (Approved.)
  - **Trigger placement:** names on build and peak beats; hands near the throat on choking, collar and gag steps; being held down on restraints; raised voices on peaks; being ignored on recovery beats and sensory deprivation; darkness on blindfolds and sensory deprivation; smells on wax. Written-in triggers show on every peak. These warnings, the core watch list and the crying guidance are worked out from the intake each time, so no edit can remove them. (Approved.)
  - **Items they didn't answer** get the same amber "Discussed together?" flag as maybes.
  - **Warn rules** can be kept with a typed reason; overrides and kept warnings are listed with dates in each scene's Record.
  - **Conflict check (S3)** is shown inline in the editor for now (injury areas, maybes, and the rest) rather than as its own screen.
  - **A switch designs as the Top** in M4a; choosing the role per scene comes with M4b.

- **M3 changes after Michael's review:**
  - **How far you go** is a range on a 1 to 10 scale (1 Gentle, 10 Intense), with two handles and a tick for each step. Older one-number saves become a range from 1 up to the same point.
  - **Renaming built-in activities:** press and hold an activity (or use "Rename activities") to give it your own name, for example for gendered language. "Back to" restores Ember's name.
  - **"Default settings"** replaces "Use A.C.E.'s settings". It fills in A.C.E.'s aftercare, check-ins and voice, and never turns on the sex acts switch (Claude's choice).
  - **Intake order:** the essentials, then Safety, then Body and mind. Continue opens the next page at its top.
  - **Maps:** each quadrant is split into four (near the middle, out to either side, and the far corner), each with its own description.
  - **Toy opt-outs:** chosen from a dropdown, with the chosen people listed underneath.
  - **"Toys" is now "Gear"** everywhere in the app (the tab, My gear, Add gear, Share my gear). It is one fixed word, not editable. Discreet mode still says "Kit" and "My items". Sex-toy activities such as "Toys in mouth" keep their names.
  - **Account deletion** removing toy photos waits for M9 (Michael agreed).

- **M3 Top setup and toys** (built; Claude's choices, approved Nov 7):
  - **Offerings:** each play category is a switch with a degree (now a 1 to 10 range, see above). Inside a category every regular activity is on until the Top turns it off, and Tops can add their own. Edge play shows only in Studio mode and is never on by default. Penile and oral sex appear only if the Top turns on "can appear in my scenes" in their settings (off by default), and even then each item is chosen separately and only used when negotiated for that scene.
  - **Top settings:** aftercare 10% to 60% of scene length for regular and intense scenes (intense scenes never under 30 minutes), check-in cadence (none, weekly, twice a week, daily), a one-line voice, phase colors, and a one-tap starting point (now "Default settings"). A phase color too light for white text (under 4.5:1) is refused.
  - **Onboarding:** Tops now get the offerings and settings steps (both skippable). First toys (O7) need an account, so they start from the Toys tab after signing in.
  - **Toys:** anyone can keep a collection (Tops in the Toys tab, bottoms from My profile). Each toy is a photo plus three taps (feel, kind of play, name) and notes. Toy details and photos are locked on the phone; photos are made smaller (1000 px) and cleared of location and camera details first. Photos are stored in Supabase Storage (same provider, free tier includes 1 GB).
  - **Sharing toys** is per connection and off by default. Turning it off works right away and makes new keys, as with intake sharing. Ending a connection stops it both ways.
  - **Opt-outs:** a toy's owner can keep any toy out of scenes with one connection. Both people can see the opt-out, and the toy is hidden from that person's "Show their toys".
  - **Known gap for M9:** deleting an account must also delete that person's toy photos (the database rows go automatically; the photo files don't).

- **M2 intake choices:**
  - **Quick path:** all three word groups (Heat, Hold, Flow) are required once someone picks the quick path; no skipping a group. The desire decoder follows each of the three groups, whatever words were chosen, and the decoder itself can be skipped.
  - **Honorific suggestions:** Sir, Ma'am, Mx., Daddy, Mommy, Master, Mistress, Boss, Captain, Coach, plus "use my name" and write your own.
  - **Emergency contact** is part of "essentials only" sharing. "Call 911" is always an option for anyone who would rather not share a family member's or friend's details.
- **Safety floor 5 is now "Ready before starting."** The readiness check happens before the scene begins, inside the pre-scene check-in (M6). It replaces the readiness check before the bottom leaves.
- **After-scene and drop check-ins** (safety floor 4, M7):
  - Right after the scene, the Top and the bottom each give a simple 1 to 5 rating of how they feel.
  - The Top and the bottom then each get one notification a day for 3 days, opening the follow-up check-in, to catch sub drop and Top drop. (Michael, Nov 4: both get them.)
  - The Top's check-in reminder about 18 hours after the scene stays.
  - As with every check-in, turning off the notification stops only the phone alert; the check-in still waits inside the app.
  - Low ratings (approved): a 1 or 2 on "how are you feeling" right after the scene suggests staying together a little longer before heading home and not driving until steady; a 1 or 2 during the 3 days offers an easy way to message their partner or a friend.
- **Every check-in has three questions** (wording in `src/content/checkins.ts`; scales are 1 to 5):
  - **Pre-scene check-in (M6):** how you're feeling; whether you've had your final pre-scene negotiation (yes or no); how excited you are for this scene.
  - **Post-scene check-in, Top and bottom (M7):** how you're feeling; how attentive your Top was (asked of the bottom) or how responsive your bottom was (asked of the Top); an overall rating of the experience.
  - **Follow-up, once a day for 3 days (M7):** how you're feeling in body and mind; whether anything has changed since the scene (yes or no, with an optional note); notes for your Top or bottom, shared with them.
- **Personal codes show the Me tab.** The scene name and role shown with a personal code always match the Me tab (a "both" setting shows as switch), with no "usually."
- **App icon:** Michael supplied new icon files (Ember icon.png, ember_icon.svg, ember_icon_transparent.png), which replace the app icon.

## Nov 3, 2026

- **Personal codes and requests, no directory.** Anyone can keep a permanent personal code they choose (4 to 20 letters and numbers), alongside the 7-day invite codes and guest links. Typing someone's code shows their scene name and role and sends a request they accept or decline. Declining is quiet; "decline and block" also stops future requests without telling the sender. Codes can be changed or turned off. There is no searchable list of people.
- **Scene names.** Every name field asks for a scene name, so people share only what they choose. The scene name on a personal code is the one name Ember keeps readable on the server, because anyone with the code sees it.
- **Each person picks their own role in each connection:** Top, bottom or switch, and can change it later. Two switches can connect; two Tops or two bottoms can't, since no scene could be planned. With a switch, whoever designs a scene chooses the role they design it as (M4).
- **Electricity is not edge play.** It stays a regular sensation activity (Michael confirmed). The edge flags for choking, knife play, sharps and mummification are unchanged.
- **(Replaced Nov 7: gear is now added inside each section.)** **Specific toys are a toggle, not a separate design type.** Replaces the "Centerpiece" idea. Every scene design gets a toggle, "Use specific toys," off by default. When it is on, the designer picks toys to build around. (M4.)
  - A bottom designing for a chosen Top sees that Top's shared toys when they ask for them, through a "Show their toys" button, not up front.
  - A Top picks from their own toys.
  - Bottoms can keep their own toy collection too (M3, alongside the Top's toy directory).
- **Encryption plan approved** as written in `docs/encryption-plan.md`.
- **Email:** Brevo sends sign-in and password reset emails (Brevo handles email addresses only).
- **Backend:** Supabase project named `ember`.
- **No overrides belong to the bottom.** Intake gets a setting, "My Top may override a no after we talk," off by default. While it is off, a no item is a hard block for the Top, in the auto-designer and the editor. When it is on, the existing red flag and required confirmation apply. Changing the setting is dated and logged like any limit change. (Rules engine, M4; setting in intake, M2.)
- **Pre-scene check-in** (new, before the day-of pre-scene check). Shortly before the scene, both people get a check-in prompt:
  - The bottom answers how they're feeling (sliders and taps) and sees any maybe items the Top included, so they can say yes, no, or "let's talk".
  - The bottom can choose "Surprise me: don't tell me about maybes." Then maybes are not shown, and the Top sees that the bottom chose not to know.
  - The Top confirms the plan and sees the bottom's answers. A "no" to a maybe removes it from the plan before the scene.
  - Lands in M6, next to the day-of pre-scene check (which still locks the consent snapshot).
- **Intake for every scene.** The intake can and should be filled for each scene. The bottom can reuse an earlier intake as-is or as a starting point. Ember keeps every intake version, and every scene records the version it was designed from. (Data model in M1, screens in M2.)
- **Send the real design afterward.** After a scene, the Top is prompted to send the bottom the actual design, so they can see what happened. (M7.)
- **Donation prompt: once a month.** A polite note about keeping Ember free and open, with amounts starting at $5. Replaces the earlier weekly rule.
- **Toys belong to people, not roles.** Anyone can keep a toy collection. Within a connection, each person can share their collection with the other.
- **Either person can design.** A bottom can design a scene with a particular Top in mind, using that Top's shared toys; the design arrives for the Top as a request to accept and edit. A Top can likewise design using a bottom's shared toys. Every rule and block applies the same way. (M4.)
- **Inclusive by default.** Ember must not assume a male Top and female bottom.
  - Onboarding asks name to be called, pronouns and gender identity (all optional to describe, with self-describe options).
  - All copy uses each person's own pronouns, with they/them until known.
  - Activity labels never assume anatomy: "penis or strap-on," "vagina or front hole," "chest or breasts." The STI checkbox applies whenever a penis is involved.
  - Gender identity never decides which activities appear. A separate, optional "My body" step in intake (M2) lets each person choose which anatomy-specific activities to see and the words they prefer for their body.
  - Honorific suggestions include gender-neutral options.
- **Icon:** redrawn as a simple graphic ember (a glowing coal), keeping the same colors.

## Nov 1, 2026

- **Icon and name:** a glowing red-orange ember dot, named "Ember" on the home screen. Discreet mode changes only what shows inside the app.
- **Notifications:** every notification type can be turned off. Turning off check-in reminders stops the phone notification only; the check-in still appears inside the app (safety floor).
- **PIN:** PIN lock in M0, Face ID and fingerprint in M9. A forgotten PIN erases Ember on that phone (acceptable until accounts exist).
- **Age:** an "I'm 18 or older" confirmation on the welcome screen.
- **Map axes and quadrants:** in `product-spec.md` (The three maps).
- **Activity list:** taken from the A.C.E. Pre-Negotiation Form into `src/data/activities.ts`. Tops can add their own activities (M3) and bottoms can add their own in intake (M2). Custom activities behave like built-in ones.
- **Edge play flags** (Claude's proposal, approved Nov 7): choking, knife play, sharps and plastic wrap mummification. These are never auto-added and need Studio mode and explicit negotiation.
- **Phase colors:** Claude chooses the defaults; every color is customizable by each Top. Defaults are in `src/content/phases.ts`.
- **Aftercare:** minimum 30 minutes for any scene marked intense, whatever the Top's percentage setting.
- **Donations:** Zelle aceofkinkhtx@gmail.com, Cash App $michaelchapter4, Venmo @MichaelPBrown1. (Prompt frequency updated Nov 3: once a month.)
- **Hosting terms checked:** Supabase's acceptable use policy and Cloudflare's developer platform terms forbid illegal content (such as CSAM and non-consensual imagery) but do not restrict adult-adjacent apps. Ember stores no explicit imagery.
