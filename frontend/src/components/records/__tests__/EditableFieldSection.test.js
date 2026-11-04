import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditableFieldSection from '../EditableFieldSection.js';

const showToast = jest.fn();
jest.mock('../../ui/Toast.js', () => ({
  useToast: () => ({ showToast: (...args) => showToast(...args) }),
}));

jest.mock('../../../lib/recordUpdateEvents.js', () => ({
  markRecordListStale: jest.fn(),
}));

const fields = [{ name: 'proposal_type', label: 'Proposal Type' }];

describe('EditableFieldSection edit extras', () => {
  it('shows extras only while editing and calls the start/cancel hooks', () => {
    const onEditStart = jest.fn();
    const onCancel = jest.fn();
    render(
      <EditableFieldSection
        title="Proposal Information"
        fields={fields}
        values={{ proposal_type: 'fixed_cost' }}
        onSave={jest.fn()}
        onEditStart={onEditStart}
        onCancel={onCancel}
        editExtras={<button type="button">+ Add another proposal</button>}
      />,
    );
    expect(screen.queryByText('+ Add another proposal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEditStart).toHaveBeenCalled();
    expect(screen.getByText('+ Add another proposal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(screen.queryByText('+ Add another proposal')).not.toBeInTheDocument();
  });

  it('stays in edit mode when save fails', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('Some proposals were not created'));
    render(
      <EditableFieldSection
        title="Proposal Information"
        fields={fields}
        values={{ proposal_type: 'fixed_cost' }}
        onSave={onSave}
        editExtras={<span>extra block</span>}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(screen.getByText('extra block')).toBeInTheDocument();
  });
});
