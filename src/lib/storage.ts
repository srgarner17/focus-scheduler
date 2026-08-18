import type { ScheduleData } from '../types';
import { buildDefaultSchedule } from '../data/defaultSchedule';
import { todayKey } from './date';

const STORAGE_KEY = 'focus-scheduler-data-v1';

function resetCompletion(data: ScheduleData): ScheduleData {
  return {
    ...data,
    lastResetDate: todayKey(),
    categories: data.categories.map((cat) => ({
      ...cat,
      items: cat.items.map((it) => ({
        ...it,
        done: false,
        subSteps: it.subSteps.map((s) => ({ ...s, done: false })),
      })),
    })),
  };
}

export function loadSchedule(): ScheduleData {
  let data: ScheduleData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    data = raw ? (JSON.parse(raw) as ScheduleData) : buildDefaultSchedule();
  } catch {
    data = buildDefaultSchedule();
  }

  if (data.lastResetDate !== todayKey()) {
    data = resetCompletion(data);
    saveSchedule(data);
  }

  return data;
}

export function saveSchedule(data: ScheduleData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable — fail silently, in-memory state still works this session
  }
}
