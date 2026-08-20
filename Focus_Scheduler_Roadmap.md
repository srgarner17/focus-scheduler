# Focus Plan — Roadmap

_Last updated: 2026-08-20_

A running log of what's shipped and what's next for Focus Plan, the daily checklist app for keeping him on track with mornings, chores, and soccer prep.

## Restart point (2026-08-20)

If this session drops, here's exactly where things stand and how to pick back up.

- **Working tree:** clean, nothing uncommitted anywhere.
- **Current branch:** `add-roadmap-doc`, pushed, matches `origin/add-roadmap-doc` exactly.
- **`master`** is at commit `58946a5` — includes the GitHub Pages deploy (PR #1, merged). Live at https://srgarner17.github.io/focus-scheduler/.
- **Open PR:** [#2 "Add project roadmap doc"](https://github.com/srgarner17/focus-scheduler/pull/2) — this file, not yet merged. Merge it when ready, or keep adding to the `add-roadmap-doc` branch.
- **Immediate next action:** confirm the Vercel production URL from the Vercel dashboard (Project → Visit, or Settings → Domains) — this was in progress when the session paused. See [Open decisions](#open-decisions) below for what to do once you have it.
- **Repo state:** public, branch protection on `master` (PR required, admin bypass allowed), feature-branch workflow is the standing default. A new Claude Code session in this repo already has this saved in memory and shouldn't need re-explaining.

## Shipped this session

- [x] **Core app** — categories (Morning Routine, Chores, Soccer Prep) with checklist items, expandable sub-steps and tips, daily auto-reset, all saved locally in the browser
- [x] **Parent edit mode** — add/edit/delete categories, items, and sub-steps without touching code
- [x] **Day-of-week scheduling** — items can be limited to specific days (Soccer Prep items set to Mon/Tue/Wed to match practice)
- [x] **Week overview** — a Today/Week toggle with a 7-day strip and a read-only agenda per day, so the whole week's plan is visible at a glance
- [x] **Parent PIN lock** — Edit mode can require a 4-digit PIN so he can look but not touch
- [x] **iPad / home-screen support** — LAN access enabled, web manifest and Apple meta tags added so "Add to Home Screen" launches full-screen like a real app
- [x] **Live hosting** — deployed to GitHub Pages via GitHub Actions (auto-deploys on every push to `master`): https://srgarner17.github.io/focus-scheduler/
- [x] **Repo hygiene** — repo made public (required for free GitHub Pages), branch protection added on `master` (pull request required to merge; only the repo admin can bypass), and a feature-branch + PR workflow is now the standing default for future changes
- [x] **Vercel** — account created and the project imported as a second hosting option (production URL not yet confirmed — see below)

## Open decisions

- **Which hosting URL is "the" one?** The app is now live on both GitHub Pages and (pending URL confirmation) Vercel. Worth picking one as canonical before mounting an iPad, so there's no ambiguity about which link is current.
- **Multi-device sync.** Right now each device (each iPad, your phone) has its own independent local data — nothing syncs between them. If you want parents to check progress remotely, or multiple iPads mounted in different rooms, this needs a real backend. Recommendation: **Firebase Firestore** (free tier, real-time updates, generous limits for a family app) — this is a genuine data-layer rewrite, not a quick add, so worth scoping separately when you're ready.

## Next steps

1. **Confirm the Vercel URL** and decide GitHub Pages vs. Vercel vs. both.
2. **Set up the first iPad for real** — open the chosen URL in Safari, Add to Home Screen, enable Guided Access (Settings → Accessibility) for wall-mounting, and set a real parent PIN (the `1234` used during testing was only ever test data, never shipped).
3. **Customize the actual schedule** — Morning Routine and Chores items are still the placeholder set from setup; only Soccer Prep's days have been tailored to his real schedule so far.
4. **Scope and build the backend** (Firebase Firestore) once you're ready for multi-device sync and remote visibility — needed before mounting a second iPad anywhere.
5. **(Nice-to-have) custom app icon** — the home-screen icon currently uses the generic default favicon from setup, not a designed icon.

## Quick reference

| | |
|---|---|
| Live app (GitHub Pages) | https://srgarner17.github.io/focus-scheduler/ |
| Repo | https://github.com/srgarner17/focus-scheduler |
| Local dev | `./dev.bat` (or `npm run dev` if Node is on your PATH), then open the printed URL |
| LAN dev (for testing on a phone/tablet on the same wifi) | `npm run dev -- --host`, then open `http://<this-PC's-LAN-IP>:5173` |
