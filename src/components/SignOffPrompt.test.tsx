import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SignOffPrompt } from './SignOffPrompt';

function setup(expectedPin: string) {
  const onApprove = vi.fn();
  const onSendBack = vi.fn();
  const onCancel = vi.fn();
  render(
    <SignOffPrompt
      itemTitle="Clean Your Room"
      expectedPin={expectedPin}
      onApprove={onApprove}
      onSendBack={onSendBack}
      onCancel={onCancel}
    />,
  );
  return { onApprove, onSendBack, onCancel };
}

describe('SignOffPrompt', () => {
  it('names the item being checked', () => {
    setup('');
    expect(screen.getByText('Clean Your Room')).toBeInTheDocument();
  });

  it('needs no PIN when none is set (or the parent is already in edit mode)', () => {
    const { onApprove, onSendBack } = setup('');
    expect(screen.queryByLabelText('Parent PIN')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onApprove).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Not done yet' }));
    expect(onSendBack).toHaveBeenCalledTimes(1);
  });

  it('refuses to approve or send back with a wrong PIN, and says so', () => {
    const { onApprove, onSendBack } = setup('1234');
    fireEvent.change(screen.getByLabelText('Parent PIN'), { target: { value: '9999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(onApprove).not.toHaveBeenCalled();
    expect(screen.getByText('Wrong PIN, try again.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Parent PIN'), { target: { value: '9999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Not done yet' }));
    expect(onSendBack).not.toHaveBeenCalled();
  });

  it('approves or sends back with the right PIN', () => {
    const { onApprove, onSendBack } = setup('1234');
    fireEvent.change(screen.getByLabelText('Parent PIN'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onApprove).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Parent PIN'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Not done yet' }));
    expect(onSendBack).toHaveBeenCalledTimes(1);
  });

  it('cancels without doing anything', () => {
    const { onApprove, onSendBack, onCancel } = setup('1234');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onApprove).not.toHaveBeenCalled();
    expect(onSendBack).not.toHaveBeenCalled();
  });
});
