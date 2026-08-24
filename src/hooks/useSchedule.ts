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

export function useSchedule() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const dataRef = useRef<ScheduleData | null>(null);
  dataRef.current = data;

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
    writeQueueRef.current = writeQueueRef.current
      .then(() => transactionalUpdate(fn))
      .catch((err) => {
        console.error('Failed to save change:', err);
      });
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
    mutate((d) => ({ ...d, childName: name }));
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
    toggleItem,
    toggleSubStep,
    resetAll,
    setChildName,
    setEditPin,
    addCategory,
    updateCategoryMeta,
    deleteCategory,
    addItem,
    updateItemMeta,
    deleteItem,
    addSubStep,
    updateSubStepText,
    deleteSubStep,
  };
}
