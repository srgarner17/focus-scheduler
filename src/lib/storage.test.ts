import { describe, expect, it, vi } from 'vitest';
import type { ScheduleData } from '../types';

// storage.ts imports firebase.ts at module scope, which initializes a real
// Firestore client (IndexedDB persistence, etc.) — not available in jsdom
// and irrelevant to the pure functions under test here, so stub both the
// SDK's `doc` and our own `db` export before importing storage.ts.
vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(() => ({})) }));

const { normalize, resetCompletion } = await import('./storage');

function baseData(overrides: Partial<ScheduleData> = {}): ScheduleData {
  return {
    childName: 'Sam',
    lastResetDate: '2026-08-24',
    editPin: '',
    categories: [],
    focusOrder: [],
    ...overrides,
  };
}

describe('normalize', () => {
  it('fills in a missing editPin with an empty string', () => {
    const data = baseData();
    // @ts-expect-error simulating old data saved before editPin existed
    delete data.editPin;
    expect(normalize(data).editPin).toBe('');
  });

  it('leaves an existing editPin untouched', () => {
    const data = baseData({ editPin: '1234' });
    expect(normalize(data).editPin).toBe('1234');
  });

  it('fills in a missing focusOrder with an empty array', () => {
    const data = baseData();
    // @ts-expect-error simulating old data saved before focusOrder existed
    delete data.focusOrder;
    expect(normalize(data).focusOrder).toEqual([]);
  });

  it('leaves an existing focusOrder untouched', () => {
    const data = baseData({ focusOrder: ['i2', 'i1'] });
    expect(normalize(data).focusOrder).toEqual(['i2', 'i1']);
  });

  it('backfills a missing requiresSignOff and signedOff with false, and keeps existing values', () => {
    const item = (extra: object) => ({
      id: 'i1',
      title: 'Old item',
      emoji: '✅',
      notes: '',
      subSteps: [],
      done: false,
      skipped: false,
      days: [0, 1, 2, 3, 4, 5, 6],
      date: '',
      ...extra,
    });
    const make = (items: object[]) =>
      baseData({ categories: [{ id: 'c1', name: 'Chores', emoji: '🧹', color: 'blue', items: items as never }] });

    const old = normalize(make([item({})])).categories[0].items[0];
    expect(old.requiresSignOff).toBe(false);
    expect(old.signedOff).toBe(false);

    const kept = normalize(make([item({ requiresSignOff: true, signedOff: true })])).categories[0].items[0];
    expect(kept.requiresSignOff).toBe(true);
    expect(kept.signedOff).toBe(true);
  });

  it('backfills missing item.days with every day', () => {
    const data = baseData({
      categories: [
        {
          id: 'c1',
          name: 'Chores',
          emoji: '🧹',
          color: 'blue',
          items: [
            {
              id: 'i1',
              title: 'Old item',
              emoji: '✅',
              notes: '',
              subSteps: [],
              done: false,
              skipped: false,
              requiresSignOff: false,
              signedOff: false,
              // @ts-expect-error simulating pre-migration data with no `days`
              days: undefined,
              date: '',
            },
          ],
        },
      ],
    });
    expect(normalize(data).categories[0].items[0].days).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('backfills a missing item.date with an empty string', () => {
    const data = baseData({
      categories: [
        {
          id: 'c1',
          name: 'Chores',
          emoji: '🧹',
          color: 'blue',
          items: [
            {
              id: 'i1',
              title: 'Old item',
              emoji: '✅',
              notes: '',
              subSteps: [],
              done: false,
              skipped: false,
              requiresSignOff: false,
              signedOff: false,
              days: [1, 2, 3],
              // @ts-expect-error simulating pre-migration data with no `date`
              date: undefined,
            },
          ],
        },
      ],
    });
    expect(normalize(data).categories[0].items[0].date).toBe('');
  });

  it('preserves an existing days array and date rather than overwriting them', () => {
    const data = baseData({
      categories: [
        {
          id: 'c1',
          name: 'Chores',
          emoji: '🧹',
          color: 'blue',
          items: [
            {
              id: 'i1',
              title: 'One-time item',
              emoji: '✅',
              notes: '',
              subSteps: [],
              done: false,
              skipped: false,
              requiresSignOff: false,
              signedOff: false,
              days: [2],
              date: '2026-09-01',
            },
          ],
        },
      ],
    });
    const normalized = normalize(data);
    expect(normalized.categories[0].items[0].days).toEqual([2]);
    expect(normalized.categories[0].items[0].date).toBe('2026-09-01');
  });

  it('backfills a missing item.skipped with false', () => {
    const data = baseData({
      categories: [
        {
          id: 'c1',
          name: 'Chores',
          emoji: '🧹',
          color: 'blue',
          items: [
            {
              id: 'i1',
              title: 'Old item',
              emoji: '✅',
              notes: '',
              subSteps: [],
              done: false,
              days: [0, 1, 2, 3, 4, 5, 6],
              date: '',
              // @ts-expect-error simulating pre-migration data with no `skipped`
              skipped: undefined,
            },
          ],
        },
      ],
    });
    expect(normalize(data).categories[0].items[0].skipped).toBe(false);
  });
});

describe('resetCompletion', () => {
  it('sets lastResetDate to today', () => {
    vi.setSystemTime(new Date(2026, 7, 25, 12, 0));
    const data = baseData({ lastResetDate: '2026-08-01' });
    expect(resetCompletion(data).lastResetDate).toBe('2026-08-25');
    vi.useRealTimers();
  });

  it('marks every item and sub-step as not done', () => {
    const data = baseData({
      categories: [
        {
          id: 'c1',
          name: 'Chores',
          emoji: '🧹',
          color: 'blue',
          items: [
            {
              id: 'i1',
              title: 'Item with sub-steps',
              emoji: '✅',
              notes: '',
              subSteps: [
                { id: 's1', text: 'a', done: true },
                { id: 's2', text: 'b', done: true },
              ],
              done: false,
              skipped: false,
              requiresSignOff: false,
              signedOff: false,
              days: [0, 1, 2, 3, 4, 5, 6],
              date: '',
            },
            {
              id: 'i2',
              title: 'Simple item',
              emoji: '✅',
              notes: '',
              subSteps: [],
              done: true,
              skipped: false,
              requiresSignOff: false,
              signedOff: false,
              days: [0, 1, 2, 3, 4, 5, 6],
              date: '',
            },
            {
              id: 'i3',
              title: 'Skipped item',
              emoji: '✅',
              notes: '',
              subSteps: [],
              done: false,
              skipped: true,
              requiresSignOff: false,
              signedOff: false,
              days: [0, 1, 2, 3, 4, 5, 6],
              date: '',
            },
          ],
        },
      ],
    });
    const reset = resetCompletion(data);
    expect(reset.categories[0].items[0].subSteps.every((s) => !s.done)).toBe(true);
    expect(reset.categories[0].items[1].done).toBe(false);
    expect(reset.categories[0].items[2].skipped).toBe(false);
  });

  it('clears signedOff each night but keeps the standing requiresSignOff setting', () => {
    const data = baseData({
      categories: [
        {
          id: 'c1',
          name: 'Chores',
          emoji: '🧹',
          color: 'blue',
          items: [
            {
              id: 'i1',
              title: 'Needs a check',
              emoji: '✅',
              notes: '',
              subSteps: [],
              done: true,
              skipped: false,
              requiresSignOff: true,
              signedOff: true,
              days: [0, 1, 2, 3, 4, 5, 6],
              date: '',
            },
          ],
        },
      ],
    });
    const item = resetCompletion(data).categories[0].items[0];
    expect(item.signedOff).toBe(false);
    expect(item.requiresSignOff).toBe(true);
  });
});
