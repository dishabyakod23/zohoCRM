import {
  normalizePersonRow,
  personDetailHref,
  personRowId,
  parsePersonRowId,
  deletePersonRecord,
} from '../services/people.js';
import * as leadsApi from '../services/leads.js';
import * as contactsApi from '../services/contacts.js';

jest.mock('../services/leads.js', () => ({
  deleteLead: jest.fn(() => Promise.resolve()),
}));
jest.mock('../services/contacts.js', () => ({
  deleteContact: jest.fn(() => Promise.resolve()),
}));

describe('normalizePersonRow', () => {
  it('maps company fields and builds detail href for leads', () => {
    const row = normalizePersonRow({
      record_id: 'l1',
      entity_type: 'lead',
      first_name: 'Ann',
      last_name: 'Lee',
      company: 'Acme',
      current_status: 'Cold Lead',
      campaign_id: 'c1',
      campaign_name: 'Spring',
    });

    expect(row.id).toBe('lead:l1');
    expect(row.record_id).toBe('l1');
    expect(row.account_name).toBe('Acme');
    expect(row.current_status).toBe('Cold Lead');
    expect(row.campaign_name).toBe('Spring');
    expect(row._detailHref).toBe('/leads/l1');
  });

  it('uses API-provided detail href when present', () => {
    expect(personDetailHref({ detail_href: '/contacts/abc' })).toBe('/contacts/abc');
    expect(personDetailHref({ detail_path: 'leads/uuid-here' })).toBe('/leads/uuid-here');
  });

  it('keeps plain contact ids for legacy rows', () => {
    expect(personRowId({ id: 'c1' })).toBe('c1');
    expect(parsePersonRowId('c1')).toEqual({ entityType: 'contact', recordId: 'c1' });
  });

  it('maps production directory row shape', () => {
    const row = normalizePersonRow({
      id: 'c1',
      entity_type: 'contact',
      detail_path: '/contacts/c1',
      first_name: 'Ann',
      last_name: 'Lee',
      company_name: 'Acme',
      current_status: 'Contact',
    });

    expect(row.id).toBe('contact:c1');
    expect(row.account_name).toBe('Acme');
    expect(row.current_status).toBe('Contact');
    expect(row._detailHref).toBe('/contacts/c1');
  });

  it('does not mark company-linked contacts as Account', () => {
    const row = normalizePersonRow({
      record_id: 'c1',
      entity_type: 'contact',
      account_id: 'co1',
      account_name: 'Acme',
      current_status: 'Account',
    });
    expect(row.current_status).toBe('Contact');
    expect(row._entityType).toBe('contact');
  });

  it('keeps contact current status and clears pipeline values from lead status', () => {
    const row = normalizePersonRow({
      id: 'c1',
      entity_type: 'contact',
      current_status: 'CONTACT',
      lead_status: 'raw_prospect',
    });
    expect(row.current_status).toBe('Contact');
    expect(row.lead_status).toBeNull();
  });

  it('keeps outreach lead status and does not default it', () => {
    const row = normalizePersonRow({
      id: 'c1',
      entity_type: 'contact',
      current_status: 'Contact',
      lead_status: 'not_contacted',
    });
    expect(row.current_status).toBe('Contact');
    expect(row.lead_status).toBe('not_contacted');
  });
});

describe('deletePersonRecord', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes contacts via contacts API', async () => {
    await deletePersonRecord({ entity_type: 'contact', record_id: 'c1' });
    expect(contactsApi.deleteContact).toHaveBeenCalledWith('c1');
  });

  it('deletes leads via leads API', async () => {
    await deletePersonRecord({ entity_type: 'lead', record_id: 'l1' });
    expect(leadsApi.deleteLead).toHaveBeenCalledWith('l1');
  });
});
