import { mergePreviewActuals } from '../salesTargetActuals.js';

describe('mergePreviewActuals', () => {
  it('prefers API pipeline and revenue values when present', () => {
    const merged = mergePreviewActuals(
      { actual_pipeline: '50000', actual_revenue: '10000', qualified_meetings: 2 },
      { pipeline_value: 1, deals_closed_amount: 1, new_leads: 99 },
    );
    expect(merged.pipeline_value).toBe('50000');
    expect(merged.deals_closed_amount).toBe('10000');
    expect(merged.new_leads).toBe(99);
  });

  it('keeps API zero values instead of replacing them with CRM fallbacks', () => {
    const merged = mergePreviewActuals(
      { actual_pipeline: '0', qualified_meetings: 0 },
      { pipeline_value: 5000, qualified_meetings: 4 },
    );
    expect(merged.pipeline_value).toBe('0');
    expect(merged.qualified_meetings).toBe(0);
  });

  it('fills outreach KPIs from CRM summary when API omits them', () => {
    const merged = mergePreviewActuals(
      { actual_pipeline: '0', actual_revenue: '0' },
      { new_leads: 12, cold_calls: 5, linkedin_outreach: 3 },
    );
    expect(merged.new_leads).toBe(12);
    expect(merged.cold_calls).toBe(5);
    expect(merged.linkedin_outreach).toBe(3);
  });

  it('maps deals won and proposal value from API actuals', () => {
    const merged = mergePreviewActuals(
      { deals_won: 3, proposals_value: '15000' },
      { deals_won: 1, proposals_value: 1000 },
    );
    expect(merged.deals_won).toBe(3);
    expect(merged.proposals_value).toBe('15000');
  });
});
