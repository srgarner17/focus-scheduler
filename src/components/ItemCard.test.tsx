import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ItemCard } from './ItemCard';
import type { ScheduleItem } from '../types';
import { ALL_DAYS } from '../types';
import { colorStyles } from '../lib/colors';
import { todayKey } from '../lib/date';

function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 'item-1',
    title: 'Pack Soccer Bag',
    emoji: '🎽',
    time: '',
    notes: '',
    subSteps: [],
    done: false,
    days: ALL_DAYS,
    date: '',
    ...overrides,
  };
}

function noop() {}

function renderItem(item: ScheduleItem, overrides: Partial<Record<string, unknown>> = {}) {
  const updateItemMeta = vi.fn();
  const updateItemTitle = vi.fn();
  const updateItemNotes = vi.fn();
  const updateItemTime = vi.fn();
  const updateSubStepText = vi.fn();
  const utils = render(
    <ItemCard
      categoryId="cat-1"
      item={item}
      color={colorStyles.blue}
      editMode
      toggleItem={noop}
      toggleSubStep={noop}
      updateItemMeta={updateItemMeta}
      updateItemTitle={updateItemTitle}
      updateItemNotes={updateItemNotes}
      updateItemTime={updateItemTime}
      deleteItem={noop}
      addSubStep={noop}
      updateSubStepText={updateSubStepText}
      deleteSubStep={noop}
      {...overrides}
    />,
  );
  // The Repeats-weekly/One-time toggle and notes field only show once
  // expanded.
  fireEvent.click(screen.getByRole('button', { name: /expand details/i }));
  return { ...utils, updateItemMeta, updateItemTitle, updateItemNotes, updateItemTime, updateSubStepText };
}

describe('ItemCard recurring/one-time toggle', () => {
  it('calls updateItemMeta immediately when switching to one-time — no Done button involved', () => {
    const { updateItemMeta } = renderItem(makeItem());

    fireEvent.click(screen.getByRole('button', { name: 'One-time' }));

    expect(updateItemMeta).toHaveBeenCalledTimes(1);
    expect(updateItemMeta).toHaveBeenCalledWith('cat-1', 'item-1', { date: todayKey() });
    // There's no Done button any more — autosave has nothing to "finish."
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('calls updateItemMeta immediately when switching a one-time item back to recurring', () => {
    const { updateItemMeta } = renderItem(makeItem({ date: '2026-09-01', days: [] }));

    fireEvent.click(screen.getByRole('button', { name: 'Repeats weekly' }));

    expect(updateItemMeta).toHaveBeenCalledTimes(1);
    expect(updateItemMeta).toHaveBeenCalledWith('cat-1', 'item-1', { date: '' });
  });

  it('renders the date input and one-time label for an item with a date', () => {
    const { container } = renderItem(makeItem({ date: '2026-09-01', days: [] }));

    expect(screen.getByRole('button', { name: 'One-time' })).toHaveClass('bg-sky-500');
    expect(screen.getByText(/one-time ·/)).toBeInTheDocument();
    expect(container.querySelector('input[type="date"]')).not.toBeNull();
  });

  it('renders the day picker, not a date input, for a recurring item', () => {
    const { container } = renderItem(makeItem());

    expect(screen.getByRole('button', { name: 'Repeats weekly' })).toHaveClass('bg-sky-500');
    expect(screen.queryByText(/one-time ·/)).not.toBeInTheDocument();
    expect(container.querySelector('input[type="date"]')).toBeNull();
  });
});

describe('ItemCard text fields autosave directly, no draft', () => {
  it('calls updateItemTitle on every keystroke, immediately', () => {
    const { updateItemTitle } = renderItem(makeItem());

    fireEvent.change(screen.getByPlaceholderText('Item title'), { target: { value: 'New Title' } });

    expect(updateItemTitle).toHaveBeenCalledWith('cat-1', 'item-1', 'New Title');
  });

  it('calls updateItemNotes on every keystroke, immediately', () => {
    const { updateItemNotes } = renderItem(makeItem());

    fireEvent.change(screen.getByPlaceholderText(/tip or instructions/i), { target: { value: 'Be careful' } });

    expect(updateItemNotes).toHaveBeenCalledWith('cat-1', 'item-1', 'Be careful');
  });

  it('calls updateSubStepText on every keystroke, immediately, for the right sub-step', () => {
    const item = makeItem({
      subSteps: [
        { id: 's1', text: 'Cleats', done: false },
        { id: 's2', text: 'Shin guards', done: false },
      ],
    });
    const { updateSubStepText } = renderItem(item);

    const secondStepInput = screen.getByDisplayValue('Shin guards');
    fireEvent.change(secondStepInput, { target: { value: 'Shin guards (both)' } });

    expect(updateSubStepText).toHaveBeenCalledWith('cat-1', 'item-1', 's2', 'Shin guards (both)');
    expect(updateSubStepText).not.toHaveBeenCalledWith('cat-1', 'item-1', 's1', expect.anything());
  });
});
