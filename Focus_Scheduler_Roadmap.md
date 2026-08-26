# Focus Plan — Roadmap

_Last updated: 2026-08-26_

A living list of what's next and open for Focus Plan, the daily checklist app for keeping him on track with mornings, chores, and soccer prep. Shipped work isn't tracked here in detail — the [PR history](https://github.com/srgarner17/focus-scheduler/pulls?q=is%3Apr+is%3Amerged) and commit log are the source of truth for what's already done; this doc stays focused on what's pending.

## Restart point (2026-08-26)

If this session drops, here's exactly where things stand and how to pick back up.

- **Working tree:** clean, nothing uncommitted anywhere.
- **`master`** has everything merged through PR #26 (manual-trigger fallback for the Pages deploy workflow, added during a GitHub-wide Actions/Pages outage). Nothing else outstanding on master.
- **Canonical URL:** https://srgarner17.github.io/focus-scheduler/ (GitHub Pages). Vercel (https://focus-scheduler-sand.vercel.app/) is a working backup, not primary. **Known issue (2026-08-26):** the live site is temporarily behind `master` — a GitHub-wide Actions/Pages outage (started ~15:11 UTC) has prevented the last couple of merges from deploying; a manual deploy was queued but stuck behind the same outage. No code fix needed — just re-check once GitHub's status page shows Actions/Pages back to "Operational," then re-run the "Deploy to GitHub Pages" workflow from the Actions tab if it doesn't catch up on its own. `./dev.bat` locally is unaffected and already has everything through Step 3.
- **Data is shared and synced** — both parents' devices and the iPad read/write the same Firebase Firestore document in real time. There is no separate "test" environment; every deployment (prod or PR preview) hits the same real household data.
- **Immediate next action:** the editing UX redesign is being delivered as a sequence of small, independently-verifiable steps rather than one big change (see [Incremental delivery plan](#editing-ux-redesign-ready-to-pick-up-later)) — Step 3 (debounced autosave extended to category names) is done, PR open. Step 4 (the big one — `ItemCard` fields + removing the draft/Done-button mechanism entirely) is next once that PR merges.
- **Repo state:** public, branch protection on `master` (PR required, admin bypass allowed), feature-branch workflow is the standing default. A new Claude Code session in this repo already has this saved in memory and shouldn't need re-explaining.
- **Working style note:** build one item at a time, verify it, open its PR, then stop and wait rather than chaining multiple features together unprompted. Update this roadmap proactively after merges, not just when asked (including this "Restart point" block itself — it's gone stale a few times when only a section further down got updated).

## Open decisions

- **Automated tests.** All three tiers (pure functions, the `useSchedule` hook, component behavior) are done and running in CI on every PR — see below.
- **Notifications (two-way).** Parents want to know when something is/isn't done by a certain time. Deferred — needs real design thinking (what counts as "on time," how a parent gets notified when the app isn't open) before it's even scoped, and technically needs Firebase Cloud Functions, which requires the paid Blaze tier rather than the free Spark plan currently in use.
- **Offline write feedback.** Found during Step 1 UAT (2026-08-26): a transaction has no offline path (unlike plain writes, which the app's offline cache can queue), so an edit made with no connection just sits pending forever with no error and no confirmation — see the note under [Editing UX redesign](#editing-ux-redesign-ready-to-pick-up-later) Step 1. **Deliberately held, not scoped (2026-08-26):** there's no real scenario today where editing while genuinely offline matters enough to justify the work — revisit only if that changes.

## Automated testing scope

Scoped 2026-08-24. All three tiers done 2026-08-25.

**Tooling:** Vitest (Vite-native, shares existing config, fast) + React Testing Library + jsdom for anything that renders. For Firestore-dependent code, **mock the SDK** (`onSnapshot`, `setDoc`) rather than run the Firebase Local Emulator Suite — the emulator is more realistic but needs a Java runtime and real setup overhead; mocking is enough to test our own logic.

**Tier 1 — pure functions, no mocking (done 2026-08-25, 21 tests):**
- `lib/date.ts` — `dateKeyFor`, `todayKey`, `todayDayIndex`, `currentWeekDateKeys`, `formatDateShort`. Covers the UTC-midnight-parsing pitfall and week/month-boundary math directly.
- `types.ts` — `isItemDone`, `isItemScheduledOn`. The core scheduling-match logic, including one-time-date-overrides-days precedence.
- `lib/storage.ts` — `normalize` (migration) and `resetCompletion`, tested against old/malformed data shapes so migrations keep working as the schema grows. `firebase/firestore` and `./firebase` are mocked in this test file so importing `storage.ts` doesn't trigger a real Firestore client in jsdom.
- Runs via `npm run test` (or `npm run test:watch`), and in CI on every PR via `.github/workflows/test.yml`.

**Tier 2 — the `useSchedule` hook, Firestore mocked (done 2026-08-25, 5 tests):**
- Regression test for the cursor-jump bug: asserts `mutate()` updates local state synchronously, in the same tick as the call, not only after the mocked async transaction resolves.
- Regression test for the overnight-reset bug: fakes only `Date` (real timers otherwise), fires a `focus` event a day later, confirms the transaction resets a stale `lastResetDate` and completion state.
- Sanity coverage for `toggleItem` (including the all-sub-steps-together case), `addItem`/`deleteItem`, and same-device write ordering.
- `firebase/firestore`'s `onSnapshot`/`runTransaction`/`doc` are mocked with a small in-memory "server document," rather than the Firebase Local Emulator Suite.

**Tier 3 — component behavior (done 2026-08-25, 7 tests):**
- `CategorySection` — auto-collapses once every item is done, stays open while work remains, lets the user manually reopen a collapsed section, and resets that override (re-collapsing fresh) the next time new work is completed. Never auto-collapses in edit mode.
- `ItemCard` — the recurring/one-time toggle switches the active button and date-vs-day-picker UI correctly, and commits only the changed `date` field (not the whole draft) when Done is tapped, in both directions.
- Presentational-only components (`ProgressBar`, `DayPicker` rendering) skipped as planned.
- RTL doesn't auto-cleanup between tests without `test.globals: true`; `src/test/setup.ts` registers `afterEach(cleanup)` explicitly so component tests don't leak DOM nodes across cases in the same file.

**Explicitly out of scope for now:** Firestore emulator / security-rule testing (rules are trivial today), end-to-end browser tests via Playwright (defer unless a class of bug keeps slipping past unit tests), visual regression testing (overkill at this scale).

**CI:** done — `.github/workflows/test.yml` runs `npm run test` on every pull request, pairing with the branch protection already in place so a broken test blocks a bad PR before merge.

## Editing UX redesign (ready to pick up later)

Scoped 2026-08-25, not yet started. The current draft/Done-button mechanism (PRs #15–16) works and is fixed, but its layered state (global Edit mode → per-item expand → per-item local draft → explicit commit) is what caused essentially every editing bug this session: the cursor-jump race, the overnight-reset data-loss bug's cousin, the unmount-during-commit bug, and the flash-revert bug. Rather than keep hardening that design, replace it with a structurally simpler one before building more on top of it.

**Core idea:** autosave with a debounce, plus a visible sync-status indicator, instead of buffering a whole item's edits until an explicit "Done" commit. This is the same pattern Notion, Linear, and Google Docs use — edit, pause, it saves, no separate mode to remember to exit.

**What changes:**
- **Remove the `ItemCard`-level draft entirely** (`Draft`/`dirty`/`commitDraft`/`finishEditing`/`draftRef`, and the per-item "Done" button). Text fields (title, notes, sub-step text, child's name) go back to calling `updateItemMeta` / `updateSubStepText` / `setChildName` directly on every `onChange`, same shape as before PR #13's per-keystroke-write days.
- **Move debouncing into the data layer, not the component.** In `useSchedule.ts`, wrap the text-field mutation path so the *local* optimistic state still updates synchronously on every keystroke (this is what the cursor-jump fix in PR #5 depends on — must not regress it), but the actual Firestore transaction for that field is delayed ~500–600ms after the last keystroke, resetting the timer on each new one. Non-text actions (toggling done, adding/deleting an item or category, the day picker, the one-time/recurring switch) stay immediate — they're already discrete, cheap, one-shot writes with no typing race to debounce.
- **Add a `saveStatus` value exposed from the hook** (`idle` / `saving` / `saved` / `error`), derived from whether any debounce timer or in-flight transaction is currently pending, plus whether the most recent write settled or rejected. **Done (2026-08-26) — see Step 1 below.**
- **Add a small status indicator in the header** (near the Edit button or progress card): a subtle "Saving…" while pending, "Saved" that fades after a couple seconds once settled, "Couldn't save — tap to retry" if a write's promise rejects. This is the actual trust-builder — a parent should never have to wonder whether an edit stuck. **Done (2026-08-26) — see Step 1 below.**
- **Undo for destructive actions, not every edit.** Add a brief "Category deleted — Undo" / "Item deleted — Undo" toast for delete actions specifically (the one place an accidental tap is genuinely hard to recover from); routine text edits don't need it since nothing is hidden or buffered anymore — what's on screen is what's saved (or about to be), so fixing a typo is just retyping it.
- **Keep as-is:** the Firestore transaction mechanism itself (correct, not the source of these bugs), real-time sync, the PIN-gated parental lock concept (still needed — reframe as "unlocked for editing" rather than a heavyweight "mode" if it helps, but the underlying gate stays), expand/collapse for progressive disclosure (notes/day-picker/sub-steps), and everything unrelated to saving (scheduling logic, auto-collapse, layout).

**Explicitly out of scope:** redesigning the visual layout or information architecture of the checklist itself — this is scoped purely to the save mechanism and edit affordances.

**Incremental delivery plan (added 2026-08-26):** rather than one large PR, this is being built as a sequence of small, independently-verifiable steps — each its own branch/PR, each tested live in the browser (throwaway Firestore doc, per the project's standard method) before moving to the next:

1. **Save-status indicator, wired to the *existing* write queue — no debounce/draft changes yet.** `saveStatus` is computed purely from the current `mutate()`/transaction lifecycle (`queueTransaction` in `useSchedule.ts`), so this ships the actual trust-builder UI in complete isolation from the riskier parts of the redesign. **Done 2026-08-26** — verified live: "Saving…" appears the instant a toggle fires, "Saved" shows once the transaction settles, fades to idle after ~2s. A `retrySave()` that re-queues the exact failed transaction (without re-applying the optimistic local update, so a toggle can't get double-applied) is unit-tested but couldn't be verified live — no network-throttling control available in this session's browser tooling to force a real Firestore failure.
   - **Real-device UAT (2026-08-26) surfaced two bugs, both fixed same day:** (a) the header's name/date column had no `min-w-0`/`flex-1`, and the name-edit `<input>` had no width constraint, so their intrinsic content width refused to shrink — combined with the new indicator column, this pushed "Done editing" off the right edge of narrow (mobile) screens, forcing a horizontal scroll. (b) `SaveStatusIndicator` mounted/unmounted its text entirely, so the header's height changed every time status flipped, visibly shifting the Edit button (and everything below it) — reported as the indicator feeling "very prominent." Fixed by reserving a fixed-height slot for the indicator (`min-h-4`, always rendered) so the routine saving/saved cycle never changes header height, while the rare error message is still allowed to wrap onto a second line.
   - **Real-device UAT also surfaced an unresolved gap:** testing in airplane mode produced no error state at all — "Saving…" (or nothing) with no eventual "Couldn't save." Root cause is architectural, not a Step 1 bug: `runTransaction()` requires a live connection to coordinate with the backend, so unlike plain writes (which the app's offline persistence cache can queue and sync later), a transaction has no offline path — it doesn't reject, it just stays pending until connectivity returns. The optimistic local update still flips the checkbox immediately, so nothing *looks* wrong, but the write can sit unconfirmed indefinitely with no signal to the user. This wasn't part of Step 1's scope (which only wires status to the transaction's existing resolve/reject) and needs its own decision: e.g. an `navigator.onLine`-based "Offline — will sync when reconnected" state, layered on top of `saveStatus` rather than folded into it. Not yet scoped or built — see Open decisions.
2. **Prove the debounce pattern on the child's-name field** (`App.tsx`, currently commits on blur) — switch it to per-keystroke calls through a new debounced path in the hook. Small blast radius, easy to validate (type fast, confirm no cursor jump, confirm the write lands after a pause). **Done (2026-08-26)** — added `mutateDebounced(key, fn)` in `useSchedule.ts`: same synchronous optimistic-local-update contract as `mutate()`, but the transaction is delayed `DEBOUNCE_MS` (600ms) after the last call for that key, with each new call for the same key replacing whatever was still pending (only the final value is ever sent). The pending unit of work is counted from the *first* keystroke of a debounce window (not when the timer fires), so `saveStatus` says "saving" through the whole countdown, not just once the network request starts. A pending debounced write is flushed immediately on unmount rather than dropped. Removed the old `nameDraft`/`nameSynced` local-state mirror in `App.tsx` entirely — the input now binds directly to `data.childName` / `s.setChildName`, no `onBlur` needed. Verified live: typed "S", "a", "m" ~200ms apart, indicator stayed "Saving…" through all three keystrokes and the debounce window, flipped to "Saved" once (not three times) after the pause, confirmed the value persisted after a hard reload. Unit tests cover single-write debouncing, an immediate write not being blocked by a concurrent pending debounce, and the unmount-flush. (Caught and fixed a real test-infra bug along the way: `vi.useFakeTimers({ toFake: ['setTimeout'] })` without also faking `clearTimeout` makes `clearTimeout` a no-op against fake timer IDs — silently defeated the debounce's own cancellation in tests. Fixed across all fake-timer tests in `useSchedule.test.ts`.)
3. **Extend debounce to category names** — same pattern, still outside `ItemCard`. **Done (2026-08-26), emoji excluded by choice:** added `updateCategoryName(categoryId, name)` in `useSchedule.ts`, keyed per category (`category:<id>:name`) so editing two categories' names around the same time debounces each independently — verified with a dedicated test. Category emoji intentionally stays on the old immediate `updateCategoryMeta` path (a single quick tap/paste, not sustained typing — no real debounce benefit there). Verified live: same "Saving… through the whole typing + pause window, one Saved" behavior as the name field; confirmed persistence after a hard reload.
4. **The big one: apply debounced autosave to `ItemCard`'s text fields and delete the draft machinery** (including the per-item Done button — this is also where the user feedback below about Done showing unconditionally gets resolved, by removing it entirely). Validate by re-running the three historical bug scenarios this step is designed to eliminate (cursor-jump, unmount-mid-edit loss, flash-revert), and update Tier 3's `ItemCard` tests' trigger step (already flagged above).
5. **Undo-for-deletes** — fully independent, smallest and most isolated, natural last step regardless of order.

**Sequencing note (revised 2026-08-25):** the automated test suite (all 3 tiers) is done, ahead of this redesign as planned — see [Automated testing scope](#automated-testing-scope). Tier 1 (pure functions) and Tier 2 (the `useSchedule` hook's public methods) are fully unaffected by this redesign, since the hook's public API doesn't change shape, only its internal debounce timing for text fields — real regression coverage for the redesign. Tier 3's `CategorySection` tests are similarly unaffected. Tier 3's `ItemCard` tests, however, do drive the current "click Done to commit" interaction directly (there's no other way to trigger a commit in today's UI) — those will need their trigger step updated once the per-item Done button is removed, though what they assert (the toggle switches correctly, only the changed field is patched) stays conceptually valid.

## Next steps

1. **Editing UX redesign, Step 4** — see [full scope + incremental delivery plan](#editing-ux-redesign-ready-to-pick-up-later) below. Steps 1-3 (save-status indicator, debounced name field, debounced category names) are done (2026-08-26); Step 4 — the big one, `ItemCard` fields + removing the draft/Done-button mechanism entirely — is next.
2. **Reordering** — drag (or similar) to reorder individual items within a category, and to reorder categories themselves. Nothing built yet; current order is just array order from when things were added.
3. **Links in item descriptions** — an optional link per item (e.g. a video of a soccer drill) rendered as a clear "▶ Watch" button, so he can quickly see how to do something instead of just reading text. Opens in a new tab; no inline video player planned (too much complexity for the payoff, especially with YouTube embeds).
4. **Scope notifications** — even though the build is deferred, worth thinking through *how* parents would actually be notified (push notification vs. something simpler) before committing to the Cloud Functions approach.
5. **Calendar integration** — just captured 2026-08-25, not yet scoped. Direction still open: export the schedule (or just one-time items) into a calendar app a parent already uses, pull an external calendar (e.g. the soccer team's practice/game schedule) into the app instead, or both; one-way vs. two-way sync. Needs a proper scoping pass before it's built.
6. **(Nice-to-have) custom app icon** — the home-screen icon still uses the generic default favicon from setup, not a designed icon.

## Quick reference

| | |
|---|---|
| Live app (canonical) | https://srgarner17.github.io/focus-scheduler/ |
| Live app (backup) | https://focus-scheduler-sand.vercel.app/ |
| Repo | https://github.com/srgarner17/focus-scheduler |
| Local dev | `./dev.bat` (or `npm run dev` if Node is on your PATH), then open the printed URL |
| LAN dev (for testing on a phone/tablet on the same wifi) | `npm run dev -- --host`, then open `http://<this-PC's-LAN-IP>:5173` |
