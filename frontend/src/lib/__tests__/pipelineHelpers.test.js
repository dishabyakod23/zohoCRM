import {
  PIPELINE_RAW,
  filterLeadsByPipelineStage,
  resolveLeadPipelineStage,
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
