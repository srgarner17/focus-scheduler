import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ScheduleData } from './types';
import App from './App';

// Same Firestore-mocking approach as useSchedule.test.ts — a small
// in-memory "server document" so this exercises the real App + hook wiring
// for the undo-for-deletes flow without a real network or persistence layer.
const { onSnapshotMock, runTransactionMock, setServerDoc } = vi.hoisted(() => {
  let serverDoc: ScheduleData | undefined;

  function currentSnap() {
    return { exists: () => serverDoc !== undefined, data: () => serverDoc };
  }

  const runTransactionMock = vi.fn(async (_db: unknown, updateFn: (t: unknown) => unknown) => {
    const transaction = {
      get: vi.fn(async () => currentSnap()),
      set: vi.fn((_ref: unknown, data: ScheduleData) => {
        serverDoc = data;
      }),
    };
    await updateFn(transaction);
  });

  // These tests only need the initial snapshot (delivered synchronously
  // below) to get data flowing — no test here simulates a live update
  // arriving mid-test, so the callback itself doesn't need to be retained.
  const onSnapshotMock = vi.fn((_ref: unknown, cb: (snap: ReturnType<typeof currentSnap>) => void) => {
    cb(currentSnap());
    return () => {};
  });

  return {
    onSnapshotMock,
    runTransactionMock,
    setServerDoc: (d: ScheduleData | undefined) => {
      serverDoc = d;
    },
  };
});

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  onSnapshot: onSnapshotMock,
  runTransaction: runTransactionMock,
}));

vi.mock('./lib/firebase', () => ({
  db: {},
  ensureSignedIn: vi.fn(() => Promise.resolve()),
}));

beforeEach(() => {
  setServerDoc(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

async function mountApp() {
  const utils = render(<App />);
  await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
  return utils;
}

describe('App undo-for-deletes', () => {
  it('shows an Undo toast after deleting a category, and Undo restores it', async () => {
    await mountApp();
    fireEvent.click(screen.getByRole('button', { name: '⚙️ Edit' }));
    expect(screen.getByDisplayValue('Morning Routine')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete category' })[0]);

    expect(screen.queryByDisplayValue('Morning Routine')).not.toBeInTheDocument();
    expect(screen.getByText('Category deleted')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(screen.getByDisplayValue('Morning Routine')).toBeInTheDocument();
    expect(screen.queryByText('Category deleted')).not.toBeInTheDocument();
  });

  it('shows an Undo toast after deleting an item, and Undo restores it', async () => {
    await mountApp();
    fireEvent.click(screen.getByRole('button', { name: '⚙️ Edit' }));
    expect(screen.getByDisplayValue('Make Your Bed')).toBeInTheDocument();

    // "Delete this item" only shows once the item is expanded.
    fireEvent.click(screen.getAllByRole('button', { name: /expand details/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete this item' }));

    expect(screen.queryByDisplayValue('Make Your Bed')).not.toBeInTheDocument();
    expect(screen.getByText('Item deleted')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(screen.getByDisplayValue('Make Your Bed')).toBeInTheDocument();
    expect(screen.queryByText('Item deleted')).not.toBeInTheDocument();
  });

  it('auto-dismisses the undo toast after the timeout, leaving the deletion in place', async () => {
    await mountApp();
    fireEvent.click(screen.getByRole('button', { name: '⚙️ Edit' }));

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      fireEvent.click(screen.getAllByRole('button', { name: 'Delete category' })[0]);
      expect(screen.getByText('Category deleted')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(6100);
      });

      expect(screen.queryByText('Category deleted')).not.toBeInTheDocument();
      // The toast expiring doesn't undo anything on its own.
      expect(screen.queryByDisplayValue('Morning Routine')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('deleting a second time replaces the pending undo rather than stacking toasts', async () => {
    await mountApp();
    fireEvent.click(screen.getByRole('button', { name: '⚙️ Edit' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete category' })[0]); // Morning Routine
    expect(screen.getAllByText('Category deleted')).toHaveLength(1);

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete category' })[0]); // now Chores
    expect(screen.getAllByText('Category deleted')).toHaveLength(1);

    // Undo only reaches the most recent deletion.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByDisplayValue('Chores')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Morning Routine')).not.toBeInTheDocument();
  });
});
