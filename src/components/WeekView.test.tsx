import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Category, HistoryDay } from '../types';
import { ALL_DAYS } from '../types';
import type { HistoryState } from '../hooks/useHistoryDay';

const { useHistoryDayMock } = vi.hoisted(() => ({ useHistoryDayMock: vi.fn() }));
vi.mock('../hooks/useHistoryDay', () => ({ useHistoryDay: useHistoryDayMock }));

const { WeekView } = await import('./WeekView');

const categories: Category[] = [
  {
    id: 'c1',
    name: 'Chores',
    emoji: '🧹',
    color: 'green',
    items: [
      {
        id: 'i1',
        title: 'Live Item',
        emoji: '✅',
        notes: '',
        subSteps: [],
        done: false,
        skipped: false,
        days: ALL_DAYS,
        date: '',
      },
    ],
  },
];

const pastDay: HistoryDay = {
  date: '2026-08-24',
  categories: [
    {
      name: 'Old Chores',
      emoji: '🧹',
      color: 'green',
      items: [
        { title: 'Finished Thing', emoji: '✅', done: true, skipped: false, subSteps: [] },
        { title: 'Missed Thing', emoji: '❌', done: false, skipped: false, subSteps: [] },
      ],
    },
  ],
};

beforeEach(() => {
  // Wednesday 2026-08-26 at noon.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 7, 26, 12, 0));
  useHistoryDayMock.mockReset();
  useHistoryDayMock.mockReturnValue({ status: 'idle' } satisfies HistoryState);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('WeekView history', () => {
  it('asks for no history on today, and keeps showing the live schedule', () => {
    render(<WeekView categories={categories} todayIndex={3} />);
    expect(useHistoryDayMock).toHaveBeenLastCalledWith(null);
    expect(screen.getByText('Live Item')).toBeInTheDocument();
  });

  it('asks for history when a past day in the current week is selected, and renders the snapshot', () => {
    useHistoryDayMock.mockReturnValue({ status: 'ready', day: pastDay } satisfies HistoryState);
    render(<WeekView categories={categories} todayIndex={3} />);

    fireEvent.click(screen.getByRole('button', { name: 'Monday' }));

    expect(useHistoryDayMock).toHaveBeenLastCalledWith('2026-08-24');
    expect(screen.getByText('Finished Thing')).toBeInTheDocument();
    expect(screen.getByText('Missed Thing')).toBeInTheDocument();
    expect(screen.getByText('1/2 done')).toBeInTheDocument();
    // The live schedule's items don't leak into a past day.
    expect(screen.queryByText('Live Item')).not.toBeInTheDocument();
  });

  it('shows a plain "no record" message for a past day with no snapshot', () => {
    useHistoryDayMock.mockReturnValue({ status: 'missing' } satisfies HistoryState);
    render(<WeekView categories={categories} todayIndex={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Monday' }));
    expect(screen.getByText('No record for this day.')).toBeInTheDocument();
  });

  it('reaches earlier weeks with the previous-week button, and returns with "Back to this week"', () => {
    render(<WeekView categories={categories} todayIndex={3} />);
    expect(screen.queryByRole('button', { name: 'Back to this week' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    // Same weekday (Wednesday), one week earlier.
    expect(useHistoryDayMock).toHaveBeenLastCalledWith('2026-08-19');

    fireEvent.click(screen.getByRole('button', { name: 'Back to this week' }));
    expect(useHistoryDayMock).toHaveBeenLastCalledWith(null);
    expect(screen.getByText('Live Item')).toBeInTheDocument();
  });

  it('shows the live preview, not history, for a future week', () => {
    render(<WeekView categories={categories} todayIndex={3} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(useHistoryDayMock).toHaveBeenLastCalledWith(null);
    expect(screen.getByText('Live Item')).toBeInTheDocument();
  });
});
