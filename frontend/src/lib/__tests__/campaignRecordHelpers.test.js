import {
  formatCampaignMemberIdentity,
  campaignMemberDisplayName,
  resolveOrCreateCampaignId,
  reassignRecordsToCampaign,
  resolveMissingPreviousCampaignIds,
} from '../campaignRecordHelpers.js';
import * as campaignsApi from '../services/campaigns.js';
import * as contactsApi from '../services/contacts.js';
import * as leadsApi from '../services/leads.js';

jest.mock('../services/campaigns.js', () => ({
  listCampaigns: jest.fn(),
  createCampaign: jest.fn(),
  addCampaignMember: jest.fn(),
  addCampaignMembers: jest.fn(),
  listCampaignMembers: jest.fn(),
  deleteCampaignMember: jest.fn(),
}));

jest.mock('../services/contacts.js', () => ({
  updateContact: jest.fn(),
  listAllContacts: jest.fn(),
  massUpdateContacts: jest.fn(),
}));

jest.mock('../services/leads.js', () => ({
  updateLead: jest.fn(),
  listAllLeads: jest.fn(),
  massUpdateLeads: jest.fn(),
}));

jest.mock('../services/accounts.js', () => ({
  listAllAccounts: jest.fn(),
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

describe('resolveMissingPreviousCampaignIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scans each campaign once instead of per record', async () => {
    campaignsApi.listCampaigns.mockResolvedValue({
      data: [
        { id: 'camp-a', name: 'A' },
        { id: 'camp-b', name: 'B' },
      ],
      total: 2,
    });
    campaignsApi.listCampaignMembers
      .mockResolvedValueOnce({ data: [{ member_type: 'contact', member_id: 'c1' }] })
      .mockResolvedValueOnce({ data: [{ member_type: 'contact', member_id: 'c2' }] });

    const members = [
      { member_type: 'contact', member_id: 'c1', previous_campaign_id: '' },
      { member_type: 'contact', member_id: 'c2', previous_campaign_id: '' },
    ];
    await resolveMissingPreviousCampaignIds(members);

    expect(campaignsApi.listCampaignMembers).toHaveBeenCalledTimes(2);
    expect(members[0].previous_campaign_id).toBe('camp-a');
    expect(members[1].previous_campaign_id).toBe('camp-b');
  });
});

describe('reassignRecordsToCampaign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    campaignsApi.listCampaignMembers.mockResolvedValue({ data: [] });
    campaignsApi.addCampaignMembers.mockResolvedValue({ imported: 1 });
    campaignsApi.deleteCampaignMember.mockResolvedValue();
    contactsApi.updateContact.mockResolvedValue({});
    contactsApi.massUpdateContacts.mockResolvedValue({ success_count: 1 });
    leadsApi.massUpdateLeads.mockResolvedValue({ success_count: 1 });
  });

  it('removes prior membership then adds to the new campaign and mass-updates contact fields', async () => {
    campaignsApi.listCampaignMembers.mockResolvedValue({
      data: [{ id: 'mem-1', member_type: 'contact', member_id: 'c1' }],
    });

    await reassignRecordsToCampaign({
      campaignId: 'camp-new',
      campaignName: 'New Campaign',
      members: [{
        member_type: 'contact',
        member_id: 'c1',
        previous_campaign_id: 'camp-old',
      }],
    });

    expect(campaignsApi.deleteCampaignMember).toHaveBeenCalledWith('camp-old', 'mem-1');
    expect(campaignsApi.addCampaignMembers).toHaveBeenCalledWith('camp-new', [
      { member_type: 'contact', member_id: 'c1' },
    ]);
    expect(contactsApi.massUpdateContacts).toHaveBeenCalledWith(
      ['c1'],
      'campaign_id',
      'camp-new',
    );
    expect(contactsApi.massUpdateContacts).toHaveBeenCalledWith(
      ['c1'],
      'campaign_name',
      'New Campaign',
    );
    expect(contactsApi.updateContact).not.toHaveBeenCalled();
  });

  it('falls back to per-record PATCH when mass-update is unsupported', async () => {
    contactsApi.massUpdateContacts.mockRejectedValue(new Error('unknown field'));
    campaignsApi.listCampaignMembers.mockResolvedValue({ data: [] });

    await reassignRecordsToCampaign({
      campaignId: 'camp-new',
      campaignName: 'New Campaign',
      members: [{
        member_type: 'contact',
        member_id: 'c1',
        previous_campaign_id: '',
      }],
    });

    expect(contactsApi.updateContact).toHaveBeenCalledWith('c1', {
      campaign_id: 'camp-new',
      campaign_name: 'New Campaign',
    });
  });
});
