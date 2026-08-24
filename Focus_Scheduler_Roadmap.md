# Focus Plan — Roadmap

_Last updated: 2026-08-24_

A living list of what's next and open for Focus Plan, the daily checklist app for keeping him on track with mornings, chores, and soccer prep. Shipped work isn't tracked here in detail — the [PR history](https://github.com/srgarner17/focus-scheduler/pulls?q=is%3Apr+is%3Amerged) and commit log are the source of truth for what's already done; this doc stays focused on what's pending.

## Restart point (2026-08-24)

If this session drops, here's exactly where things stand and how to pick back up.

- **Working tree:** clean, nothing uncommitted anywhere.
- **`master`** has everything merged through PR #11 (landscape/wide-screen category grid). Nothing outstanding.
- **Canonical URL:** https://srgarner17.github.io/focus-scheduler/ (GitHub Pages). Vercel (https://focus-scheduler-sand.vercel.app/) is a working backup, not primary.
- **Data is shared and synced** — both parents' devices and the iPad read/write the same Firebase Firestore document in real time. There is no separate "test" environment; every deployment (prod or PR preview) hits the same real household data.
- **Immediate next action:** none blocking — natural pause point. Next up whenever ready: reordering, or the new "links in item descriptions" idea below (see [Next steps](#next-steps)).
- **Repo state:** public, branch protection on `master` (PR required, admin bypass allowed), feature-branch workflow is the standing default. A new Claude Code session in this repo already has this saved in memory and shouldn't need re-explaining.
- **Working style note:** build one item at a time, verify it, open its PR, then stop and wait rather than chaining multiple features together unprompted. Update this roadmap proactively after merges, not just when asked.

## Open decisions

- **Automated tests.** Everything so far has been verified manually (throwaway Firestore test document + browser automation) before each commit — there's no repeatable automated suite. Scoped below, deliberately not started yet.
- **Notifications (two-way).** Parents want to know when something is/isn't done by a certain time. Deferred — needs real design thinking (what counts as "on time," how a parent gets notified when the app isn't open) before it's even scoped, and technically needs Firebase Cloud Functions, which requires the paid Blaze tier rather than the free Spark plan currently in use.

## Automated testing scope (ready to pick up later)

Scoped 2026-08-24, not yet started. Full plan so a future session can start straight into implementation instead of re-deriving this.

**Tooling:** Vitest (Vite-native, shares existing config, fast) + React Testing Library + jsdom for anything that renders. For Firestore-dependent code, **mock the SDK** (`onSnapshot`, `setDoc`) rather than run the Firebase Local Emulator Suite — the emulator is more realistic but needs a Java runtime and real setup overhead; mocking is enough to test our own logic.

**Tier 1 — pure functions, no mocking (cheapest, highest value, do first):**
- `lib/date.ts` — `todayKey`, `currentWeekDateKeys`, `formatDateShort`. Timezone/date-boundary bugs are exactly the kind that fail silently.
- `types.ts` — `isItemDone`, `isItemScheduledOn`. The core scheduling-match logic; a regression here misfires silently (wrong day, or no day).
- `lib/storage.ts` — `normalize` (migration) and `resetCompletion`, tested against old/malformed data shapes so migrations keep working as the schema grows.

**Tier 2 — the `useSchedule` hook, Firestore mocked (medium effort, highest payoff — covers real bugs already hit):**
- Regression test for the cursor-jump bug: assert `mutate()` updates local state synchronously, not only after the mocked async write resolves.
- Regression test for the overnight-reset bug: inject a fake clock, confirm the timer/focus-triggered check resets a stale `lastResetDate`.
- Sanity coverage for `toggleItem`, `addItem`, `deleteItem`, etc.

**Tier 3 — component behavior (capped scope, don't chase full coverage):**
- `CategorySection` — auto-collapse fires when complete, resets when not.
- `ItemCard` — recurring/one-time toggle switches correctly.
- Deliberately skip presentational-only components (`ProgressBar`, `DayPicker` rendering).

**Explicitly out of scope for now:** Firestore emulator / security-rule testing (rules are trivial today), end-to-end browser tests via Playwright (defer unless a class of bug keeps slipping past unit tests), visual regression testing (overkill at this scale).

**CI:** once tests exist, add a `test.yml` GitHub Actions workflow that runs on every pull request (not just push to `master`), so a broken test blocks a bad PR before merge — pairs naturally with the branch protection already in place.

## Next steps

1. **Reordering** — drag (or similar) to reorder individual items within a category, and to reorder categories themselves. Nothing built yet; current order is just array order from when things were added.
2. **Links in item descriptions** — an optional link per item (e.g. a video of a soccer drill) rendered as a clear "▶ Watch" button, so he can quickly see how to do something instead of just reading text. Opens in a new tab; no inline video player planned (too much complexity for the payoff, especially with YouTube embeds).
3. **Scope notifications** — even though the build is deferred, worth thinking through *how* parents would actually be notified (push notification vs. something simpler) before committing to the Cloud Functions approach.
4. **Automated test suite** — see [Automated testing scope](#automated-testing-scope-ready-to-pick-up-later) above; fully scoped and ready to start.
5. **(Nice-to-have) custom app icon** — the home-screen icon still uses the generic default favicon from setup, not a designed icon.

## Quick reference

| | |
|---|---|
| Live app (canonical) | https://srgarner17.github.io/focus-scheduler/ |
| Live app (backup) | https://focus-scheduler-sand.vercel.app/ |
| Repo | https://github.com/srgarner17/focus-scheduler |
| Local dev | `./dev.bat` (or `npm run dev` if Node is on your PATH), then open the printed URL |
| LAN dev (for testing on a phone/tablet on the same wifi) | `npm run dev -- --host`, then open `http://<this-PC's-LAN-IP>:5173` |
