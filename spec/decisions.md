# Decisions log

Decisions Michael made outside the spec tabs, newest first. The spec still wins where it is more specific.

## Nov 4, 2026

- **M3 changes after Michael's review:**
  - **How far you go** is a range on a 1 to 10 scale (1 Gentle, 10 Intense), with two handles and a tick for each step. Older one-number saves become a range from 1 up to the same point.
  - **Renaming built-in activities:** press and hold an activity (or use "Rename activities") to give it your own name, for example for gendered language. "Back to" restores Ember's name.
  - **"Default settings"** replaces "Use A.C.E.'s settings". It fills in A.C.E.'s aftercare, check-ins and voice, and never turns on the sex acts switch (Claude's choice).
  - **Intake order:** the essentials, then Safety, then Body and mind. Continue opens the next page at its top.
  - **Maps:** each quadrant is split into four (near the middle, out to either side, and the far corner), each with its own description.
  - **Toy opt-outs:** chosen from a dropdown, with the chosen people listed underneath.
  - **Account deletion** removing toy photos waits for M9 (Michael agreed).

- **M3 Top setup and toys** (built; Claude's choices for Michael to confirm):
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
- **Specific toys are a toggle, not a separate design type.** Replaces the "Centerpiece" idea. Every scene design gets a toggle, "Use specific toys," off by default. When it is on, the designer picks toys to build around. (M4.)
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
- **Edge play flags** (Claude's proposal, Michael to confirm): choking, knife play, sharps and plastic wrap mummification. These are never auto-added and need Studio mode and explicit negotiation.
- **Phase colors:** Claude chooses the defaults; every color is customizable by each Top. Defaults are in `src/content/phases.ts`.
- **Aftercare:** minimum 30 minutes for any scene marked intense, whatever the Top's percentage setting.
- **Donations:** Zelle aceofkinkhtx@gmail.com, Cash App $michaelchapter4, Venmo @MichaelPBrown1. (Prompt frequency updated Nov 3: once a month.)
- **Hosting terms checked:** Supabase's acceptable use policy and Cloudflare's developer platform terms forbid illegal content (such as CSAM and non-consensual imagery) but do not restrict adult-adjacent apps. Ember stores no explicit imagery.
