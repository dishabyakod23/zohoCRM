import api from '../../api.js';
import { moveLostProposalToColdLeads } from '../leads.js';
import * as admin from '../admin.js';

jest.mock('../../api.js', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../admin.js', () => ({
  ensureDndLeadStatusRegistered: jest.fn(),
  ensureDealLostLeadStatusRegistered: jest.fn(),
}));

describe('moveLostProposalToColdLeads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.post.mockResolvedValue({ data: { data: { success_count: 1, failed_count: 0 } } });
    api.get.mockResolvedValue({ data: { data: { id: 'p1', pipeline_stage: 'raw_prospect', lead_status: 'deal_lost' } } });
  });

  it('moves the proposal to Cold Leads, then sets the Deal Lost status', async () => {
    admin.ensureDealLostLeadStatusRegistered.mockResolvedValue('deal_lost');
    const lead = await moveLostProposalToColdLeads('p1');

    const calls = api.post.mock.calls.filter(([url]) => url === '/leads/mass-update').map(([, body]) => body);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ ids: ['p1'], field: 'pipeline_convert_target' });
    expect(calls[1]).toMatchObject({ ids: ['p1'], field: 'lead_status', value: 'deal_lost' });
    expect(lead.lead_status).toBe('deal_lost');
  });

  it('reports when the move worked but the status did not save', async () => {
    admin.ensureDealLostLeadStatusRegistered.mockResolvedValue(null);
    api.post
      .mockResolvedValueOnce({ data: { data: { success_count: 1, failed_count: 0 } } })
      .mockResolvedValueOnce({ data: { data: { success_count: 0, failed_count: 1, errors: ['invalid lead_status'] } } });
    await expect(moveLostProposalToColdLeads('p1')).rejects.toThrow('Deal Lost status was not saved');
  });
});
