import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FocusOrderEditor } from './FocusOrderEditor';
import type { Category, ScheduleData } from '../types';
import { ALL_DAYS } from '../types';
import { todayDayIndex } from '../lib/date';

function makeItem(id: string, title: string, days: number[] = ALL_DAYS) {
  return {
    id,
    title,
    emoji: '✅',
    notes: '',
    subSteps: [],
    done: false,
    skipped: false,
    days,
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

  it('only lists items scheduled today, not ones that only run on other weekdays', () => {
    const otherDay = (todayDayIndex() + 1) % 7;
    const data = makeData({
      categories: [
        {
          id: 'cat-a',
          name: 'Morning Routine',
          emoji: '📁',
          color: 'blue',
          items: [makeItem('a1', 'Make Bed'), makeItem('a2', 'Other Day Only', [otherDay])],
        },
      ],
    });
    render(<FocusOrderEditor data={data} reorderFocusOrder={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Make Bed')).toBeInTheDocument();
    expect(screen.queryByText('Other Day Only')).not.toBeInTheDocument();
  });

  it("shows 'Nothing scheduled today' when the schedule has items but none run today", () => {
    const otherDay = (todayDayIndex() + 1) % 7;
    const data = makeData({
      categories: [
        {
          id: 'cat-a',
          name: 'Morning Routine',
          emoji: '📁',
          color: 'blue',
          items: [makeItem('a1', 'Other Day Only', [otherDay])],
        },
      ],
    });
    render(<FocusOrderEditor data={data} reorderFocusOrder={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Nothing scheduled today.')).toBeInTheDocument();
  });
});
