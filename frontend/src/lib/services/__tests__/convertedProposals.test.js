import api from '../../api.js';
import { listConvertedProposals } from '../leads.js';

jest.mock('../../api.js', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));

describe('listConvertedProposals', () => {
  it('asks only for converted leads and keeps the proposals', async () => {
    api.get.mockResolvedValue({
      data: {
        data: [
          { id: 'p1', company: 'ACE', pipeline_stage: 'proposal', is_converted: true },
          { id: 'r1', company: 'Acme', pipeline_stage: 'raw_prospect', is_converted: true },
        ],
        meta: { total: 2 },
      },
    });
    const rows = await listConvertedProposals();
    expect(rows.map((r) => r.id)).toEqual(['p1']);
    const [, { params }] = api.get.mock.calls[0];
    expect(params.is_converted).toBe(true);
    expect(params.pipeline_stage).toBeUndefined();
  });
});
