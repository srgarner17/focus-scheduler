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

describe("App 'What's next' focus view", () => {
  it('shows the first not-done item in category/item order, and completing it advances to the next one', async () => {
    await mountApp();

    fireEvent.click(screen.getByRole('button', { name: '🎯 Focus' }));
    // Morning Routine's first item, nothing done yet.
    expect(screen.getByText('Make Your Bed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));
    expect(screen.queryByText('Make Your Bed')).not.toBeInTheDocument();
    expect(screen.getByText('Brush Teeth')).toBeInTheDocument();
  });

  it('does not advance while only some of a multi-step item is done', async () => {
    await mountApp();

    fireEvent.click(screen.getByRole('button', { name: '🎯 Focus' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark step done' })[0]);

    // Still the same item — completing one of three sub-steps isn't enough.
    expect(screen.getByText('Make Your Bed')).toBeInTheDocument();
  });

  it('"See full list" swaps back to the category grid', async () => {
    await mountApp();

    fireEvent.click(screen.getByRole('button', { name: '🎯 Focus' }));
    fireEvent.click(screen.getByRole('button', { name: 'See full list' }));

    expect(screen.getByText("Today's progress")).toBeInTheDocument();
    expect(screen.getByText('Chores')).toBeInTheDocument();
  });

  it('entering edit mode drops out of focus mode', async () => {
    await mountApp();

    fireEvent.click(screen.getByRole('button', { name: '🎯 Focus' }));
    expect(screen.getByText('Make Your Bed')).toBeInTheDocument();

    // Default schedule has no PIN set, so Edit engages immediately.
    fireEvent.click(screen.getByRole('button', { name: '⚙️ Edit' }));

    expect(screen.queryByRole('button', { name: '🎯 Focus' })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Make Your Bed')).toBeInTheDocument();
  });

  it('shows a completion screen once every scheduled item is done', async () => {
    await mountApp();

    for (const button of screen.getAllByRole('button', { name: 'Mark done' })) {
      fireEvent.click(button);
    }

    fireEvent.click(screen.getByRole('button', { name: '🎯 Focus' }));
    expect(screen.getByText('🎉 Everything done — great focus today!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'See full list' }));
    expect(screen.getByText("Today's progress")).toBeInTheDocument();
  });
});

describe('App focus-order editor', () => {
  it('opens the "Reorder focus" editor from edit mode, and Done closes it', async () => {
    await mountApp();

    fireEvent.click(screen.getByRole('button', { name: '⚙️ Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reorder focus flow' }));

    expect(screen.getByRole('heading', { name: 'Reorder focus' })).toBeInTheDocument();
    // The full item list appears, flattened across categories.
    expect(screen.getByText('Make Your Bed')).toBeInTheDocument();
    expect(screen.getByText('Feed the Dog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('heading', { name: 'Reorder focus' })).not.toBeInTheDocument();
    // Back to the normal edit-mode grid underneath.
    expect(screen.getByDisplayValue('Make Your Bed')).toBeInTheDocument();
  });
});

describe('App parent sign-off', () => {
  // The default schedule has no PIN, so entering edit mode and approving
  // need nothing extra - the PIN rules themselves are covered in
  // SignOffPrompt's own tests.
  async function requireSignOffOnFirstItem() {
    await mountApp();
    fireEvent.click(screen.getByRole('button', { name: '⚙️ Edit' }));
    fireEvent.click(screen.getAllByRole('button', { name: /expand details/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /needs parent sign-off/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Done editing' }));
  }

  it('checking off an item that needs sign-off leaves it waiting, then a parent approves it', async () => {
    await requireSignOffOnFirstItem();
    expect(screen.queryByText(/waiting for a parent$/)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark done' })[0]);

    // Checked off, but not counted as finished: it shows as waiting.
    expect(screen.getByText('⏳ 1 waiting for a parent')).toBeInTheDocument();
    expect(screen.queryByText('🎉 Everything done — great focus today!')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /tap to review/i }));
    expect(screen.getByText('Check this one')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(screen.queryByText('Check this one')).not.toBeInTheDocument();
    expect(screen.queryByText(/waiting for a parent/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /tap to review/i })).not.toBeInTheDocument();
  });

  it('"Not done yet" sends it back to unchecked', async () => {
    await requireSignOffOnFirstItem();
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark done' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /tap to review/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Not done yet' }));

    expect(screen.queryByText(/waiting for a parent/)).not.toBeInTheDocument();
    // Unchecked again, so the first item offers "Mark done" once more.
    expect(screen.getAllByRole('button', { name: 'Mark done' })[0]).toBeInTheDocument();
  });

  it('un-checking an approved item clears the approval so it waits again when re-checked', async () => {
    await requireSignOffOnFirstItem();
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark done' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /tap to review/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Mark not done' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark done' })[0]);

    expect(screen.getByText('⏳ 1 waiting for a parent')).toBeInTheDocument();
  });

  it('Focus moves past a waiting item instead of blocking on it', async () => {
    await requireSignOffOnFirstItem();
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark done' })[0]);

    fireEvent.click(screen.getByRole('button', { name: '🎯 Focus' }));
    // First item is waiting on a parent, so Focus is already on the next one.
    expect(screen.queryByText('Make Your Bed')).not.toBeInTheDocument();
    expect(screen.getByText('Brush Teeth')).toBeInTheDocument();
  });
});
