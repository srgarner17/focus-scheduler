# Focus Plan — Roadmap

_Last updated: 2026-08-24_

A running log of what's shipped and what's next for Focus Plan, the daily checklist app for keeping him on track with mornings, chores, and soccer prep.

## Restart point (2026-08-24)

If this session drops, here's exactly where things stand and how to pick back up.

- **Working tree:** clean, nothing uncommitted anywhere.
- **`master`** has every feature below merged — PRs #1 through #8 are all merged, nothing outstanding.
- **Canonical URL:** https://srgarner17.github.io/focus-scheduler/ (GitHub Pages). Vercel (https://focus-scheduler-sand.vercel.app/) is a working backup, not primary.
- **Data is now shared and synced** — both parents' devices and the iPad read/write the same Firebase Firestore document in real time. There is no separate "test" environment; every deployment (prod or PR preview) hits the same real household data.
- **Immediate next action:** none blocking — this is a natural pause point. Next up whenever ready: landscape iPad layout, then reordering (see [Next steps](#next-steps)).
- **Repo state:** public, branch protection on `master` (PR required, admin bypass allowed), feature-branch workflow is the standing default. A new Claude Code session in this repo already has this saved in memory and shouldn't need re-explaining.
- **Working style note:** build one item at a time, verify it, open its PR, then stop and wait rather than chaining multiple features together unprompted.

## Shipped

- [x] **Core app** — categories (Morning Routine, Chores, Soccer Prep) with checklist items, expandable sub-steps and tips, daily auto-reset
- [x] **Parent edit mode** — add/edit/delete categories, items, and sub-steps without touching code
- [x] **Day-of-week scheduling** — items can be limited to specific days (Soccer Prep set to Mon/Tue/Wed to match practice)
- [x] **One-time (non-repeating) items** — an item can instead be pinned to one exact calendar date and never repeat; shows a date badge, correctly placed in Week view only for the week it actually falls in
- [x] **Week overview** — a Today/Week toggle with a 7-day strip and a read-only agenda per day
- [x] **Auto-collapse completed sections** — a category collapses to "All done — tap to review" once everything in it is checked off; reopens on tap and re-collapses fresh the next time it's completed
- [x] **Parent PIN lock** — Edit mode requires a 4-digit PIN; since the PIN now lives in the shared synced document, it's one PIN shared by both parents rather than per-device
- [x] **Real-time multi-device sync** — Firebase Firestore backs the whole schedule; a change on any device (either parent's phone, the iPad) appears on every other open device within about a second. Offline persistence means a device without wifi keeps working and syncs once reconnected
- [x] **iPad / home-screen support** — web manifest and Apple meta tags so "Add to Home Screen" launches full-screen like a real app; Guided Access walkthrough done for wall-mounting
- [x] **Live hosting on two platforms** — GitHub Pages (canonical) and Vercel (backup), both auto-deploy on every push to `master`
- [x] **Repo hardening** — public repo (required for free GitHub Pages), branch protection on `master`, feature-branch + PR workflow as the standing default

### Bug fixes along the way
- [x] Fixed the production build silently breaking on Vercel (it was hardcoded to GitHub Pages' subpath)
- [x] Fixed text input cursor jumping to the end after every keystroke (a side effect of the Firestore rewrite)
- [x] Fixed the daily reset not firing on a device left open overnight (e.g. the wall-mounted iPad) — it now re-checks the date on a timer and on focus, not only when a Firestore snapshot happens to arrive

## Open decisions

- **Automated tests.** Everything so far has been verified manually (throwaway Firestore test document + browser automation) before each commit — there's no repeatable automated suite, so nothing currently guards against a future change silently breaking something already fixed once. Proposed: Vitest for the logic-heavy pieces (scheduling/date functions, the sync hook's mutations) plus maybe React Testing Library for key component behavior. Not yet scoped or started — waiting on priority call against the feature list below.
- **Notifications (two-way).** Parents want to know when something is/isn't done by a certain time. Deferred — needs real design thinking (what counts as "on time," how a parent gets notified when the app isn't open) before it's even scoped, and technically needs Firebase Cloud Functions, which requires the paid Blaze tier rather than the free Spark plan currently in use.

## Next steps

Prioritized list from the latest round of family feedback (weekend of 2026-08-22–23):

1. **Landscape iPad layout** — the app is a single narrow centered column even on a wide screen; needs a layout that uses the horizontal space on a landscape-oriented iPad.
2. **Reordering** — drag (or similar) to reorder individual items within a category, and to reorder categories themselves. Nothing built yet; current order is just array order from when things were added.
3. **Scope notifications** — even though the build is deferred, worth thinking through *how* parents would actually be notified (push notification vs. something simpler) before committing to the Cloud Functions approach.
4. **Automated test suite** — see Open decisions above.
5. **(Nice-to-have) custom app icon** — the home-screen icon still uses the generic default favicon from setup, not a designed icon.

## Quick reference

| | |
|---|---|
| Live app (canonical) | https://srgarner17.github.io/focus-scheduler/ |
| Live app (backup) | https://focus-scheduler-sand.vercel.app/ |
| Repo | https://github.com/srgarner17/focus-scheduler |
| Local dev | `./dev.bat` (or `npm run dev` if Node is on your PATH), then open the printed URL |
| LAN dev (for testing on a phone/tablet on the same wifi) | `npm run dev -- --host`, then open `http://<this-PC's-LAN-IP>:5173` |
