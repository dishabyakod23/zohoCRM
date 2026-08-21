import { formatCampaignMemberIdentity, campaignMemberDisplayName } from '../campaignRecordHelpers.js';

describe('campaignMember identity helpers', () => {
  it('formats first name, last name, and email', () => {
    expect(formatCampaignMemberIdentity({
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
    })).toEqual({
      first_name: 'Ada',
      last_name: 'Lovelace',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    });
  });

  it('falls back to member_name and member_email', () => {
    expect(formatCampaignMemberIdentity({
      member_name: 'Grace Hopper',
      member_email: 'grace@example.com',
    })).toEqual({
      first_name: 'Grace',
      last_name: 'Hopper',
      name: 'Grace Hopper',
      email: 'grace@example.com',
    });
  });

  it('prefers email when name is missing', () => {
    expect(campaignMemberDisplayName({ email: 'solo@example.com' })).toBe('solo@example.com');
  });
});
