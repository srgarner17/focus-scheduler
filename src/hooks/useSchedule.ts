import { useEffect, useRef, useState } from 'react';
import { onSnapshot, runTransaction } from 'firebase/firestore';
import type { Category, CategoryColor, ScheduleData, ScheduleItem } from '../types';
import { ALL_DAYS } from '../types';
import { normalize, resetCompletion, scheduleDocRef } from '../lib/storage';
import { buildDefaultSchedule } from '../data/defaultSchedule';
import { db, ensureSignedIn } from '../lib/firebase';
import { todayKey } from '../lib/date';
import { makeId } from '../lib/id';

// Reads the current server document inside a transaction, applies fn to
// THAT (never to a possibly-stale local snapshot), and writes the result
// back atomically. This is the only way any write happens in this hook —
// a device with an out-of-date local copy (dropped connection, backgrounded
// for hours, stale timer check) can never blindly overwrite another
// device's more recent edits, because every write starts from a fresh read.
async function transactionalUpdate(fn: (d: ScheduleData) => ScheduleData): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(scheduleDocRef);
    const serverData = snap.exists() ? normalize(snap.data() as ScheduleData) : buildDefaultSchedule();
    transaction.set(scheduleDocRef, fn(serverData));
  });
}

async function resetIfStale(): Promise<void> {
  await transactionalUpdate((d) => (d.lastResetDate !== todayKey() ? resetCompletion(d) : d));
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const SAVED_FADE_MS = 2000;
const DEBOUNCE_MS = 600;

export function useSchedule() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const dataRef = useRef<ScheduleData | null>(null);
  dataRef.current = data;

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  // Counts writes queued but not yet settled, so "saved" only fires once
  // every in-flight write has resolved, not after the first of several.
  const pendingCountRef = useRef(0);
  const savedFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The mutation fn from the most recent failed write, so "tap to retry" can
  // re-queue the exact same transaction rather than needing the caller to
  // remember and resupply it.
  const lastFailedMutationRef = useRef<((d: ScheduleData) => ScheduleData) | null>(null);

  // Pending debounced writes, keyed by field (e.g. "childName") so typing in
  // one field never resets or cancels another field's pending write.
  const debouncedWritesRef = useRef<
    Map<string, { timeoutId: ReturnType<typeof setTimeout>; fn: (d: ScheduleData) => ScheduleData }>
  >(new Map());

  useEffect(() => {
    return () => {
      if (savedFadeTimeoutRef.current) clearTimeout(savedFadeTimeoutRef.current);
      // Flush anything still pending rather than dropping it silently — this
      // only helps for an in-app unmount (e.g. React StrictMode, a route
      // change), not an actual tab close, since JS stops running immediately
      // then regardless of what a cleanup function tries to do. Uses
      // runTransactionTracked (not queueTransaction) since beginPending()
      // already ran when each debounce started.
      debouncedWritesRef.current.forEach(({ timeoutId, fn }) => {
        clearTimeout(timeoutId);
        runTransactionTracked(fn);
      });
      debouncedWritesRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    ensureSignedIn()
      .then(() => resetIfStale())
      .then(() => {
        if (cancelled) return;
        unsubscribe = onSnapshot(scheduleDocRef, (snap) => {
          if (!snap.exists()) return;
          // Skip applying an incoming snapshot while this device has any
          // edit not yet confirmed (a pending debounce, or an in-flight
          // write) — otherwise a stale server snapshot can overwrite text
          // being actively typed, visually "rewinding" it mid-edit. This is
          // exactly the race the old per-item draft used to shield against
          // by keeping typed text out of `data` entirely; removing that
          // draft in the editing UX redesign (Steps 2-4) reopened it here.
          // Once pendingCountRef returns to 0, the next snapshot — which
          // will reflect this device's own now-confirmed writes — applies
          // normally.
          if (pendingCountRef.current > 0) return;
          setData(normalize(snap.data() as ScheduleData));
        });
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  // The initial check above only runs once, on mount — a device left open
  // overnight with nobody touching it needs the same check re-run on a
  // timer and whenever the tab/app becomes visible again, or it can keep
  // showing yesterday's checkmarks well into the next day.
  useEffect(() => {
    const intervalId = setInterval(resetIfStale, 60_000);
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') resetIfStale();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', resetIfStale);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', resetIfStale);
    };
  }, []);

  // Writes are chained strictly in call order. Each transaction reads fresh
  // server data, so it's always safe against staleness from OTHER devices —
  // but without this queue, several transactions fired back-to-back from
  // THIS device (e.g. fast typing) could commit out of order and a later
  // keystroke could lose to an earlier one that happened to finish last.
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Marks one unit of work as pending — a debounce countdown counts just as
  // much as an in-flight transaction, since either way there's an edit that
  // hasn't reached the server yet and a parent shouldn't be told "Saved."
  function beginPending() {
    pendingCountRef.current += 1;
    setSaveStatus('saving');
    if (savedFadeTimeoutRef.current) {
      clearTimeout(savedFadeTimeoutRef.current);
      savedFadeTimeoutRef.current = null;
    }
  }

  // Runs fn's transaction behind whatever this device already has pending,
  // and resolves the ONE unit of pending work that beginPending() counted
  // for it. Callers are responsible for calling beginPending() first.
  function runTransactionTracked(fn: (d: ScheduleData) => ScheduleData) {
    writeQueueRef.current = writeQueueRef.current
      .then(() => transactionalUpdate(fn))
      .then(() => {
        lastFailedMutationRef.current = null;
        pendingCountRef.current -= 1;
        if (pendingCountRef.current === 0) {
          setSaveStatus('saved');
          savedFadeTimeoutRef.current = setTimeout(() => {
            setSaveStatus((s) => (s === 'saved' ? 'idle' : s));
          }, SAVED_FADE_MS);
        }
      })
      .catch((err) => {
        console.error('Failed to save change:', err);
        lastFailedMutationRef.current = fn;
        pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
        setSaveStatus('error');
      });
  }

  // Queues fn's transaction immediately — used for every non-debounced,
  // user-initiated write. Deliberately NOT used by the background
  // daily-reset check (resetIfStale calls transactionalUpdate directly),
  // since that runs on a timer/focus regardless of whether the user touched
  // anything, and shouldn't flash "Saving…" for something nobody did.
  function queueTransaction(fn: (d: ScheduleData) => ScheduleData) {
    beginPending();
    runTransactionTracked(fn);
  }

  function mutate(fn: (d: ScheduleData) => ScheduleData) {
    const current = dataRef.current;
    if (!current) return;
    // Optimistic local update so controlled inputs (item titles, notes, etc.)
    // reflect keystrokes instantly instead of waiting on the Firestore
    // round-trip — without this, the input's value only changes once the
    // write resolves, which resets the cursor to the end on every keystroke.
    setData(fn(current));
    // The actual persisted write reads fresh server data and applies fn to
    // that, so it can't clobber another device's concurrent edit.
    queueTransaction(fn);
  }

  // Re-queues the last failed write's exact transaction against fresh server
  // data. Deliberately does NOT touch local state (unlike mutate()) — the
  // optimistic update from the original attempt is already showing on
  // screen, so replaying it again here would double-apply anything
  // non-idempotent, like a toggle.
  function retrySave() {
    const fn = lastFailedMutationRef.current;
    if (fn) queueTransaction(fn);
  }

  // Same optimistic-local-update contract as mutate(), but the Firestore
  // write itself is delayed until `key` has been quiet for DEBOUNCE_MS —
  // for text fields, where writing on every keystroke would mean the queue
  // (and saveStatus) never settles while someone's still typing. Each new
  // call for the same key replaces whatever was still pending for it; since
  // fn is applied to FRESH server data at commit time, only the latest
  // value actually needs to be sent, not every intermediate keystroke.
  //
  // The pending unit of work is counted from the FIRST keystroke of a given
  // debounce window, not from when the timer finally fires — someone
  // mid-typing has unsaved changes right now, and saveStatus should say
  // "saving" through the whole countdown, not just once the network request
  // starts after they've already paused.
  function mutateDebounced(key: string, fn: (d: ScheduleData) => ScheduleData) {
    const current = dataRef.current;
    if (!current) return;
    setData(fn(current));

    const existing = debouncedWritesRef.current.get(key);
    if (existing) {
      clearTimeout(existing.timeoutId);
    } else {
      beginPending();
    }

    const timeoutId = setTimeout(() => {
      debouncedWritesRef.current.delete(key);
      runTransactionTracked(fn);
    }, DEBOUNCE_MS);
    debouncedWritesRef.current.set(key, { timeoutId, fn });
  }

  function updateCategory(categoryId: string, fn: (cat: Category) => Category) {
    mutate((d) => ({
      ...d,
      categories: d.categories.map((c) => (c.id === categoryId ? fn(c) : c)),
    }));
  }

  function updateItem(categoryId: string, itemId: string, fn: (item: ScheduleItem) => ScheduleItem) {
    updateCategory(categoryId, (cat) => ({
      ...cat,
      items: cat.items.map((it) => (it.id === itemId ? fn(it) : it)),
    }));
  }

  // Debounced counterpart to updateItem, for text fields — same idea as
  // updateCategoryName. Keyed per item so, e.g., editing an item's title and
  // its notes at the same time debounces each independently.
  function updateItemDebounced(
    key: string,
    categoryId: string,
    itemId: string,
    fn: (item: ScheduleItem) => ScheduleItem,
  ) {
    mutateDebounced(key, (d) => ({
      ...d,
      categories: d.categories.map((c) =>
        c.id === categoryId ? { ...c, items: c.items.map((it) => (it.id === itemId ? fn(it) : it)) } : c,
      ),
    }));
  }

  function toggleItem(categoryId: string, itemId: string) {
    updateItem(categoryId, itemId, (it) => {
      if (it.subSteps.length > 0) {
        const allDone = it.subSteps.every((s) => s.done);
        return { ...it, subSteps: it.subSteps.map((s) => ({ ...s, done: !allDone })) };
      }
      return { ...it, done: !it.done };
    });
  }

  function toggleSubStep(categoryId: string, itemId: string, subStepId: string) {
    updateItem(categoryId, itemId, (it) => ({
      ...it,
      subSteps: it.subSteps.map((s) => (s.id === subStepId ? { ...s, done: !s.done } : s)),
    }));
  }

  function resetAll() {
    mutate((d) => resetCompletion(d));
  }

  function setChildName(name: string) {
    mutateDebounced('childName', (d) => ({ ...d, childName: name }));
  }

  function setEditPin(pin: string) {
    mutate((d) => ({ ...d, editPin: pin }));
  }

  function addCategory(name: string, emoji: string, color: CategoryColor) {
    const cat: Category = { id: makeId(), name, emoji, color, items: [] };
    mutate((d) => ({ ...d, categories: [...d.categories, cat] }));
    return cat.id;
  }

  function updateCategoryMeta(categoryId: string, patch: Partial<Pick<Category, 'name' | 'emoji' | 'color'>>) {
    updateCategory(categoryId, (c) => ({ ...c, ...patch }));
  }

  // Debounced like setChildName — typing a category name shouldn't queue a
  // transaction on every keystroke. Keyed per category so editing two
  // categories' names around the same time debounces each independently.
  function updateCategoryName(categoryId: string, name: string) {
    mutateDebounced(`category:${categoryId}:name`, (d) => ({
      ...d,
      categories: d.categories.map((c) => (c.id === categoryId ? { ...c, name } : c)),
    }));
  }

  function deleteCategory(categoryId: string) {
    mutate((d) => ({ ...d, categories: d.categories.filter((c) => c.id !== categoryId) }));
  }

  // Re-inserts a previously-deleted category at (approximately) its original
  // position, for the delete-category undo toast. `atIndex` is clamped by
  // splice() itself if the array has since gotten shorter (e.g. another
  // device deleted something in between) — it just lands at the end rather
  // than throwing.
  function restoreCategory(category: Category, atIndex: number) {
    mutate((d) => {
      const categories = [...d.categories];
      categories.splice(atIndex, 0, category);
      return { ...d, categories };
    });
  }

  function addItem(categoryId: string) {
    const newItem: ScheduleItem = {
      id: makeId(),
      title: 'New Item',
      emoji: '✅',
      time: '',
      notes: '',
      subSteps: [],
      done: false,
      days: ALL_DAYS,
      date: '',
    };
    updateCategory(categoryId, (c) => ({ ...c, items: [...c.items, newItem] }));
    return newItem.id;
  }

  // Discrete, one-shot fields (emoji tap/paste, the day picker, the
  // one-time/recurring switch) — immediate, same as before. Title/notes/time
  // are sustained typing and go through the debounced setters below instead.
  function updateItemMeta(categoryId: string, itemId: string, patch: Partial<Pick<ScheduleItem, 'emoji' | 'days' | 'date'>>) {
    updateItem(categoryId, itemId, (it) => ({ ...it, ...patch }));
  }

  function updateItemTitle(categoryId: string, itemId: string, title: string) {
    updateItemDebounced(`item:${itemId}:title`, categoryId, itemId, (it) => ({ ...it, title }));
  }

  function updateItemNotes(categoryId: string, itemId: string, notes: string) {
    updateItemDebounced(`item:${itemId}:notes`, categoryId, itemId, (it) => ({ ...it, notes }));
  }

  function updateItemTime(categoryId: string, itemId: string, time: string) {
    updateItemDebounced(`item:${itemId}:time`, categoryId, itemId, (it) => ({ ...it, time }));
  }

  function deleteItem(categoryId: string, itemId: string) {
    updateCategory(categoryId, (c) => ({ ...c, items: c.items.filter((it) => it.id !== itemId) }));
  }

  // Re-inserts a previously-deleted item at (approximately) its original
  // position within its category, for the delete-item undo toast. If the
  // category itself no longer exists (also deleted in the meantime), this
  // is a silent no-op — same as updateCategory's existing behavior for an
  // unknown categoryId.
  function restoreItem(categoryId: string, item: ScheduleItem, atIndex: number) {
    updateCategory(categoryId, (c) => {
      const items = [...c.items];
      items.splice(atIndex, 0, item);
      return { ...c, items };
    });
  }

  // Swaps two items within a category by id, wherever they currently sit in
  // the underlying array. Takes explicit ids rather than a direction (unlike
  // reorderSubStep below) because edit mode hides expired one-time items —
  // the caller passes whichever item is visually adjacent in what it's
  // actually showing, which may not be adjacent in the raw array. A no-op
  // if either id can't be found (e.g. it was deleted in the meantime).
  function reorderItem(categoryId: string, itemIdA: string, itemIdB: string) {
    updateCategory(categoryId, (c) => {
      const items = [...c.items];
      const indexA = items.findIndex((it) => it.id === itemIdA);
      const indexB = items.findIndex((it) => it.id === itemIdB);
      if (indexA === -1 || indexB === -1) return c;
      [items[indexA], items[indexB]] = [items[indexB], items[indexA]];
      return { ...c, items };
    });
  }

  function addSubStep(categoryId: string, itemId: string, text: string) {
    updateItem(categoryId, itemId, (it) => ({
      ...it,
      subSteps: [...it.subSteps, { id: makeId(), text, done: false }],
    }));
  }

  // Debounced, keyed per sub-step, so editing two sub-steps on the same item
  // debounces independently.
  function updateSubStepText(categoryId: string, itemId: string, subStepId: string, text: string) {
    updateItemDebounced(`item:${itemId}:substep:${subStepId}`, categoryId, itemId, (it) => ({
      ...it,
      subSteps: it.subSteps.map((s) => (s.id === subStepId ? { ...s, text } : s)),
    }));
  }

  function deleteSubStep(categoryId: string, itemId: string, subStepId: string) {
    updateItem(categoryId, itemId, (it) => ({
      ...it,
      subSteps: it.subSteps.filter((s) => s.id !== subStepId),
    }));
  }

  // Swaps a sub-step with its neighbor in the given direction. A no-op at
  // either end of the list (nothing to swap with) rather than wrapping
  // around or erroring.
  function reorderSubStep(categoryId: string, itemId: string, subStepId: string, direction: 'up' | 'down') {
    updateItem(categoryId, itemId, (it) => {
      const index = it.subSteps.findIndex((s) => s.id === subStepId);
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (index === -1 || targetIndex < 0 || targetIndex >= it.subSteps.length) return it;
      const subSteps = [...it.subSteps];
      [subSteps[index], subSteps[targetIndex]] = [subSteps[targetIndex], subSteps[index]];
      return { ...it, subSteps };
    });
  }

  return {
    data,
    saveStatus,
    retrySave,
    toggleItem,
    toggleSubStep,
    resetAll,
    setChildName,
    setEditPin,
    addCategory,
    updateCategoryMeta,
    updateCategoryName,
    deleteCategory,
    restoreCategory,
    addItem,
    updateItemMeta,
    updateItemTitle,
    updateItemNotes,
    updateItemTime,
    deleteItem,
    restoreItem,
    reorderItem,
    addSubStep,
    updateSubStepText,
    deleteSubStep,
    reorderSubStep,
  };
}
