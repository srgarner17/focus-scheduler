import { doc } from 'firebase/firestore';
import type { ScheduleData } from '../types';
import { ALL_DAYS } from '../types';
import { db } from './firebase';
import { todayKey } from './date';

// One shared document for the whole household — every device (each parent's
// phone, the kid's iPad) reads and writes the same schedule here.
export const scheduleDocRef = doc(db, 'household', 'schedule');

export function normalize(data: ScheduleData): ScheduleData {
  return {
    ...data,
    editPin: typeof data.editPin === 'string' ? data.editPin : '',
    categories: data.categories.map((cat) => ({
      ...cat,
      items: cat.items.map((it) => ({
        ...it,
        days: Array.isArray(it.days) ? it.days : ALL_DAYS,
        date: typeof it.date === 'string' ? it.date : '',
      })),
    })),
  };
}

export function resetCompletion(data: ScheduleData): ScheduleData {
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
