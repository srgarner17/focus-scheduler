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

  function updateItemMeta(
    categoryId: string,
    itemId: string,
    patch: Partial<Pick<ScheduleItem, 'title' | 'emoji' | 'time' | 'notes' | 'days' | 'date'>>,
  ) {
    updateItem(categoryId, itemId, (it) => ({ ...it, ...patch }));
  }

  function deleteItem(categoryId: string, itemId: string) {
    updateCategory(categoryId, (c) => ({ ...c, items: c.items.filter((it) => it.id !== itemId) }));
  }

  function addSubStep(categoryId: string, itemId: string, text: string) {
    updateItem(categoryId, itemId, (it) => ({
      ...it,
      subSteps: [...it.subSteps, { id: makeId(), text, done: false }],
    }));
  }

  function updateSubStepText(categoryId: string, itemId: string, subStepId: string, text: string) {
    updateItem(categoryId, itemId, (it) => ({
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
    addItem,
    updateItemMeta,
    deleteItem,
    addSubStep,
    updateSubStepText,
    deleteSubStep,
  };
}
