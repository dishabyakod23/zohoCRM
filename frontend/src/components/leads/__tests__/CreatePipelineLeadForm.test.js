import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import CreatePipelineLeadForm from '../CreatePipelineLeadForm.js';
import * as emailHelpers from '../../../lib/emailHelpers.js';

jest.mock('../../layout/CRMLayout.js', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

jest.mock('../../ui/AppLink.js', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}));

jest.mock('../../ui/Toast.js', () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('../../../hooks/useAuth.js', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: 'sales_rep' } }),
}));

jest.mock('../../../hooks/usePermissions.js', () => ({
  usePermissions: () => ({ canAssignLeads: false }),
}));

jest.mock('../../../lib/services/lookups.js', () => ({
  fetchUsers: jest.fn().mockResolvedValue([]),
  fetchLeadStatuses: jest.fn().mockResolvedValue([]),
  fetchLeadSources: jest.fn().mockResolvedValue([]),
  fetchLostReasons: jest.fn().mockResolvedValue([]),
  FALLBACK_LEAD_STATUSES: [],
}));

jest.mock('../../../lib/emailHelpers.js', () => ({
  validateEmailUnique: jest.fn(),
}));

jest.mock('../../../lib/campaignRecordHelpers.js', () => ({
  tryAttachCampaignAfterCreate: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../lib/recordNavigation.js', () => ({
  navigateToRecord: jest.fn(),
}));

// Child inputs that load their own lookups are not under test here.
jest.mock('../../forms/IndustryField.js', () => ({ __esModule: true, default: () => null }));
jest.mock('../../forms/CampaignSelect.js', () => ({ __esModule: true, default: () => null }));
jest.mock('../../forms/AddressCountryStateFields.js', () => ({
  AddressCountryField: () => null,
  AddressStateField: () => null,
}));
jest.mock('../../forms/CompanySelect.js', () => ({
  __esModule: true,
  default: ({ value, onChange }) => (
    <input aria-label="Company" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const PROPOSAL_PROPS = {
  listPath: '/proposals',
  listLabel: 'Proposals',
  title: 'Create Proposal',
  saveLabel: 'Save Proposal',
  successToast: 'Proposal created',
  showProposalFields: true,
};

function fillAndSave(saveLabel) {
  fireEvent.change(screen.getByPlaceholderText('First Name'), { target: { value: 'Asha' } });
  fireEvent.change(screen.getByPlaceholderText('Last Name'), { target: { value: 'Rao' } });
  fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Zyarex' } });
  fireEvent.change(document.querySelector('[data-field="email"] input'), { target: { value: 'asha@zyarex.com' } });
  fireEvent.click(screen.getByRole('button', { name: saveLabel }));
}

describe('CreatePipelineLeadForm', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    emailHelpers.validateEmailUnique.mockResolvedValue('A lead with this email already exists.');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lets a proposal reuse an email that is already on a lead or contact', async () => {
    const createFn = jest.fn().mockResolvedValue({ id: 'p1' });
    render(<CreatePipelineLeadForm {...PROPOSAL_PROPS} createFn={createFn} />);
    fillAndSave('Save Proposal');
    await act(async () => { jest.advanceTimersByTime(500); });
    await waitFor(() => expect(createFn).toHaveBeenCalled());
    expect(emailHelpers.validateEmailUnique).not.toHaveBeenCalled();
  });

  it('still rejects a duplicate email for other pipeline stages', async () => {
    const createFn = jest.fn().mockResolvedValue({ id: 'l1' });
    render(
      <CreatePipelineLeadForm listPath="/qualified-leads" listLabel="Qualified Leads" title="Create Qualified Lead"
        saveLabel="Save Lead" successToast="Lead created" createFn={createFn} />,
    );
    fillAndSave('Save Lead');
    await act(async () => { jest.advanceTimersByTime(500); });
    await waitFor(() => expect(emailHelpers.validateEmailUnique).toHaveBeenCalled());
    expect(createFn).not.toHaveBeenCalled();
  });

  it('fills in client details passed as prefill and saves them on the new proposal', async () => {
    const createFn = jest.fn().mockResolvedValue({ id: 'p2' });
    const { rerender } = render(<CreatePipelineLeadForm {...PROPOSAL_PROPS} createFn={createFn} />);
    rerender(
      <CreatePipelineLeadForm
        {...PROPOSAL_PROPS}
        createFn={createFn}
        prefill={{ first_name: 'Asha', last_name: 'Rao', company: 'Zyarex', email: 'asha@zyarex.com', city: 'Pune', not_a_form_field: 'x' }}
      />,
    );
    expect(screen.getByPlaceholderText('First Name')).toHaveValue('Asha');
    expect(screen.getByLabelText('Company')).toHaveValue('Zyarex');
    fireEvent.click(screen.getByRole('button', { name: 'Save Proposal' }));
    await waitFor(() => expect(createFn).toHaveBeenCalled());
    const [payload] = createFn.mock.calls[0];
    expect(payload).toMatchObject({ first_name: 'Asha', company: 'Zyarex', email: 'asha@zyarex.com', city: 'Pune' });
    expect(payload).not.toHaveProperty('not_a_form_field');
  });
});
