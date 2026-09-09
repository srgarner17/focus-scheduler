import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FocusOrderEditor } from './FocusOrderEditor';
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

function makeCategory(id: string, name: string, itemIds: [string, string][]): Category {
  return {
    id,
    name,
    emoji: '📁',
    color: 'blue',
    items: itemIds.map(([itemId, title]) => makeItem(itemId, title)),
  };
}

function makeData(overrides: Partial<ScheduleData> = {}): ScheduleData {
  return {
    childName: '',
    lastResetDate: '',
    editPin: '',
    focusOrder: [],
    categories: [
      makeCategory('cat-a', 'Morning Routine', [['a1', 'Make Bed']]),
      makeCategory('cat-b', 'Soccer Prep', [['b1', 'Pack Bag']]),
    ],
    ...overrides,
  };
}

describe('FocusOrderEditor', () => {
  it('lists every item in the effective focus sequence, with its category', () => {
    render(<FocusOrderEditor data={makeData()} reorderFocusOrder={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Make Bed')).toBeInTheDocument();
    expect(screen.getByText('Pack Bag')).toBeInTheDocument();
    expect(screen.getByText(/Morning Routine/)).toBeInTheDocument();
    expect(screen.getByText(/Soccer Prep/)).toBeInTheDocument();
  });

  it('reflects an existing focusOrder rather than plain category order', () => {
    render(
      <FocusOrderEditor
        data={makeData({ focusOrder: ['b1', 'a1'] })}
        reorderFocusOrder={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const rows = screen.getAllByText(/Make Bed|Pack Bag/);
    expect(rows.map((r) => r.textContent)).toEqual(['Pack Bag', 'Make Bed']);
  });

  it('calls onClose when Done is tapped', () => {
    const onClose = vi.fn();
    render(<FocusOrderEditor data={makeData()} reorderFocusOrder={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
