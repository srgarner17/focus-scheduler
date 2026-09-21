import { describe, expect, it } from 'vitest';
import { buildHistorySnapshot, historyProgress } from './history';
import type { Category, ScheduleData, ScheduleItem } from '../types';
import { ALL_DAYS } from '../types';

function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 'i1',
    title: 'Item',
    emoji: '✅',
    notes: '',
    subSteps: [],
    done: false,
    skipped: false,
    days: ALL_DAYS,
    date: '',
    ...overrides,
  };
}

function makeData(categories: Category[]): ScheduleData {
  return { childName: '', categories, lastResetDate: '', editPin: '', focusOrder: [] };
}

function makeCategory(items: ScheduleItem[], overrides: Partial<Category> = {}): Category {
  return { id: 'c1', name: 'Chores', emoji: '🧹', color: 'green', items, ...overrides };
}

// 2026-08-25 is a Tuesday (day index 2).
const TUESDAY = '2026-08-25';

describe('buildHistorySnapshot', () => {
  it('records the date and copies names, emoji and color rather than ids', () => {
    const data = makeData([makeCategory([makeItem({ title: 'Feed the Dog', emoji: '🐕' })])]);
    const day = buildHistorySnapshot(data, TUESDAY);
    expect(day).toEqual({
      date: TUESDAY,
      categories: [
        {
          name: 'Chores',
          emoji: '🧹',
          color: 'green',
          items: [{ title: 'Feed the Dog', emoji: '🐕', done: false, skipped: false, subSteps: [] }],
        },
      ],
    });
  });

  it('only includes items scheduled that weekday, and drops categories left empty', () => {
    const data = makeData([
      makeCategory([makeItem({ id: 'a', title: 'Tuesdays', days: [2] }), makeItem({ id: 'b', title: 'Mondays', days: [1] })]),
      makeCategory([makeItem({ id: 'c', title: 'Mondays only', days: [1] })], { id: 'c2', name: 'Soccer' }),
    ]);
    const day = buildHistorySnapshot(data, TUESDAY);
    expect(day.categories).toHaveLength(1);
    expect(day.categories[0].items.map((i) => i.title)).toEqual(['Tuesdays']);
  });

  it('matches a one-time item by its exact date, ignoring days', () => {
    const data = makeData([
      makeCategory([
        makeItem({ id: 'a', title: 'That day', date: TUESDAY, days: [] }),
        makeItem({ id: 'b', title: 'Another day', date: '2026-08-26', days: ALL_DAYS }),
      ]),
    ]);
    expect(buildHistorySnapshot(data, TUESDAY).categories[0].items.map((i) => i.title)).toEqual(['That day']);
  });

  it('resolves done from sub-steps (all must be done) and keeps each step', () => {
    const data = makeData([
      makeCategory([
        makeItem({
          id: 'a',
          title: 'Complete',
          subSteps: [
            { id: 's1', text: 'one', done: true },
            { id: 's2', text: 'two', done: true },
          ],
        }),
        makeItem({
          id: 'b',
          title: 'Partial',
          subSteps: [
            { id: 's3', text: 'one', done: true },
            { id: 's4', text: 'two', done: false },
          ],
        }),
      ]),
    ]);
    const items = buildHistorySnapshot(data, TUESDAY).categories[0].items;
    expect(items[0].done).toBe(true);
    expect(items[1].done).toBe(false);
    expect(items[1].subSteps).toEqual([
      { text: 'one', done: true },
      { text: 'two', done: false },
    ]);
  });

  it('records a skipped item as skipped', () => {
    const data = makeData([makeCategory([makeItem({ skipped: true })])]);
    expect(buildHistorySnapshot(data, TUESDAY).categories[0].items[0].skipped).toBe(true);
  });
});

describe('historyProgress', () => {
  it('counts done over total, excluding skipped items like the live Today view does', () => {
    const data = makeData([
      makeCategory([
        makeItem({ id: 'a', done: true }),
        makeItem({ id: 'b', done: false }),
        makeItem({ id: 'c', skipped: true }),
      ]),
    ]);
    expect(historyProgress(buildHistorySnapshot(data, TUESDAY))).toEqual({ done: 1, total: 2 });
  });
});
