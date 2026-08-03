import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CreateContactForm from '../CreateContactForm.js';
import * as contactsApi from '../../../lib/services/contacts.js';
import * as lookups from '../../../lib/services/lookups.js';
import * as emailHelpers from '../../../lib/emailHelpers.js';
import * as resolveContactAccount from '../../../lib/resolveContactAccount.js';
import * as campaignRecordHelpers from '../../../lib/campaignRecordHelpers.js';
import * as recordNavigation from '../../../lib/recordNavigation.js';

jest.mock('../../layout/CRMLayout.js', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('../../../hooks/useAuth.js', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: 'sales_rep' } }),
}));

const showToast = jest.fn();
jest.mock('../../ui/Toast.js', () => ({
  useToast: () => ({ showToast: (...args) => showToast(...args) }),
}));

jest.mock('../../../lib/services/lookups.js', () => ({
  fetchCompanyLookups: jest.fn(),
  fetchUsers: jest.fn(),
}));

jest.mock('../../../lib/services/contacts.js', () => ({
  createContact: jest.fn(),
}));

jest.mock('../../../lib/emailHelpers.js', () => ({
  validateEmailUnique: jest.fn(),
}));

jest.mock('../../../lib/resolveContactAccount.js', () => ({
  resolveContactCompanyFields: jest.fn(),
  resolveContactAccountId: jest.fn(),
}));

jest.mock('../../../lib/campaignRecordHelpers.js', () => ({
  fetchCampaignLookups: jest.fn(),
  afterRecordSave: jest.fn(),
  resolveOrCreateCampaignId: jest.fn(),
}));

jest.mock('../../../lib/recordNavigation.js', () => ({
  navigateToRecord: jest.fn(),
}));

function deferred() {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
}

// fireEvent (not userEvent.type) fills every field in one synchronous DOM event each, so
// the 350ms email-uniqueness debounce timer starts at a known instant and tests can click
// deterministically *before* it fires — reproducing the exact race window BUG-001 exploited.
function fillRequiredFields() {
  const firstName = document.querySelector('[data-field="first_name"] input');
  const lastName = document.querySelector('[data-field="last_name"] input');
  const email = document.querySelector('[data-field="email"] input');
  const account = document.querySelector('[data-field="account_id"] input');

  fireEvent.change(firstName, { target: { value: 'Ada' } });
  fireEvent.change(lastName, { target: { value: 'Lovelace' } });
  fireEvent.change(account, { target: { value: 'Acme Inc' } });
  fireEvent.change(email, { target: { value: 'ada@example.com' } });
}

beforeEach(() => {
  jest.clearAllMocks();
  lookups.fetchCompanyLookups.mockResolvedValue([]);
  lookups.fetchUsers.mockResolvedValue([]);
  campaignRecordHelpers.fetchCampaignLookups.mockResolvedValue([]);
  campaignRecordHelpers.afterRecordSave.mockResolvedValue();
  campaignRecordHelpers.resolveOrCreateCampaignId.mockResolvedValue(null);
  resolveContactAccount.resolveContactCompanyFields.mockResolvedValue({
    company_id: 'company-1',
    company_name: 'Acme Inc',
    account_id: null,
  });
  recordNavigation.navigateToRecord.mockImplementation(() => {});
});

describe('CreateContactForm — double-submission guard (BUG-001 regression)', () => {
  it('creates exactly one contact when Save is clicked twice back-to-back, before the email-uniqueness check resolves', async () => {
    const uniqueCheck = deferred();
    emailHelpers.validateEmailUnique.mockReturnValue(uniqueCheck.promise);
    contactsApi.createContact.mockResolvedValue({ id: 'contact-1' });

    render(<CreateContactForm />);
    fillRequiredFields();

    const [headerSave] = screen.getAllByRole('button', { name: /save contact/i });

    // Two clicks in the same synchronous window, before the 350ms debounce on the email
    // field has fired and before the in-flight uniqueness check resolves — exactly the
    // race BUG-001 exploited (setSaving(true) used to run *after* this await).
    fireEvent.click(headerSave);
    fireEvent.click(headerSave);

    uniqueCheck.resolve(null);
    await waitFor(() => expect(contactsApi.createContact).toHaveBeenCalled());

    expect(contactsApi.createContact).toHaveBeenCalledTimes(1);
  });

  it('does not start a second create while the first save is still in flight', async () => {
    emailHelpers.validateEmailUnique.mockResolvedValue(null);
    const createCall = deferred();
    contactsApi.createContact.mockReturnValue(createCall.promise);

    render(<CreateContactForm />);
    fillRequiredFields();

    const [headerSave] = screen.getAllByRole('button', { name: /save contact/i });
    fireEvent.click(headerSave);
    await waitFor(() => expect(contactsApi.createContact).toHaveBeenCalledTimes(1));

    // Button should now be disabled while the create request is in flight.
    expect(headerSave).toBeDisabled();
    fireEvent.click(headerSave);

    createCall.resolve({ id: 'contact-1' });
    await waitFor(() => expect(recordNavigation.navigateToRecord).toHaveBeenCalled());

    expect(contactsApi.createContact).toHaveBeenCalledTimes(1);
  });
});

describe('CreateContactForm — Save button consistency (BUG-002 regression)', () => {
  it('disables both the header and footer Save buttons together while a duplicate email error is present', async () => {
    emailHelpers.validateEmailUnique.mockResolvedValue('A contact with this email already exists.');

    render(<CreateContactForm />);
    fillRequiredFields();

    await waitFor(() => {
      const buttons = screen.getAllByRole('button', { name: /save contact/i });
      expect(buttons).toHaveLength(2);
      buttons.forEach((btn) => expect(btn).toBeDisabled());
    }, { timeout: 2000 });
  });
});
