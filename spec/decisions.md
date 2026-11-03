# Decisions log

Decisions Michael made outside the spec tabs, newest first. The spec still wins where it is more specific.

## Nov 3, 2026

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
- **Centerpiece** (working name for a toy-specific design). Pick one or more toys and Ember designs the scene around them. Available to Tops and bottoms. (M4.)
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
