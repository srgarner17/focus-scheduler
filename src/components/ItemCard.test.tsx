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

function renderItem(item: ScheduleItem) {
  const updateItemMeta = vi.fn();
  const utils = render(
    <ItemCard
      categoryId="cat-1"
      item={item}
      color={colorStyles.blue}
      editMode
      toggleItem={noop}
      toggleSubStep={noop}
      updateItemMeta={updateItemMeta}
      deleteItem={noop}
      addSubStep={noop}
      updateSubStepText={noop}
      deleteSubStep={noop}
    />,
  );
  // The Repeats-weekly/One-time toggle only shows once the item is expanded.
  fireEvent.click(screen.getByRole('button', { name: /expand details/i }));
  return { ...utils, updateItemMeta };
}

describe('ItemCard recurring/one-time toggle', () => {
  it('switches a recurring item to one-time, showing a date input and the one-time label', () => {
    const { container } = renderItem(makeItem());

    expect(screen.getByRole('button', { name: 'Repeats weekly' })).toHaveClass('bg-sky-500');
    fireEvent.click(screen.getByRole('button', { name: 'One-time' }));

    expect(screen.getByRole('button', { name: 'One-time' })).toHaveClass('bg-sky-500');
    expect(screen.getByText(/one-time ·/)).toBeInTheDocument();
    expect(container.querySelector('input[type="date"]')).not.toBeNull();
  });

  it('commits only the changed field (date) when Done is tapped after switching to one-time', () => {
    const { updateItemMeta } = renderItem(makeItem());

    fireEvent.click(screen.getByRole('button', { name: 'One-time' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(updateItemMeta).toHaveBeenCalledTimes(1);
    expect(updateItemMeta).toHaveBeenCalledWith('cat-1', 'item-1', { date: todayKey() });
  });

  it('switches a one-time item back to recurring, clearing the date and restoring the day picker', () => {
    const { updateItemMeta, container } = renderItem(makeItem({ date: '2026-09-01', days: [] }));

    expect(screen.getByRole('button', { name: 'One-time' })).toHaveClass('bg-sky-500');
    fireEvent.click(screen.getByRole('button', { name: 'Repeats weekly' }));

    expect(screen.getByRole('button', { name: 'Repeats weekly' })).toHaveClass('bg-sky-500');
    expect(screen.queryByText(/one-time ·/)).not.toBeInTheDocument();
    expect(container.querySelector('input[type="date"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(updateItemMeta).toHaveBeenCalledWith('cat-1', 'item-1', { date: '' });
  });
});
