# Focus Plan — Roadmap

_Last updated: 2026-08-25_

A living list of what's next and open for Focus Plan, the daily checklist app for keeping him on track with mornings, chores, and soccer prep. Shipped work isn't tracked here in detail — the [PR history](https://github.com/srgarner17/focus-scheduler/pulls?q=is%3Apr+is%3Amerged) and commit log are the source of truth for what's already done; this doc stays focused on what's pending.

## Restart point (2026-08-25)

If this session drops, here's exactly where things stand and how to pick back up.

- **Working tree:** clean, nothing uncommitted anywhere.
- **`master`** has everything merged through PR #18 (resequenced tests before the editing UX redesign). Nothing else outstanding on master.
- **Canonical URL:** https://srgarner17.github.io/focus-scheduler/ (GitHub Pages). Vercel (https://focus-scheduler-sand.vercel.app/) is a working backup, not primary.
- **Data is shared and synced** — both parents' devices and the iPad read/write the same Firebase Firestore document in real time. There is no separate "test" environment; every deployment (prod or PR preview) hits the same real household data.
- **Immediate next action:** [PR #19](https://github.com/srgarner17/focus-scheduler/pull/19) adds Tier 1 of the automated test suite (Vitest + RTL + jsdom installed, 21 tests for `lib/date.ts`/`types.ts`/`lib/storage.ts`, CI workflow running on every PR) — open, awaiting review/merge. Tier 2 (the `useSchedule` hook, Firestore mocked) is the natural next pickup — see [Automated testing scope](#automated-testing-scope). The **editing UX redesign** is fully scoped and queued up after the test suite — see [Editing UX redesign](#editing-ux-redesign-ready-to-pick-up-later).
- **Repo state:** public, branch protection on `master` (PR required, admin bypass allowed), feature-branch workflow is the standing default. A new Claude Code session in this repo already has this saved in memory and shouldn't need re-explaining.
- **Working style note:** build one item at a time, verify it, open its PR, then stop and wait rather than chaining multiple features together unprompted. Update this roadmap proactively after merges, not just when asked.

## Open decisions

- **Automated tests.** Tier 1 (pure functions) is done and running in CI on every PR — see below. Tier 2/3 (the `useSchedule` hook and component behavior) are scoped but not started yet.
- **Notifications (two-way).** Parents want to know when something is/isn't done by a certain time. Deferred — needs real design thinking (what counts as "on time," how a parent gets notified when the app isn't open) before it's even scoped, and technically needs Firebase Cloud Functions, which requires the paid Blaze tier rather than the free Spark plan currently in use.

## Automated testing scope

Scoped 2026-08-24. Tier 1 done 2026-08-25; Tiers 2-3 still ready to pick up.

**Tooling:** Vitest (Vite-native, shares existing config, fast) + React Testing Library + jsdom for anything that renders. For Firestore-dependent code, **mock the SDK** (`onSnapshot`, `setDoc`) rather than run the Firebase Local Emulator Suite — the emulator is more realistic but needs a Java runtime and real setup overhead; mocking is enough to test our own logic.

**Tier 1 — pure functions, no mocking (done 2026-08-25, 21 tests):**
- `lib/date.ts` — `dateKeyFor`, `todayKey`, `todayDayIndex`, `currentWeekDateKeys`, `formatDateShort`. Covers the UTC-midnight-parsing pitfall and week/month-boundary math directly.
- `types.ts` — `isItemDone`, `isItemScheduledOn`. The core scheduling-match logic, including one-time-date-overrides-days precedence.
- `lib/storage.ts` — `normalize` (migration) and `resetCompletion`, tested against old/malformed data shapes so migrations keep working as the schema grows. `firebase/firestore` and `./firebase` are mocked in this test file so importing `storage.ts` doesn't trigger a real Firestore client in jsdom.
- Runs via `npm run test` (or `npm run test:watch`), and in CI on every PR via `.github/workflows/test.yml`.

**Tier 2 — the `useSchedule` hook, Firestore mocked (medium effort, highest payoff — covers real bugs already hit):**
- Regression test for the cursor-jump bug: assert `mutate()` updates local state synchronously, not only after the mocked async write resolves.
- Regression test for the overnight-reset bug: inject a fake clock, confirm the timer/focus-triggered check resets a stale `lastResetDate`.
- Sanity coverage for `toggleItem`, `addItem`, `deleteItem`, etc.

**Tier 3 — component behavior (capped scope, don't chase full coverage):**
- `CategorySection` — auto-collapse fires when complete, resets when not.
- `ItemCard` — recurring/one-time toggle switches correctly.
- Deliberately skip presentational-only components (`ProgressBar`, `DayPicker` rendering).

**Explicitly out of scope for now:** Firestore emulator / security-rule testing (rules are trivial today), end-to-end browser tests via Playwright (defer unless a class of bug keeps slipping past unit tests), visual regression testing (overkill at this scale).

**CI:** done — `.github/workflows/test.yml` runs `npm run test` on every pull request, pairing with the branch protection already in place so a broken test blocks a bad PR before merge.

## Editing UX redesign (ready to pick up later)

Scoped 2026-08-25, not yet started. The current draft/Done-button mechanism (PRs #15–16) works and is fixed, but its layered state (global Edit mode → per-item expand → per-item local draft → explicit commit) is what caused essentially every editing bug this session: the cursor-jump race, the overnight-reset data-loss bug's cousin, the unmount-during-commit bug, and the flash-revert bug. Rather than keep hardening that design, replace it with a structurally simpler one before building more on top of it.

**Core idea:** autosave with a debounce, plus a visible sync-status indicator, instead of buffering a whole item's edits until an explicit "Done" commit. This is the same pattern Notion, Linear, and Google Docs use — edit, pause, it saves, no separate mode to remember to exit.

**What changes:**
- **Remove the `ItemCard`-level draft entirely** (`Draft`/`dirty`/`commitDraft`/`finishEditing`/`draftRef`, and the per-item "Done" button). Text fields (title, notes, sub-step text, child's name) go back to calling `updateItemMeta` / `updateSubStepText` / `setChildName` directly on every `onChange`, same shape as before PR #13's per-keystroke-write days.
- **Move debouncing into the data layer, not the component.** In `useSchedule.ts`, wrap the text-field mutation path so the *local* optimistic state still updates synchronously on every keystroke (this is what the cursor-jump fix in PR #5 depends on — must not regress it), but the actual Firestore transaction for that field is delayed ~500–600ms after the last keystroke, resetting the timer on each new one. Non-text actions (toggling done, adding/deleting an item or category, the day picker, the one-time/recurring switch) stay immediate — they're already discrete, cheap, one-shot writes with no typing race to debounce.
- **Add a `saveStatus` value exposed from the hook** (`idle` / `saving` / `saved` / `error`), derived from whether any debounce timer or in-flight transaction is currently pending, plus whether the most recent write settled or rejected.
- **Add a small status indicator in the header** (near the Edit button or progress card): a subtle "Saving…" while pending, "Saved" that fades after a couple seconds once settled, "Couldn't save — tap to retry" if a write's promise rejects. This is the actual trust-builder — a parent should never have to wonder whether an edit stuck.
- **Undo for destructive actions, not every edit.** Add a brief "Category deleted — Undo" / "Item deleted — Undo" toast for delete actions specifically (the one place an accidental tap is genuinely hard to recover from); routine text edits don't need it since nothing is hidden or buffered anymore — what's on screen is what's saved (or about to be), so fixing a typo is just retyping it.
- **Keep as-is:** the Firestore transaction mechanism itself (correct, not the source of these bugs), real-time sync, the PIN-gated parental lock concept (still needed — reframe as "unlocked for editing" rather than a heavyweight "mode" if it helps, but the underlying gate stays), expand/collapse for progressive disclosure (notes/day-picker/sub-steps), and everything unrelated to saving (scheduling logic, auto-collapse, layout).

**Explicitly out of scope:** redesigning the visual layout or information architecture of the checklist itself — this is scoped purely to the save mechanism and edit affordances.

**Sequencing note (revised 2026-08-25):** automated tests now come *first* — see [Next steps](#next-steps). Tier 1 (pure functions, done) and Tier 2 (the `useSchedule` hook's public methods — `toggleItem`, `updateItemMeta`, etc.) are unaffected by this redesign, since the hook's public API doesn't change shape, only its internal debounce timing for text fields. Tier 3 component tests will be written against observable behavior (type a value, it eventually persists; toggle recurring/one-time, the flag flips) rather than today's specific "click Done" interaction, so they hold up through the redesign instead of needing a rewrite.

## Next steps

1. **Automated test suite, Tier 2 & 3** — see [Automated testing scope](#automated-testing-scope) above; Tier 1 is done (2026-08-25). Written against public/observable behavior rather than internal implementation details, so these survive the editing UX redesign below and double as a regression safety net for it.
2. **Editing UX redesign** — see [full scope](#editing-ux-redesign-ready-to-pick-up-later) below. Replaces the draft/Done-button mechanism (shipped and working, PRs #15–16) with autosave + a sync-status indicator, removing the state layer that's caused most of the recent bugs rather than continuing to patch it. Picked up after the test suite lands.
3. **Reordering** — drag (or similar) to reorder individual items within a category, and to reorder categories themselves. Nothing built yet; current order is just array order from when things were added.
4. **Links in item descriptions** — an optional link per item (e.g. a video of a soccer drill) rendered as a clear "▶ Watch" button, so he can quickly see how to do something instead of just reading text. Opens in a new tab; no inline video player planned (too much complexity for the payoff, especially with YouTube embeds).
5. **Scope notifications** — even though the build is deferred, worth thinking through *how* parents would actually be notified (push notification vs. something simpler) before committing to the Cloud Functions approach.
6. **(Nice-to-have) custom app icon** — the home-screen icon still uses the generic default favicon from setup, not a designed icon.

## Quick reference

| | |
|---|---|
| Live app (canonical) | https://srgarner17.github.io/focus-scheduler/ |
| Live app (backup) | https://focus-scheduler-sand.vercel.app/ |
| Repo | https://github.com/srgarner17/focus-scheduler |
| Local dev | `./dev.bat` (or `npm run dev` if Node is on your PATH), then open the printed URL |
| LAN dev (for testing on a phone/tablet on the same wifi) | `npm run dev -- --host`, then open `http://<this-PC's-LAN-IP>:5173` |
