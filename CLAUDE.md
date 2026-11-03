# Ember: build brief for Claude Code

You are building **Ember**, a scene design app for BDSM Tops and bottoms. Michael Brown (A.C.E., a Service Top in Houston) designed it. He is not a developer, so explain decisions in plain language, keep him in the loop at every milestone, and ask before anything costs money.

## Sources of truth

Read these before writing code. If this brief and the spec disagree, the spec wins; if the spec is unclear, ask Michael.

| File | What it holds |
| --- | --- |
| `spec/product-spec.md` | Vision, features, decisions, Phase 1 scope, build approach |
| `spec/intake-and-data-model.md` | Detailed intake, pre-scene check, scene data model, design rules (block and warn), Top settings, debrief template |
| `spec/screens-top.md` | Every Top screen: purpose, elements, where it leads |
| `spec/screens-bottom.md` | Every bottom screen, including the guest link |
| `spec/daily-tips.md` | 120 tips for Tops and 120 for bottoms |
| `spec/decisions.md` | Michael's later decisions. Where it conflicts with the spec tabs or this brief, the decisions log wins |
| `prototype/*.dc.html` | Clickable design prototype: layout, colors, type, copy tone. Reference only, not production code |

## What Ember is, in one paragraph

One app for Tops, bottoms and switches, with a role toggle. A bottom shares desires and limits (detailed form, Heat / Hold / Flow word groups, or a desire map). The Top's rules engine proposes two or three scene designs built only from the bottom's yes items and the Top's offerings. The Top edits the design (phases, beats, steps), runs it in a dark Live Scene Mode guide, then both debrief. The bottom sees only a SceneVibe preview of the scene unless they request the plan and the Top chooses to send it. Profiles learn over time.

## Non-negotiable safety floor

These can never be removed or skipped by any user setting:

1. Safe words and signals confirmed aloud at the start of every scene (pre-scene check).
2. The limit strip (no items in red, maybe items in amber, physical care in blue) is visible throughout Live Scene Mode.
3. Every scene has an aftercare phase.
4. Sub drop risk is noted, and a check-in reminder is scheduled about 18 hours after the scene.
5. A readiness check before the bottom leaves (the close card).
6. Trauma and trigger flags appear as warning boxes on the beats where they are most likely to surface.

## Key product decisions (already made; do not relitigate)

- **Intake choices are yes, maybe, no.** The auto-designer uses only yes items.
- **Overrides (updated Nov 3, 2026):** the Top may add maybe items (amber flag, "Discussed together?"). A no item is blocked outright unless the bottom has turned on "My Top may override a no after we talk" in their intake, which is off by default. Only then can the Top add it, with an immediate red flag and the required confirmation: "They marked this as no. Have you talked and agreed to include it?" Every override is logged with its date in the connection's history. Maybes included in a scene are shown to the bottom at the pre-scene check-in unless they chose not to know; no overrides appear in their history after the scene.
- **Per-scene intake:** the bottom fills an intake for each scene or reuses an earlier one. Every scene records which intake version it was designed from.
- **Inclusive by default:** pronouns and gender identity are asked at the start; copy uses each person's pronouns (they/them until known); activity labels never assume anatomy from gender (for example "penis or strap-on"). Gender identity never decides which activities appear.
- **Plan privacy:** the bottom sees the SceneVibe by default. They can request the full plan; the Top decides whether to send it. No bottom approval step.
- **Consent snapshot:** the bottom's limits and preferences lock automatically when the bottom submits the pre-scene check.
- **Aftercare length:** a Top setting, defaulting to 25% of scene length, 33% for scenes marked intense, with "more if needed" always available.
- **Daily tips:** on by default for both roles, each with an opt-out.
- **No AI inside the app.** Scene design is a rules engine.
- **No STI results stored**, only checkboxes confirmed in person.
- **Discreet mode:** neutral app name and icon option, vague notification text ("Your daily note is ready"), PIN or biometric lock.
- **Feel options** for impact and toys: thuddy, stingy, sharp, other.
- **Copy rule:** never use an em dash anywhere in the interface or content. Use commas, colons, periods or parentheses instead.

## Technical approach (free to run)

Proposed stack; confirm with Michael before committing to anything that differs:

- **App:** installable web app (PWA), mobile-first, built with Vite, React and TypeScript.
- **Backend:** Supabase free tier for sign-in, Postgres, realtime messaging and scheduled jobs. Every table protected by row-level security, with tests proving one user cannot read another's data.
- **Hosting:** Cloudflare Pages or Netlify free tier.
- **Notifications:** web push via a service worker, for daily tips and check-in reminders. Note that iOS only allows web push after the app is added to the home screen; the onboarding should explain this.
- **Encryption:** sensitive fields (health, triggers, limits, overwhelm plans, Top observations, debrief notes) are encrypted on the device before upload so the server cannot read them. Use a well-reviewed library (libsodium or WebCrypto), never homemade crypto. **Before implementing, write Michael a one-page plain-language plan** covering how keys are shared with a connection, how access is revoked, and what happens if someone loses their phone (lost keys can mean lost data). He decides.
- **Live Scene Mode must work offline** once a scene is loaded, and keep the screen awake.
- **Privacy hygiene:** no analytics or tracking scripts, no sensitive data in logs, URLs or error reports. All test and seed data is fictional.

## The rules engine

Build it as a pure TypeScript module with no UI dependencies, so it can be tested thoroughly.

- **Inputs:** the bottom's profile (yes items, intensities, limits, maps, Heat / Hold / Flow, injuries, triggers), the Top's offerings and settings, scene length, the intense flag, toy opt-outs.
- **Outputs:** two or three candidate designs as Scene > Phase > Beat > Step structures.
- **Validator:** checks any design (auto or hand-edited) against the rules in the "Design rules" table of `spec/intake-and-data-model.md`. Block rules refuse the change with a one-line reason; warn rules allow an override with a reason.
- **Every block rule gets a unit test.** Write the tests first.

## Build order

Work in milestones. Each ends with something Michael can open on his phone, a short plain-language summary, and a pause for his feedback before moving on.

| # | Milestone | Done when |
| --- | --- | --- |
| M0 | Project setup | PWA shell installs on a phone; design tokens from the prototype; bottom tab bars for both roles; role toggle; discreet mode and PIN |
| M1 | Accounts and connections | Sign-in; invite a connection; guest link opens intake without an account |
| M2 | Bottom intake and profile | Essentials, word groups, desire map, desire decoder, detailed form, aftercare map, review and share; bottom owns and controls sharing of their profile |
| M3 | Top setup | Offerings with degree sliders, Top settings, toy directory with photos, three-tap tagging and per-bottom opt-outs; bottoms can keep a toy collection too (see decisions log) |
| M4 | Rules engine and editor | Design options screen; scene editor with drag to reorder phases, beats and steps; edit sheet; flags and logged overrides; saved library |
| M5 | SceneVibe | Static SceneVibe (intensity curve in phase colors, a shape and color per element type, surprise markers); plan request flow |
| M6 | Live Scene Mode | Pre-scene check that locks the consent snapshot; guide with DO / SAY / WATCH / NOTES; timers and restraint timer; red screen; regulation toolkit; quick log; pause |
| M7 | After the scene and messaging | Aftercare phase; Top and bottom debriefs; profile update suggestions; 18-hour check-in reminder; feelings log; direct messages with block and report |
| M8 | Daily tips | Convert the tables in `spec/daily-tips.md` into `data/tips.json` (fields: id, role, number, theme, text); daily scheduling; opt-out; discreet notification text |
| M9 | Hardening | Security and row-level security review; export and delete my data; accessibility pass (contrast, 44 px touch targets, screen readers); offline Live mode check |

## Design reference

Open the files in `prototype/` to see the intended look. Summary:

- **Planning screens:** warm paper ground `#F5EDE3` with a subtle dot grain; ink `#1E1418`; muted `#5E4C52`; ember `#B8400C`; garnet `#8E1B3B`; teal `#0B5D61`; saffron `#E8A33A`.
- **Bottom view:** a rose ground `#F7E9EC`, warmer and lighter in feel.
- **Live Scene Mode:** near-black `#141012` with the phase colors: arrival amber `#8B6000`, ritual purple `#5A005A`, first peak green `#2E6B2E`, recovery gray `#4A4A4A`, second peak blue `#1A3A6B`, aftercare deep red `#8B0000`. Phase colors are customizable by each Top.
- **Type:** Bricolage Grotesque for display, DM Sans for body (Google Fonts).
- Tap and slide over typing; one-word icons with an info icon for descriptions; real buttons and labels; text contrast at least 4.5:1.

## Out of scope for Phase 1

Animated SceneVibe, Draw Your Wave, program mode, points system, full ritual builder, custom templates, manual canvas from scratch, dynamic map, community features, any AI.

## Working agreements

- Small, reviewable steps. Commit after each working piece with a clear message.
- Explain what you built and why in plain language at each milestone.
- Ask Michael before adding any paid service, dependency with unclear licensing, or third-party data processor.
- Never weaken a safety floor item or a block rule to make something easier to build.
- When unsure about a product decision, check the spec, then ask.
