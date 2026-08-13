import {
  filterLeadMassUpdateFields,
  isProposalOnlyMassUpdateField,
  isProposalMassUpdateModule,
} from '../services/lookups.js';

const FIELDS = [
  { value: 'lead_status', label: 'Lead Status' },
  { value: 'owner_id', label: 'Owner' },
  { value: 'proposal_type', label: 'Proposal Type' },
  { value: 'amc_it_support', label: 'AMC / IT Support' },
  { value: 'amc_currency', label: 'AMC Currency' },
  { value: 'campaign', label: 'Campaign' },
];

describe('isProposalOnlyMassUpdateField', () => {
  it('detects proposal-only field keys', () => {
    expect(isProposalOnlyMassUpdateField({ value: 'proposal_type' })).toBe(true);
    expect(isProposalOnlyMassUpdateField({ value: 'amc_it_support' })).toBe(true);
    expect(isProposalOnlyMassUpdateField({ value: 'amc_currency' })).toBe(true);
    expect(isProposalOnlyMassUpdateField({ value: 'lead_status' })).toBe(false);
  });
});

describe('isProposalMassUpdateModule', () => {
  it('recognizes proposals module and stage', () => {
    expect(isProposalMassUpdateModule({ moduleKey: 'proposals' })).toBe(true);
    expect(isProposalMassUpdateModule({ pipelineStage: 'proposal' })).toBe(true);
    expect(isProposalMassUpdateModule({ moduleKey: 'raw-leads' })).toBe(false);
    expect(isProposalMassUpdateModule({ moduleKey: 'leads' })).toBe(false);
    expect(isProposalMassUpdateModule({ moduleKey: 'qualified-leads' })).toBe(false);
  });
});

describe('filterLeadMassUpdateFields', () => {
  it('hides proposal-only fields on raw leads', () => {
    const filtered = filterLeadMassUpdateFields(FIELDS, {
      canChangeOwner: true,
      moduleKey: 'raw-leads',
    });
    expect(filtered.map((f) => f.value)).toEqual(['lead_status', 'owner_id', 'campaign']);
  });

  it('hides proposal-only fields on leads and qualified leads', () => {
    expect(filterLeadMassUpdateFields(FIELDS, { canChangeOwner: true, moduleKey: 'leads' })
      .map((f) => f.value)).not.toContain('proposal_type');
    expect(filterLeadMassUpdateFields(FIELDS, { canChangeOwner: true, moduleKey: 'qualified-leads' })
      .map((f) => f.value)).not.toContain('amc_it_support');
  });

  it('keeps proposal-only fields on proposals', () => {
    const filtered = filterLeadMassUpdateFields(FIELDS, {
      canChangeOwner: true,
      moduleKey: 'proposals',
    });
    expect(filtered.map((f) => f.value)).toEqual([
      'lead_status',
      'owner_id',
      'proposal_type',
      'amc_it_support',
      'amc_currency',
      'campaign',
    ]);
  });

  it('still hides owner when user cannot reassign', () => {
    const filtered = filterLeadMassUpdateFields(FIELDS, {
      canChangeOwner: false,
      moduleKey: 'proposals',
    });
    expect(filtered.map((f) => f.value)).not.toContain('owner_id');
    expect(filtered.map((f) => f.value)).toContain('proposal_type');
  });
});
