import { normalizePersonRow, personDetailHref } from '../services/people.js';

describe('normalizePersonRow', () => {
  it('maps company fields and builds detail href for leads', () => {
    const row = normalizePersonRow({
      id: 'l1',
      entity_type: 'lead',
      first_name: 'Ann',
      last_name: 'Lee',
      company: 'Acme',
      current_status: 'Raw Lead',
      campaign_id: 'c1',
      campaign_name: 'Spring',
    });

    expect(row.account_name).toBe('Acme');
    expect(row.current_status).toBe('Raw Lead');
    expect(row.campaign_name).toBe('Spring');
    expect(row._detailHref).toBe('/leads/l1');
  });

  it('uses API-provided detail href when present', () => {
    expect(personDetailHref({ detail_href: '/contacts/abc' })).toBe('/contacts/abc');
  });
});
