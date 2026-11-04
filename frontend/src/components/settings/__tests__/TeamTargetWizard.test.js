import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TeamTargetWizard from '../TeamTargetWizard.js';
import * as lookups from '../../../lib/services/lookups.js';
import * as salesTargetsApi from '../../../lib/services/salesTargets.js';
import * as recordNavigation from '../../../lib/recordNavigation.js';

jest.mock('../../layout/CRMLayout.js', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

jest.mock('../../ui/AppLink.js', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }) => <a href={href} {...rest}>{children}</a>,
}));

const showToast = jest.fn();
jest.mock('../../ui/Toast.js', () => ({
  useToast: () => ({ showToast: (...args) => showToast(...args) }),
}));

jest.mock('../../../hooks/usePermissions.js', () => ({
  usePermissions: () => ({ can: () => true }),
}));

jest.mock('../../../lib/services/lookups.js', () => ({
  fetchUsers: jest.fn(),
}));

jest.mock('../../../lib/services/salesTargets.js', () => ({
  createSalesTarget: jest.fn(),
}));

jest.mock('../../../lib/recordNavigation.js', () => ({
  navigateToRecord: jest.fn(),
}));

const USERS = [
  { id: 'u1', name: 'Narayana', role: 'sales_manager' },
  { id: 'u2', name: 'Manisha Roy', role: 'sales_rep' },
  { id: 'u3', name: 'Admin Person', role: 'super_admin' },
];

function fill(label, value) {
  fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
}

describe('TeamTargetWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lookups.fetchUsers.mockResolvedValue(USERS);
    salesTargetsApi.createSalesTarget.mockResolvedValue({ id: 't' });
  });

  it('walks through the steps and saves one monthly target per person per month', async () => {
    render(<TeamTargetWizard />);
    // Sales roles are pre-selected; the admin is not.
    await waitFor(() => expect(screen.getByText('Team Members (2 selected)')).toBeInTheDocument());

    fill('Start Date', '2026-10-01');
    fill('End Date', '2026-12-31');
    fill('Team Revenue Target', '60');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Metrics to track')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Step 3: auto-distributed 50/50, shown with the mockup's summary strip and sidebar.
    expect(screen.getByText('Assign Individual Targets')).toBeInTheDocument();
    expect(screen.getByText('Oct 2026 – Dec 2026 (3 Months)')).toBeInTheDocument();
    expect(screen.getByLabelText('Revenue Target for Narayana')).toHaveValue(30);
    expect(screen.getByLabelText('Pipeline Target for Manisha Roy')).toHaveValue(132);
    expect(screen.getByText('Weekly Target (Per Person)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Quarterly View' }));
    expect(screen.getByText('Oct–Dec 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Monthly Targets' }));

    fireEvent.click(screen.getByRole('button', { name: 'Next: Review' }));
    fireEvent.click(screen.getByRole('button', { name: /Save & Activate Targets/ }));

    await waitFor(() => expect(recordNavigation.navigateToRecord).toHaveBeenCalledWith('/settings?sales_targets=1'));
    expect(salesTargetsApi.createSalesTarget).toHaveBeenCalledTimes(6);
    expect(salesTargetsApi.createSalesTarget).toHaveBeenCalledWith(expect.objectContaining({
      period_type: 'monthly',
      period_name: 'Oct 2026',
      employee_id: 'u1',
      status: 'active',
      revenue_target: 1000000,
    }));
  });

  it('does not leave step 1 without dates', async () => {
    render(<TeamTargetWizard />);
    await waitFor(() => expect(screen.getByText('Team Members (2 selected)')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(showToast).toHaveBeenCalledWith('Choose a valid start and end date.');
    expect(screen.queryByText('Metrics to track')).not.toBeInTheDocument();
  });

  it('reports targets that fail to save and stays on the page', async () => {
    salesTargetsApi.createSalesTarget
      .mockResolvedValueOnce({ id: 't' })
      .mockRejectedValue(new Error('duplicate'));
    render(<TeamTargetWizard />);
    await waitFor(() => expect(screen.getByText('Team Members (2 selected)')).toBeInTheDocument());
    fill('Start Date', '2026-10-01');
    fill('End Date', '2026-10-31');
    fill('Team Revenue Target', '10');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/^1 of 2 monthly targets saved/)));
    expect(recordNavigation.navigateToRecord).not.toHaveBeenCalled();
  });
});
