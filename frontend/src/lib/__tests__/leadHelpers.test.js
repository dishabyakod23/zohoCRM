import { normalizeLead, toLeadPayload, resolveLeadOwnerId, resolveLeadStatusForApi, outreachLeadStatusLabel } from '../leadHelpers.js';

describe('AMC / IT Support on leads', () => {
  it('normalizes amc_it_support and amc_currency from the API', () => {
    const lead = normalizeLead({
      first_name: 'Ada',
      last_name: 'Lovelace',
      amc_it_support: 12000,
      amc_currency: 'USD',
    });
    expect(lead.amc_it_support).toBe(12000);
    expect(lead.amc_currency).toBe('USD');
  });

  it('defaults amc_currency to the proposal currency', () => {
    const lead = normalizeLead({ amc_it_support: 500, currency: 'EUR' });
    expect(lead.amc_currency).toBe('EUR');
  });

  it('sends numeric amc_it_support and currency on create', () => {
    const payload = toLeadPayload({
      first_name: 'Ada',
      last_name: 'Lovelace',
      company: 'Acme',
      email: 'ada@example.com',
      amc_it_support: '1500.50',
      amc_currency: 'GBP',
    });
    expect(payload.amc_it_support).toBe(1500.5);
    expect(payload.amc_currency).toBe('GBP');
  });

  it('normalizes salutation aliases from the API', () => {
    expect(normalizeLead({ salutation: 'Mr' }).salutation).toBe('Mr.');
    expect(normalizeLead({ prefix: 'Mrs' }).salutation).toBe('Mrs.');
  });

  it('clears amc_it_support when empty on patch', () => {
    const payload = toLeadPayload({ amc_it_support: '' }, { partial: true });
    expect(payload.amc_it_support).toBeNull();
  });
});

describe('Proposal Type on leads', () => {
  it('normalizes proposal_type and label from the API', () => {
    const lead = normalizeLead({ proposal_type: 'fixed_cost' });
    expect(lead.proposal_type).toBe('fixed_cost');
    expect(lead.proposal_type_label).toBe('Fixed Cost');
  });

  it('sends proposal_type on create and patch', () => {
    expect(toLeadPayload({
      first_name: 'Ada',
      last_name: 'Lovelace',
      company: 'Acme',
      email: 'ada@example.com',
      proposal_type: 'time_and_material',
    }).proposal_type).toBe('time_and_material');

    expect(toLeadPayload({ proposal_type: 'fixed_cost' }, { partial: true }).proposal_type).toBe('fixed_cost');
    expect(toLeadPayload({ proposal_type: '' }, { partial: true }).proposal_type).toBeNull();
  });
});

describe('resolveLeadStatusForApi', () => {
  const statusOptions = [
    { value: 'follow_up_email_1', label: 'Follow Up Email 1' },
    { value: 'not_contacted', label: 'Not Contacted' },
    { value: 'proposal_required', label: 'Proposal Required' },
  ];

  it('resolves custom status values from lookup options', () => {
    expect(resolveLeadStatusForApi('follow_up_email_1', statusOptions)).toBe('follow_up_email_1');
    expect(resolveLeadStatusForApi('Follow Up Email 1', statusOptions)).toBe('follow_up_email_1');
  });

  it('passes through snake_case custom values', () => {
    expect(resolveLeadStatusForApi('custom_status_value')).toBe('custom_status_value');
  });

  it('does not map proposal pipeline stage to qualified_lead', () => {
    expect(resolveLeadStatusForApi('proposal')).toBe('proposal');
    expect(resolveLeadStatusForApi('proposal_required', statusOptions)).toBe('proposal_required');
  });
});

describe('toLeadPayload lead_status', () => {
  it('sends null lead_status when none is selected', () => {
    const payload = toLeadPayload({
      first_name: 'Ada',
      last_name: 'Lovelace',
      company: 'Acme',
      email: 'ada@example.com',
      lead_status: '',
    });
    expect(payload.lead_status).toBeNull();
  });

  it('includes pipeline_stage when creating a cold lead', () => {
    const payload = toLeadPayload({
      first_name: 'Ada',
      last_name: 'Lovelace',
      company: 'Acme',
      email: 'ada@example.com',
      lead_status: '',
      pipeline_stage: 'raw_prospect',
    });
    expect(payload.lead_status).toBeNull();
    expect(payload.pipeline_stage).toBe('raw_prospect');
  });

  it('includes lost_reason on PATCH when status is lost', () => {
    const payload = toLeadPayload({
      lead_status: 'lost',
      lost_reason: 'not_interested',
    }, { partial: true });
    expect(payload.lead_status).toBe('lost');
    expect(payload.lost_reason).toBe('not_interested');
  });

  it('includes lost_reason on PATCH for budget_issue enum value', () => {
    const payload = toLeadPayload({
      lead_status: 'lost',
      lost_reason: 'budget_issue',
    }, { partial: true });
    expect(payload.lost_reason).toBe('budget_issue');
  });

  it('clears lost_reason on PATCH when status is not lost', () => {
    const payload = toLeadPayload({
      lead_status: 'contacted',
      lost_reason: 'budget_issue',
    }, { partial: true });
    expect(payload.lead_status).toBe('contacted');
    expect(payload.lost_reason).toBeNull();
  });
});

describe('resolveLeadOwnerId', () => {
  it('uses form owner when present', () => {
    expect(resolveLeadOwnerId({ owner_id: 'owner-1' }, 'rep-1')).toBe('owner-1');
  });

  it('falls back to the current user for non-assigners', () => {
    expect(resolveLeadOwnerId({ owner_id: '' }, 'rep-1')).toBe('rep-1');
    expect(resolveLeadOwnerId({}, 'rep-1')).toBe('rep-1');
  });
});

describe('outreachLeadStatusLabel', () => {
  it('shows blank when outreach status is unset or a pipeline stage default', () => {
    expect(outreachLeadStatusLabel(null)).toBe('—');
    expect(outreachLeadStatusLabel('')).toBe('—');
    expect(outreachLeadStatusLabel('raw_prospect')).toBe('—');
    expect(outreachLeadStatusLabel('qualified_lead')).toBe('—');
    expect(outreachLeadStatusLabel('Cold Lead')).toBe('—');
  });

  it('shows outreach labels when set', () => {
    expect(outreachLeadStatusLabel('not_contacted')).toBe('Not Contacted');
    expect(outreachLeadStatusLabel('meeting_completed')).toBe('Meeting Completed');
  });
});
