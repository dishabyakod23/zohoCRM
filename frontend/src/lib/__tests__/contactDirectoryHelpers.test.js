import {
  buildDirectoryRows,
  dedupeDirectoryRows,
  contactToDirectoryRow,
  leadToDirectoryRow,
  applyContactDirectoryFilters,
  resolveDirectoryCurrentStatus,
  directoryLeadStatusValue,
} from '../contactDirectoryHelpers.js';
import { PIPELINE_RAW } from '../pipelineHelpers.js';

describe('buildDirectoryRows', () => {
  it('includes leads that are not already represented as contacts', () => {
    const contacts = [{
      id: 'c1',
      first_name: 'Ann',
      last_name: 'Lee',
      email: 'ann@example.com',
      campaign_name: 'Spring',
    }];
    const leads = [{
      id: 'l1',
      first_name: 'Bob',
      last_name: 'Ray',
      email: 'bob@example.com',
      lead_status: PIPELINE_RAW,
      company: 'Acme',
      campaign_name: 'Spring',
    }];

    const rows = buildDirectoryRows({ contacts, leads });
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.email === 'bob@example.com')?.current_status).toBe('Cold Lead');
    expect(rows.find((row) => row.email === 'ann@example.com')?.current_status).toBe('Contact');
  });

  it('dedupes by email and keeps the higher pipeline status', () => {
    const contacts = [{ id: 'c1', first_name: 'Ann', last_name: 'Lee', email: 'ann@example.com' }];
    const leads = [{ id: 'l1', first_name: 'Ann', last_name: 'Lee', email: 'ann@example.com', lead_status: PIPELINE_RAW }];

    const rows = buildDirectoryRows({ contacts, leads });
    expect(rows).toHaveLength(1);
    expect(rows[0].current_status).toBe('Cold Lead');
    expect(rows[0]._entityType).toBe('lead');
  });

  it('keeps contacts linked to a company as Contact', () => {
    const rows = buildDirectoryRows({
      contacts: [{ id: 'c1', first_name: 'Sarah', last_name: 'Wilson', email: 'sarah@example.com', account_id: 'a1', account_name: 'Acme' }],
    });
    expect(rows[0].current_status).toBe('Contact');
    expect(rows[0].account_name).toBe('Acme');
  });

  it('hides contacts marked is_converted so they do not appear as Contact rows', () => {
    const rows = buildDirectoryRows({
      contacts: [{
        id: 'c1',
        first_name: 'Ann',
        last_name: 'Lee',
        email: 'ann@example.com',
        is_converted: true,
      }],
      leads: [{
        id: 'l1',
        first_name: 'Ann',
        last_name: 'Lee',
        email: 'ann@example.com',
        pipeline_stage: 'proposal',
      }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].current_status).toBe('Proposal');
    expect(rows[0]._entityType).toBe('lead');
  });
});

describe('applyContactDirectoryFilters', () => {
  it('filters by designation and current status', () => {
    const rows = [
      contactToDirectoryRow({ id: '1', first_name: 'John', last_name: 'Smith', title: 'CTO', email: 'john@example.com' }),
      leadToDirectoryRow({ id: '2', first_name: 'Mary', last_name: 'Jones', title: 'IT Head', email: 'mary@example.com', lead_status: PIPELINE_RAW }),
    ];

    const filtered = applyContactDirectoryFilters(rows, { designation: 'CTO', current_status: 'Contact' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].email).toBe('john@example.com');
  });

  it('filters by lead_status without throwing', () => {
    const rows = [
      contactToDirectoryRow({ id: '1', first_name: 'Ann', last_name: 'Lee', email: 'ann@example.com', lead_status: 'follow_up_email_1' }),
      contactToDirectoryRow({ id: '2', first_name: 'Bob', last_name: 'Ray', email: 'bob@example.com', lead_status: 'contacted' }),
    ];

    const filtered = applyContactDirectoryFilters(rows, { lead_status: 'follow_up_email_1' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].email).toBe('ann@example.com');
  });
});

describe('dedupeDirectoryRows', () => {
  it('prefers higher pipeline status when the same email appears as contact and lead', () => {
    const rows = dedupeDirectoryRows([
      leadToDirectoryRow({ id: 'l1', first_name: 'A', last_name: 'B', email: 'x@example.com', lead_status: PIPELINE_RAW }),
      contactToDirectoryRow({ id: 'c1', first_name: 'A', last_name: 'B', email: 'x@example.com', account_id: 'acct-1' }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].current_status).toBe('Cold Lead');
  });
});

describe('directory current status vs lead status', () => {
  it('shows Cold Lead as Current Status when a synced contact has pipeline_stage', () => {
    const row = contactToDirectoryRow({
      id: 'c1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      current_status: 'CONTACT',
      pipeline_stage: PIPELINE_RAW,
      lead_status: 'not_contacted',
    });
    expect(row.current_status).toBe('Cold Lead');
    expect(row.lead_status).toBe('not_contacted');
  });

  it('does not promote contact Current Status from pipeline-valued lead_status alone', () => {
    const row = contactToDirectoryRow({
      id: 'c1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      current_status: 'CONTACT',
      lead_status: PIPELINE_RAW,
    });
    expect(row.current_status).toBe('Contact');
    expect(row.lead_status).toBeNull();
  });

  it('keeps Current Status as Contact when there is no pipeline stage', () => {
    const row = contactToDirectoryRow({
      id: 'c1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      current_status: 'Contact',
    });
    expect(row.current_status).toBe('Contact');
    expect(row.lead_status).toBeNull();
  });

  it('does not copy outreach lead status into Current Status', () => {
    const row = contactToDirectoryRow({
      id: 'c1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      current_status: 'Contact',
      lead_status: 'not_contacted',
    });
    expect(row.current_status).toBe('Contact');
    expect(row.lead_status).toBe('not_contacted');
  });

  it('keeps Current Status as Contact when lead_status is wrongly set to Qualified Lead', () => {
    expect(resolveDirectoryCurrentStatus({
      entity_type: 'contact',
      current_status: 'Qualified Lead',
      lead_status: 'qualified_lead',
    })).toBe('Contact');
    expect(directoryLeadStatusValue({ lead_status: 'qualified_lead' })).toBeNull();
  });

  it('uses pipeline_stage for Current Status when lead_status is blank', () => {
    expect(resolveDirectoryCurrentStatus({
      entity_type: 'contact',
      current_status: 'Contact',
      pipeline_stage: PIPELINE_RAW,
    })).toBe('Cold Lead');
    expect(directoryLeadStatusValue({ lead_status: '' })).toBeNull();
  });

  it('leaves Lead Status blank when the value is a pipeline stage label', () => {
    expect(directoryLeadStatusValue({ lead_status: 'Cold Lead' })).toBeNull();
    expect(directoryLeadStatusValue({ lead_status: PIPELINE_RAW })).toBeNull();
  });
});
