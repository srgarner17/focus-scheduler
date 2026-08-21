import { useEffect, useRef, useState } from 'react';
import { onSnapshot, setDoc } from 'firebase/firestore';
import type { Category, CategoryColor, ScheduleData, ScheduleItem } from '../types';
import { ALL_DAYS } from '../types';
import { normalize, resetCompletion, scheduleDocRef } from '../lib/storage';
import { buildDefaultSchedule } from '../data/defaultSchedule';
import { ensureSignedIn } from '../lib/firebase';
import { todayKey } from '../lib/date';
import { makeId } from '../lib/id';

export function useSchedule() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const dataRef = useRef<ScheduleData | null>(null);
  dataRef.current = data;

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    ensureSignedIn().then(() => {
      if (cancelled) return;
      unsubscribe = onSnapshot(scheduleDocRef, (snap) => {
        if (!snap.exists()) {
          setDoc(scheduleDocRef, buildDefaultSchedule());
          return;
        }
        let d = normalize(snap.data() as ScheduleData);
        if (d.lastResetDate !== todayKey()) {
          d = resetCompletion(d);
          setDoc(scheduleDocRef, d);
          return;
        }
        setData(d);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  function mutate(fn: (d: ScheduleData) => ScheduleData) {
    const current = dataRef.current;
    if (!current) return;
    const next = fn(current);
    // Update local state immediately so controlled inputs (item titles, notes,
    // etc.) reflect keystrokes instantly instead of waiting on the Firestore
    // round-trip — without this, the input's value only changes once the
    // async write resolves, which resets the cursor to the end on every
    // keystroke. The write below still syncs it to other devices.
    setData(next);
    setDoc(scheduleDocRef, next);
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
    };
    updateCategory(categoryId, (c) => ({ ...c, items: [...c.items, newItem] }));
    return newItem.id;
  }

  function updateItemMeta(
    categoryId: string,
    itemId: string,
    patch: Partial<Pick<ScheduleItem, 'title' | 'emoji' | 'time' | 'notes' | 'days'>>,
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
