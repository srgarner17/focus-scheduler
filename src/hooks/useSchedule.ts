import { useEffect, useState } from 'react';
import type { Category, CategoryColor, ScheduleData, ScheduleItem } from '../types';
import { loadSchedule, saveSchedule } from '../lib/storage';
import { makeId } from '../lib/id';

export function useSchedule() {
  const [data, setData] = useState<ScheduleData>(() => loadSchedule());

  useEffect(() => {
    saveSchedule(data);
  }, [data]);

  function updateCategory(categoryId: string, fn: (cat: Category) => Category) {
    setData((d) => ({
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
    setData((d) => ({
      ...d,
      categories: d.categories.map((c) => ({
        ...c,
        items: c.items.map((it) => ({
          ...it,
          done: false,
          subSteps: it.subSteps.map((s) => ({ ...s, done: false })),
        })),
      })),
    }));
  }

  function setChildName(name: string) {
    setData((d) => ({ ...d, childName: name }));
  }

  function addCategory(name: string, emoji: string, color: CategoryColor) {
    const cat: Category = { id: makeId(), name, emoji, color, items: [] };
    setData((d) => ({ ...d, categories: [...d.categories, cat] }));
    return cat.id;
  }

  function updateCategoryMeta(categoryId: string, patch: Partial<Pick<Category, 'name' | 'emoji' | 'color'>>) {
    updateCategory(categoryId, (c) => ({ ...c, ...patch }));
  }

  function deleteCategory(categoryId: string) {
    setData((d) => ({ ...d, categories: d.categories.filter((c) => c.id !== categoryId) }));
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
    };
    updateCategory(categoryId, (c) => ({ ...c, items: [...c.items, newItem] }));
    return newItem.id;
  }

  function updateItemMeta(
    categoryId: string,
    itemId: string,
    patch: Partial<Pick<ScheduleItem, 'title' | 'emoji' | 'time' | 'notes'>>,
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
