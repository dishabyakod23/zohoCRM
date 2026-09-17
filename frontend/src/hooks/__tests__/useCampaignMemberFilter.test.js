import { campaignMemberTypeKey } from '../useCampaignMemberFilter.js';

describe('campaignMemberTypeKey', () => {
  it('is stable for inline arrays with the same contents', () => {
    expect(campaignMemberTypeKey(['contact', 'lead'])).toBe(campaignMemberTypeKey(['lead', 'contact']));
    expect(campaignMemberTypeKey(['contact', 'lead'])).toBe('contact,lead');
  });

  it('handles string and empty values', () => {
    expect(campaignMemberTypeKey('lead')).toBe('lead');
    expect(campaignMemberTypeKey(null)).toBe('');
    expect(campaignMemberTypeKey(undefined)).toBe('');
  });
});
