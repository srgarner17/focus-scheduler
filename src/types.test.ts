import { describe, expect, it } from 'vitest';
import { isItemDone, isItemScheduledOn, type ScheduleItem } from './types';

function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 'item-1',
    title: 'Test item',
    emoji: '✅',
    time: '',
    notes: '',
    subSteps: [],
    done: false,
    days: [0, 1, 2, 3, 4, 5, 6],
    date: '',
    ...overrides,
  };
}

describe('isItemDone', () => {
  it('uses the item.done flag when there are no sub-steps', () => {
    expect(isItemDone(makeItem({ done: false }))).toBe(false);
    expect(isItemDone(makeItem({ done: true }))).toBe(true);
  });

  it('ignores item.done and requires every sub-step to be done when sub-steps exist', () => {
    const allDone = makeItem({
      done: false,
      subSteps: [
        { id: 's1', text: 'a', done: true },
        { id: 's2', text: 'b', done: true },
      ],
    });
    expect(isItemDone(allDone)).toBe(true);

    const partiallyDone = makeItem({
      done: true,
      subSteps: [
        { id: 's1', text: 'a', done: true },
        { id: 's2', text: 'b', done: false },
      ],
    });
    expect(isItemDone(partiallyDone)).toBe(false);
  });
});

describe('isItemScheduledOn', () => {
  it('matches a recurring item by weekday, ignoring the exact date', () => {
    const item = makeItem({ days: [1, 2, 3], date: '' });
    expect(isItemScheduledOn(item, '2026-08-25', 2)).toBe(true); // Tuesday, in days
    expect(isItemScheduledOn(item, '2026-08-27', 4)).toBe(false); // Thursday, not in days
  });

  it('matches a one-time item only on its exact date, ignoring days entirely', () => {
    const item = makeItem({ days: [], date: '2026-08-25' });
    expect(isItemScheduledOn(item, '2026-08-25', 2)).toBe(true);
    // Even if dayIndex would "match" some weekday, a different date must not.
    expect(isItemScheduledOn(item, '2026-09-01', 2)).toBe(false);
  });

  it('a one-time item takes priority over days even if days would also match', () => {
    const item = makeItem({ days: [0, 1, 2, 3, 4, 5, 6], date: '2026-08-25' });
    expect(isItemScheduledOn(item, '2026-08-26', 3)).toBe(false);
  });

  it('an item scheduled on no days ever matches', () => {
    const item = makeItem({ days: [], date: '' });
    expect(isItemScheduledOn(item, '2026-08-25', 2)).toBe(false);
  });
});
