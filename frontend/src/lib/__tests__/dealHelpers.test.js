import { dealStageLabel, dealStageCode, normalizeDeal } from '../dealHelpers.js';

describe('dealStageLabel', () => {
  it('does not throw when the API sends a stage object', () => {
    expect(dealStageCode({ value: 'qualification', label: 'Qualification' })).toBe('qualification');
    expect(dealStageLabel({ value: 'qualification', label: 'Qualification' })).toBe('Qualification');
    expect(dealStageLabel({ label: 'Closed Won' })).toBe('Closed Won');
  });

  it('normalizes deal rows so stage is always a string', () => {
    const deal = normalizeDeal({
      id: 'd1',
      deal_name: 'Test',
      stage: { value: 'negotiation_review', label: 'Negotiation / Review' },
      amount: { value: 1000 },
    });
    expect(typeof deal.stage).toBe('string');
    expect(deal.stage_value).toBe('negotiation_review');
  });
});
