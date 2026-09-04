export interface SubStep {
  id: string;
  text: string;
  done: boolean;
}

export interface ScheduleItem {
  id: string;
  title: string;
  emoji: string;
  notes: string; // free-text tip shown to help him get it right
  subSteps: SubStep[];
  done: boolean; // used directly only when subSteps is empty
  days: number[]; // which days this item is active: 0=Sun..6=Sat (matches Date#getDay()) — ignored when `date` is set
  date: string; // YYYY-MM-DD — when set, this is a one-time item active only on that exact date, never repeats
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: CategoryColor;
  items: ScheduleItem[];
}

export type CategoryColor = 'orange' | 'green' | 'blue' | 'purple' | 'pink' | 'teal';

export interface ScheduleData {
  childName: string;
  categories: Category[];
  lastResetDate: string; // YYYY-MM-DD, local date of last daily reset
  editPin: string; // 4-digit PIN required to enter Edit mode; empty = no lock
}

export function isItemDone(item: ScheduleItem): boolean {
  if (item.subSteps.length > 0) {
    return item.subSteps.every((s) => s.done);
  }
  return item.done;
}

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// One-time items (item.date set) are active only on that exact calendar date
// and ignore `days` entirely. Recurring items are matched by weekday.
export function isItemScheduledOn(item: ScheduleItem, dateKey: string, dayIndex: number): boolean {
  if (item.date) return item.date === dateKey;
  return item.days.includes(dayIndex);
}

// A one-time item whose date has already passed has nothing left to show or
// edit — this is used to hide it from the edit-mode item list, which
// otherwise shows every item regardless of today's schedule. Recurring
// items (no date set) are never "past" in this sense. YYYY-MM-DD strings
// compare correctly with plain `<`, so no date parsing is needed.
export function isOneTimeInPast(item: ScheduleItem, todayDateKey: string): boolean {
  return Boolean(item.date) && item.date < todayDateKey;
}

export const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
