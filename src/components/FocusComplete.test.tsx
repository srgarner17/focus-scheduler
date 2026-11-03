import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FocusComplete } from './FocusView';

describe('FocusComplete', () => {
  it('celebrates when nothing is waiting on a parent', () => {
    render(<FocusComplete onExit={vi.fn()} />);
    expect(screen.getByText('🎉 Everything done — great focus today!')).toBeInTheDocument();
  });

  it('holds the celebration while items still wait for a parent', () => {
    render(<FocusComplete onExit={vi.fn()} waitingCount={2} />);
    expect(screen.getByText(/waiting for a parent to check 2/i)).toBeInTheDocument();
    expect(screen.queryByText(/great focus today/i)).not.toBeInTheDocument();
  });
});
