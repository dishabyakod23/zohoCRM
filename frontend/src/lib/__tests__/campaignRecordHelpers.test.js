import {
  formatCampaignMemberIdentity,
  campaignMemberDisplayName,
  resolveOrCreateCampaignId,
} from '../campaignRecordHelpers.js';
import * as campaignsApi from '../services/campaigns.js';

jest.mock('../services/campaigns.js', () => ({
  listCampaigns: jest.fn(),
  createCampaign: jest.fn(),
  addCampaignMember: jest.fn(),
  addCampaignMembers: jest.fn(),
  listCampaignMembers: jest.fn(),
}));

describe('resolveOrCreateCampaignId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not list campaigns when no campaign is selected', async () => {
    await expect(resolveOrCreateCampaignId({
      campaign_id: '',
      campaign_name: '',
    })).resolves.toBe('');
    expect(campaignsApi.listCampaigns).not.toHaveBeenCalled();
  });
});

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
