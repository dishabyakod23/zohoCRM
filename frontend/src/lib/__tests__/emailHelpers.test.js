import { findEmailConflict, validateEmailUnique } from '../emailHelpers.js';
import * as leadsApi from '../services/leads.js';
import * as contactsApi from '../services/contacts.js';

jest.mock('../services/leads.js', () => ({ listLeads: jest.fn() }));
jest.mock('../services/contacts.js', () => ({ listContacts: jest.fn() }));

function lead(overrides) {
  return { id: 'lead-1', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', ...overrides };
}

function contact(overrides) {
  return { id: 'contact-1', first_name: 'Grace', last_name: 'Hopper', email: 'grace@example.com', ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  leadsApi.listLeads.mockResolvedValue({ data: [] });
  contactsApi.listContacts.mockResolvedValue({ data: [] });
});

describe('findEmailConflict', () => {
  it('returns null for an empty email without calling the API', async () => {
    expect(await findEmailConflict('')).toBeNull();
    expect(leadsApi.listLeads).not.toHaveBeenCalled();
    expect(contactsApi.listContacts).not.toHaveBeenCalled();
  });

  it('returns null when neither leads nor contacts match', async () => {
    expect(await findEmailConflict('nobody@example.com')).toBeNull();
  });

  it('finds a matching lead, case-insensitively', async () => {
    leadsApi.listLeads.mockResolvedValue({ data: [lead({ email: 'Ada@Example.com' })] });
    const conflict = await findEmailConflict('ada@example.com');
    expect(conflict).toEqual({ module: 'lead', id: 'lead-1', name: 'Ada Lovelace' });
  });

  it('finds a matching contact when no lead matches', async () => {
    contactsApi.listContacts.mockResolvedValue({ data: [contact()] });
    const conflict = await findEmailConflict('grace@example.com');
    expect(conflict).toEqual({ module: 'contact', id: 'contact-1', name: 'Grace Hopper' });
  });

  it('prefers a lead match over a contact match when both exist', async () => {
    leadsApi.listLeads.mockResolvedValue({ data: [lead({ email: 'shared@example.com' })] });
    contactsApi.listContacts.mockResolvedValue({ data: [contact({ email: 'shared@example.com' })] });
    const conflict = await findEmailConflict('shared@example.com');
    expect(conflict.module).toBe('lead');
  });

  it('excludes the record currently being edited', async () => {
    leadsApi.listLeads.mockResolvedValue({ data: [lead({ id: 'lead-1', email: 'ada@example.com' })] });
    const conflict = await findEmailConflict('ada@example.com', { excludeLeadId: 'lead-1' });
    expect(conflict).toBeNull();
  });

  it('skips contact conflicts when excludeLeadId is set (synced lead/contact email)', async () => {
    leadsApi.listLeads.mockResolvedValue({ data: [] });
    contactsApi.listContacts.mockResolvedValue({ data: [contact({ email: 'ada@example.com' })] });
    const conflict = await findEmailConflict('ada@example.com', { excludeLeadId: 'lead-1' });
    expect(conflict).toBeNull();
    expect(contactsApi.listContacts).not.toHaveBeenCalled();
  });

  it('skips lead conflicts when only excludeContactId is set', async () => {
    leadsApi.listLeads.mockResolvedValue({ data: [lead({ email: 'grace@example.com' })] });
    contactsApi.listContacts.mockResolvedValue({ data: [] });
    const conflict = await findEmailConflict('grace@example.com', { excludeContactId: 'contact-1' });
    expect(conflict).toBeNull();
    expect(leadsApi.listLeads).not.toHaveBeenCalled();
  });
});

describe('validateEmailUnique', () => {
  it('returns null when the email is available', async () => {
    expect(await validateEmailUnique('free@example.com')).toBeNull();
  });

  it('returns a lead-specific message when a lead owns the email', async () => {
    leadsApi.listLeads.mockResolvedValue({ data: [lead({ email: 'taken@example.com' })] });
    expect(await validateEmailUnique('taken@example.com')).toBe('A lead with this email already exists.');
  });

  it('returns a contact-specific message when a contact owns the email', async () => {
    contactsApi.listContacts.mockResolvedValue({ data: [contact({ email: 'taken@example.com' })] });
    expect(await validateEmailUnique('taken@example.com')).toBe('A contact with this email already exists.');
  });
});
