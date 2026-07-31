import * as peopleApi from '../services/people.js';
import * as contactsApi from '../services/contacts.js';
import * as leadsApi from '../services/leads.js';
import * as dealsApi from '../services/deals.js';
import { listContactDirectory } from '../services/contactDirectory.js';

jest.mock('../services/people.js', () => ({
  listPeople: jest.fn(),
  listAllMatchingPeopleIds: jest.fn(),
}));

jest.mock('../services/contacts.js', () => ({
  listAllContacts: jest.fn(),
}));

jest.mock('../services/leads.js', () => ({
  listAllLeads: jest.fn(),
}));

jest.mock('../services/deals.js', () => ({
  listAllDeals: jest.fn(),
}));

describe('listContactDirectory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to client merge when the people API returns no rows', async () => {
    peopleApi.listPeople.mockResolvedValue({ data: [], total: 0 });
    contactsApi.listAllContacts.mockResolvedValue({
      data: [{ id: 'c1', first_name: 'Ann', last_name: 'Lee', email: 'ann@example.com' }],
      total: 1,
    });
    leadsApi.listAllLeads.mockResolvedValue({ data: [], total: 0 });
    dealsApi.listAllDeals.mockResolvedValue({ data: [], total: 0 });

    const result = await listContactDirectory({ page: 1, page_size: 25, filters: {} });

    expect(result.total).toBe(1);
    expect(result.data[0].email).toBe('ann@example.com');
    expect(contactsApi.listAllContacts).toHaveBeenCalled();
  });

  it('uses people API when it returns rows', async () => {
    peopleApi.listPeople.mockResolvedValue({
      data: [{ id: 'contact:p1', first_name: 'Bob', last_name: 'Ray', entity_type: 'contact', record_id: 'p1' }],
      total: 1,
    });

    const result = await listContactDirectory({ page: 1, page_size: 25, filters: {} });

    expect(result.total).toBe(1);
    expect(result.data[0].first_name).toBe('Bob');
    expect(contactsApi.listAllContacts).not.toHaveBeenCalled();
  });
});
