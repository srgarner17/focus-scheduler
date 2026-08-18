export interface SubStep {
  id: string;
  text: string;
  done: boolean;
}

export interface ScheduleItem {
  id: string;
  title: string;
  emoji: string;
  time: string; // free-text label, e.g. "7:00 AM" — optional, may be ""
  notes: string; // free-text tip shown to help him get it right
  subSteps: SubStep[];
  done: boolean; // used directly only when subSteps is empty
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
}

export function isItemDone(item: ScheduleItem): boolean {
  if (item.subSteps.length > 0) {
    return item.subSteps.every((s) => s.done);
  }
  return item.done;
}
