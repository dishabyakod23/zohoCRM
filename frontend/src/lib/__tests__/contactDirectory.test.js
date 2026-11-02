import * as peopleApi from '../services/people.js';
import * as contactsApi from '../services/contacts.js';
import * as leadsApi from '../services/leads.js';
import * as dealsApi from '../services/deals.js';
import { listContactDirectory, listAllMatchingContactDirectoryIds } from '../services/contactDirectory.js';
import { setLinkedInRequestSent, buildOutreachActivityIndex } from '../outreachActivity.js';

jest.mock('../services/people.js', () => ({
  listPeople: jest.fn(),
  listAllMatchingPeople: jest.fn(),
  listAllMatchingPeopleIds: jest.fn(),
}));

jest.mock('../services/contacts.js', () => ({
  listAllContacts: jest.fn(),
  getContact: jest.fn(),
}));

jest.mock('../services/leads.js', () => ({
  listAllLeads: jest.fn(),
  getLead: jest.fn(),
}));

jest.mock('../services/deals.js', () => ({
  listAllDeals: jest.fn(),
}));

describe('listContactDirectory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses directory API result even when empty', async () => {
    peopleApi.listPeople.mockResolvedValue({ data: [], total: 0 });

    const result = await listContactDirectory({ page: 1, page_size: 25, filters: {} });

    expect(result.total).toBe(0);
    expect(contactsApi.listAllContacts).not.toHaveBeenCalled();
  });

  it('falls back to client merge when the directory API fails', async () => {
    peopleApi.listPeople.mockRejectedValue({ response: { status: 500 } });
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

  it('uses directory API when it returns rows', async () => {
    peopleApi.listPeople.mockResolvedValue({
      data: [{ id: 'contact:p1', first_name: 'Bob', last_name: 'Ray', entity_type: 'contact', record_id: 'p1' }],
      total: 1,
    });

    const result = await listContactDirectory({ page: 1, page_size: 25, filters: {} });

    expect(result.total).toBe(1);
    expect(result.data[0].first_name).toBe('Bob');
    expect(contactsApi.listAllContacts).not.toHaveBeenCalled();
  });

  it('loads only campaign member records instead of scraping all contacts', async () => {
    contactsApi.getContact.mockImplementation(async (id) => ({
      id,
      first_name: id === 'c1' ? 'In' : 'Other',
      last_name: 'Campaign',
      email: `${id}@example.com`,
    }));
    leadsApi.getLead.mockResolvedValue(null);

    const result = await listContactDirectory({
      page: 1,
      page_size: 25,
      filters: { campaign_id: 'camp-1' },
      campaignMemberIds: new Set(['c1']),
      memberGroups: {
        ids: new Set(['c1']),
        contactIds: ['c1'],
        leadIds: [],
        accountIds: [],
      },
    });

    expect(contactsApi.listAllContacts).not.toHaveBeenCalled();
    expect(contactsApi.getContact).toHaveBeenCalledWith('c1', expect.anything());
    expect(result.total).toBe(1);
    expect(result.data[0].email).toBe('c1@example.com');
  });
});

describe('listAllMatchingContactDirectoryIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('applies created-date and notes filters the people API does not send', async () => {
    peopleApi.listAllMatchingPeople.mockResolvedValue([
      { id: 'in', created_at: '2026-03-10T10:00:00.000Z', notes: 'follow up next week' },
      { id: 'out-date', created_at: '2026-01-01T10:00:00.000Z', notes: 'follow up next week' },
      { id: 'out-notes', created_at: '2026-03-10T10:00:00.000Z', notes: 'unrelated' },
    ]);

    const ids = await listAllMatchingContactDirectoryIds({
      filters: { created_from: '2026-03-01', notes_q: 'follow up' },
    });

    expect(ids).toEqual(['in']);
  });

  it('applies activity dates using the same outreach enrichment as the list', async () => {
    setLinkedInRequestSent('c-in', { sent: true, user: { id: 'u1', name: 'Rep' } });
    const outreachIndex = buildOutreachActivityIndex();
    const sentDay = outreachIndex['c-in'][0].at.slice(0, 10);

    peopleApi.listAllMatchingPeople.mockResolvedValue([
      { id: 'contact:c-in', record_id: 'c-in' },
      { id: 'contact:c-out', record_id: 'c-out' },
    ]);

    const ids = await listAllMatchingContactDirectoryIds(
      { filters: { activity_from: sentDay, activity_to: sentDay } },
      {},
      [],
      { outreachIndex, calls: [] },
    );

    expect(ids).toEqual(['contact:c-in']);
  });
});
