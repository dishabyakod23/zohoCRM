import {
  PIPELINE_RAW,
  PIPELINE_LEAD,
  PIPELINE_QUALIFIED,
  filterLeadsByPipelineStage,
  resolveLeadPipelineStage,
  outreachLeadStatusOptions,
  getConvertOptions,
} from '../pipelineHelpers.js';

describe('resolveLeadPipelineStage', () => {
  it('keeps raw pipeline leads when lead_status is not_contacted', () => {
    const lead = {
      pipeline_stage: 'raw_prospect',
      lead_status: 'not_contacted',
    };
    expect(resolveLeadPipelineStage(lead)).toBe(PIPELINE_RAW);
  });

  it('treats outreach statuses as raw when pipeline_stage is raw_prospect', () => {
    const lead = {
      pipeline_stage: 'raw_prospect',
      lead_status: 'attempted_to_contact',
    };
    expect(resolveLeadPipelineStage(lead)).toBe(PIPELINE_RAW);
  });

  it('falls back to raw for outreach statuses without pipeline_stage', () => {
    expect(resolveLeadPipelineStage({ lead_status: 'not_contacted' })).toBe(PIPELINE_RAW);
  });

  it('keeps custom lead statuses in the raw leads pipeline', () => {
    expect(resolveLeadPipelineStage({ lead_status: 'follow_up_email_1' })).toBe(PIPELINE_RAW);
    expect(resolveLeadPipelineStage({
      pipeline_stage: 'raw_prospect',
      lead_status: 'follow_up_email_1',
    })).toBe(PIPELINE_RAW);
  });

  it('maps contacted outreach status to leads pipeline when pipeline_stage is unset', () => {
    expect(resolveLeadPipelineStage({ lead_status: 'contacted' })).toBe('contacted');
  });
});

describe('filterLeadsByPipelineStage — raw leads', () => {
  it('includes not_contacted records in the raw leads list', () => {
    const leads = [
      { id: '1', pipeline_stage: 'raw_prospect', lead_status: 'raw_prospect' },
      { id: '2', pipeline_stage: 'raw_prospect', lead_status: 'not_contacted' },
      { id: '3', pipeline_stage: 'raw_prospect', lead_status: 'contacted' },
    ];
    const filtered = filterLeadsByPipelineStage(leads, PIPELINE_RAW);
    expect(filtered.map((l) => l.id)).toEqual(['1', '2', '3']);
  });

  it('includes custom status records in the raw leads list', () => {
    const leads = [
      { id: '1', pipeline_stage: 'raw_prospect', lead_status: 'follow_up_email_1' },
      { id: '2', lead_status: 'custom_status_value' },
    ];
    expect(filterLeadsByPipelineStage(leads, PIPELINE_RAW).map((l) => l.id)).toEqual(['1', '2']);
  });

  it('excludes converted leads', () => {
    const leads = [
      { id: '1', pipeline_stage: 'raw_prospect', lead_status: 'not_contacted', is_converted: true },
      { id: '2', pipeline_stage: 'raw_prospect', lead_status: 'not_contacted' },
    ];
    expect(filterLeadsByPipelineStage(leads, PIPELINE_RAW).map((l) => l.id)).toEqual(['2']);
  });
});

describe('outreachLeadStatusOptions', () => {
  it('removes pipeline stages from Lead Status dropdowns', () => {
    const options = outreachLeadStatusOptions([
      { value: 'raw_prospect', label: 'Cold Lead' },
      { value: 'contacted', label: 'Warm Lead' },
      { value: 'not_contacted', label: 'Not Contacted' },
    ]);
    expect(options.map((o) => o.value)).toEqual(['not_contacted']);
  });
});

describe('getConvertOptions', () => {
  it('hides convert targets the user cannot view', () => {
    const can = (module) => module === 'leads';
    const options = getConvertOptions(PIPELINE_RAW, { can });
    expect(options.map((o) => o.id)).toEqual(['lead']);
  });

  it('lists all other modules for qualified leads', () => {
    const options = getConvertOptions(PIPELINE_QUALIFIED);
    expect(options.map((o) => o.label)).toEqual([
      'Contact',
      'Cold Lead',
      'Warm Lead',
      'Proposal',
      'Account',
    ]);
  });

  it('excludes the current stage from convert targets', () => {
    const options = getConvertOptions(PIPELINE_LEAD);
    expect(options.some((o) => o.target === PIPELINE_LEAD)).toBe(false);
    expect(options.map((o) => o.id)).toContain('cold_lead');
    expect(options.map((o) => o.id)).toContain('qualified_lead');
  });
});

describe('filterLeadsByPipelineStage — proposals', () => {
  it('keeps proposal-stage records even when outreach lead_status is Proposal Required', () => {
    const leads = [
      {
        id: '1',
        pipeline_stage: 'proposal',
        lead_status: 'proposal_required',
        first_name: 'Umakanth',
      },
      {
        id: '2',
        pipeline_stage: 'qualified_lead',
        lead_status: 'qualified_lead',
        first_name: 'Other',
      },
      {
        id: '3',
        pipeline_stage: 'proposal',
        lead_status: 'proposal_sent',
      },
    ];
    expect(filterLeadsByPipelineStage(leads, 'proposal').map((l) => l.id)).toEqual(['1', '3']);
  });

  it('does not treat lead_source Proposal as a proposal module marker', () => {
    const leads = [
      { id: '1', lead_source: 'Proposal', lead_status: 'proposal_required' },
      { id: '2', pipeline_stage: 'proposal', lead_status: 'proposal_required' },
    ];
    expect(filterLeadsByPipelineStage(leads, 'proposal').map((l) => l.id)).toEqual(['2']);
  });

  it('does not treat plain qualified leads as proposals', () => {
    const leads = [
      { id: '1', pipeline_stage: 'qualified_lead', lead_status: 'qualified_lead' },
      { id: '2', lead_status: 'qualified_lead' },
    ];
    expect(filterLeadsByPipelineStage(leads, 'proposal')).toEqual([]);
  });

  it('excludes qualified-stage records from warm leads when lead_status is still contacted', () => {
    const leads = [
      { id: 'warm', pipeline_stage: 'contacted', lead_status: 'contacted' },
      { id: 'qualified', pipeline_stage: 'qualified_lead', lead_status: 'contacted' },
    ];
    expect(filterLeadsByPipelineStage(leads, PIPELINE_LEAD).map((l) => l.id)).toEqual(['warm']);
    expect(filterLeadsByPipelineStage(leads, PIPELINE_QUALIFIED).map((l) => l.id)).toEqual(['qualified']);
  });
});
