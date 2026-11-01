# Ember handoff: start here

This folder is everything Claude Code needs to start building Ember.

## 1. Put the folder somewhere permanent

Unzip it and move the `ember-handoff` folder somewhere you'll keep it, such as Documents. You can rename it `Ember`. This becomes the app's project folder.

## 2. Add the spec

Open the Ember spec doc in Claude and export each tab as Markdown into the `spec` folder, using these exact names:

| Doc tab | Save as |
| --- | --- |
| Ember: Product Spec (first tab) | `spec/product-spec.md` |
| Intake and Data Model | `spec/intake-and-data-model.md` |
| Screens: Top | `spec/screens-top.md` |
| Screens: Bottom | `spec/screens-bottom.md` |
| Daily Tips | `spec/daily-tips.md` |

Whenever you change the doc later, export the changed tab again so Claude Code stays current.

## 3. Open the folder in Claude Code

Open the Claude desktop app, go to the Code tab, and choose this folder. Claude Code reads `CLAUDE.md` automatically every session.

## 4. Paste this as your first message

> Read CLAUDE.md, everything in spec/, and the prototype files. Then give me a short plain-language summary of what you understand Ember to be, list any questions or gaps you see in the spec, and propose the plan for milestone M0. Don't write code until I approve the plan.

## 5. Then work milestone by milestone

After each milestone, try it on your phone, give feedback, and approve the next one. Expect this to take many sessions. That's normal.

## What's in here

- `CLAUDE.md`: the build brief
- `spec/`: where the exported doc tabs go
- `prototype/`: the ten clickable prototype screens, as design reference
