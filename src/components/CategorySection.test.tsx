import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CategorySection } from './CategorySection';
import type { Category, ScheduleItem } from '../types';
import { ALL_DAYS } from '../types';
import { dateKeyFor } from '../lib/date';

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dateKeyFor(d);
}

function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 'item-1',
    title: 'Test item',
    emoji: '✅',
    time: '',
    notes: '',
    subSteps: [],
    done: false,
    days: ALL_DAYS,
    date: '',
    ...overrides,
  };
}

function makeCategory(items: ScheduleItem[]): Category {
  return {
    id: 'cat-1',
    name: 'Chores',
    emoji: '🧹',
    color: 'blue',
    items,
  };
}

function noop() {}

const noopRevert = { capture: noop, isDirty: () => false, revert: () => undefined };

const baseProps = {
  editMode: false,
  revert: noopRevert,
  toggleItem: noop,
  toggleSubStep: noop,
  updateCategoryMeta: noop,
  updateCategoryName: noop,
  deleteCategory: noop,
  addItem: noop,
  updateItemMeta: noop,
  updateItemTitle: noop,
  updateItemNotes: noop,
  updateItemTime: noop,
  deleteItem: noop,
  reorderItem: noop,
  addSubStep: noop,
  updateSubStepText: noop,
  deleteSubStep: noop,
  reorderSubStep: noop,
};

describe('CategorySection auto-collapse', () => {
  it('collapses automatically once every item is done', () => {
    render(<CategorySection category={makeCategory([makeItem({ done: true })])} {...baseProps} />);
    expect(screen.getByText(/all done/i)).toBeInTheDocument();
    expect(screen.queryByText('Test item')).not.toBeInTheDocument();
  });

  it('stays expanded while there is unfinished work', () => {
    render(<CategorySection category={makeCategory([makeItem({ done: false })])} {...baseProps} />);
    expect(screen.queryByText(/all done/i)).not.toBeInTheDocument();
    expect(screen.getByText('Test item')).toBeInTheDocument();
  });

  it('lets the user reopen a collapsed section, then re-collapses fresh the next time it completes', () => {
    const doneCategory = makeCategory([makeItem({ id: 'a', title: 'Item A', done: true })]);
    const { rerender } = render(<CategorySection category={doneCategory} {...baseProps} />);
    expect(screen.getByText(/all done/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /expand section/i }));
    expect(screen.getByText('Item A')).toBeInTheDocument();

    // New unfinished work arrives (e.g. a second item added) — this should
    // reset the "stay expanded" override even without the user manually
    // collapsing it themselves.
    const freshCategory = makeCategory([
      makeItem({ id: 'a', title: 'Item A', done: true }),
      makeItem({ id: 'b', title: 'Item B', done: false }),
    ]);
    rerender(<CategorySection category={freshCategory} {...baseProps} />);
    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Item B')).toBeInTheDocument();

    // Finishing the new item should collapse the section fresh, not
    // remember the earlier manual expand.
    const doneAgain = makeCategory([
      makeItem({ id: 'a', title: 'Item A', done: true }),
      makeItem({ id: 'b', title: 'Item B', done: true }),
    ]);
    rerender(<CategorySection category={doneAgain} {...baseProps} />);
    expect(screen.getByText(/all done/i)).toBeInTheDocument();
    expect(screen.queryByText('Item A')).not.toBeInTheDocument();
  });

  it('never auto-collapses while in edit mode, even when everything is done', () => {
    render(<CategorySection category={makeCategory([makeItem({ done: true })])} {...baseProps} editMode />);
    expect(screen.queryByText(/all done/i)).not.toBeInTheDocument();
    // In edit mode the title renders as an editable input, not plain text.
    expect(screen.getByDisplayValue('Test item')).toBeInTheDocument();
  });
});

describe('CategorySection edit-mode item list', () => {
  it('shows an item scheduled on a different day, but hides a one-time item whose date has passed', () => {
    const category = makeCategory([
      makeItem({ id: 'a', title: 'Recurring Item', days: [] }), // scheduled on no weekday
      makeItem({ id: 'b', title: 'Past One-Time', date: daysFromToday(-1) }),
      makeItem({ id: 'c', title: 'Future One-Time', date: daysFromToday(1) }),
      makeItem({ id: 'd', title: 'Today One-Time', date: daysFromToday(0) }),
    ]);
    render(<CategorySection category={category} {...baseProps} editMode />);

    // Edit mode normally shows every item regardless of today's schedule...
    expect(screen.getByDisplayValue('Recurring Item')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Future One-Time')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Today One-Time')).toBeInTheDocument();
    // ...except a one-time item whose date has already passed, which has
    // nothing left to edit and would just clutter the list forever.
    expect(screen.queryByDisplayValue('Past One-Time')).not.toBeInTheDocument();
  });
});
