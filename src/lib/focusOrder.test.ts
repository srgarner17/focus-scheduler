import { describe, expect, it } from 'vitest';
import { buildFocusSequence } from './focusOrder';
import type { Category, ScheduleData } from '../types';
import { ALL_DAYS } from '../types';

function makeItem(id: string, title: string) {
  return {
    id,
    title,
    emoji: '✅',
    notes: '',
    subSteps: [],
    done: false,
    skipped: false,
    days: ALL_DAYS,
    date: '',
  };
}

function makeCategory(id: string, itemIds: string[]): Category {
  return {
    id,
    name: id,
    emoji: '📁',
    color: 'blue',
    items: itemIds.map((itemId) => makeItem(itemId, itemId)),
  };
}

function makeData(categories: Category[], focusOrder: string[] = []): ScheduleData {
  return { childName: '', categories, lastResetDate: '', editPin: '', focusOrder };
}

describe('buildFocusSequence', () => {
  it('falls back to plain category/item order when focusOrder is empty', () => {
    const data = makeData([makeCategory('cat-a', ['a1', 'a2']), makeCategory('cat-b', ['b1'])]);
    expect(buildFocusSequence(data).map((e) => e.item.id)).toEqual(['a1', 'a2', 'b1']);
  });

  it('uses focusOrder first, interleaving across categories', () => {
    const data = makeData(
      [makeCategory('cat-a', ['a1', 'a2']), makeCategory('cat-b', ['b1'])],
      ['b1', 'a2', 'a1'],
    );
    expect(buildFocusSequence(data).map((e) => e.item.id)).toEqual(['b1', 'a2', 'a1']);
  });

  it('appends items missing from focusOrder afterward, in category/item order', () => {
    const data = makeData(
      [makeCategory('cat-a', ['a1', 'a2']), makeCategory('cat-b', ['b1'])],
      ['a2'],
    );
    expect(buildFocusSequence(data).map((e) => e.item.id)).toEqual(['a2', 'a1', 'b1']);
  });

  it('silently drops ids in focusOrder that no longer exist (deleted items)', () => {
    const data = makeData([makeCategory('cat-a', ['a1'])], ['deleted-id', 'a1']);
    expect(buildFocusSequence(data).map((e) => e.item.id)).toEqual(['a1']);
  });

  it('carries the correct category alongside each item', () => {
    const data = makeData([makeCategory('cat-a', ['a1']), makeCategory('cat-b', ['b1'])], ['b1', 'a1']);
    const seq = buildFocusSequence(data);
    expect(seq[0].category.id).toBe('cat-b');
    expect(seq[1].category.id).toBe('cat-a');
  });
});
