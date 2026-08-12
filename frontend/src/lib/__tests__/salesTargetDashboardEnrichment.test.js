import { enrichSalesTargetDashboard, buildProposalPipelineInrByOwner } from '../salesTargetDashboardEnrichment.js';
import { resetFxRateCache } from '../fxRates.js';

describe('buildProposalPipelineInrByOwner', () => {
  beforeEach(() => {
    resetFxRateCache();
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  });
  it('sums proposal amounts in INR per owner with FX conversion', async () => {
    const totals = await buildProposalPipelineInrByOwner([
      { owner_id: 'u1', deal_size: 28400, currency: 'USD' },
      { owner_id: 'u1', deal_size: 100000, currency: 'INR' },
      { owner_id: 'u2', deal_size: 50000, currency: 'INR' },
    ]);

    expect(totals.get('u1')).toBeGreaterThan(2800000);
    expect(totals.get('u2')).toBe(50000);
  });
});

describe('enrichSalesTargetDashboard', () => {
  beforeEach(() => {
    resetFxRateCache();
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  });

  it('replaces zero API pipeline with CRM proposal totals for BDEs', async () => {
    const summary = await enrichSalesTargetDashboard({
      monthly_pipeline_actual: '0',
      bde_leaderboard: [
        { employee_id: 'u1', employee_name: 'Manjula BusiReddy', actual_pipeline: '0' },
      ],
    }, {
      listProposals: async () => ({
        data: [{ owner_id: 'u1', deal_size: 28400, currency: 'USD' }],
      }),
      loadUsers: async () => ([
        { id: 'u1', first_name: 'Manjula', last_name: 'BusiReddy', role: 'sales_rep' },
      ]),
    });

    expect(Number(summary.bde_leaderboard[0].actual_pipeline)).toBeGreaterThan(2700000);
    expect(Number(summary.monthly_pipeline_actual)).toBeGreaterThan(2700000);
  });

  it('keeps API value when it is already higher than CRM', async () => {
    const summary = await enrichSalesTargetDashboard({
      bde_leaderboard: [{ employee_id: 'u1', employee_name: 'Ada', actual_pipeline: '5000000' }],
    }, {
      listProposals: async () => ({ data: [{ owner_id: 'u1', deal_size: 1000, currency: 'INR' }] }),
      loadUsers: async () => ([{ id: 'u1', first_name: 'Ada', last_name: 'Lovelace', role: 'sales_rep' }]),
    });

    expect(summary.bde_leaderboard[0].actual_pipeline).toBe('5000000');
  });
});
