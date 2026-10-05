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
    expect(summary.bde_only_leaderboard[0].role_label).toBe('BDE');
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

  it('includes BDM users in a separate leaderboard alongside BDEs', async () => {
    const summary = await enrichSalesTargetDashboard({
      bde_leaderboard: [],
      monthly_pipeline_actual: '0',
    }, {
      listProposals: async () => ({
        data: [
          { owner_id: 'bde1', deal_size: 100000, currency: 'INR' },
          { owner_id: 'bdm1', deal_size: 250000, currency: 'INR' },
        ],
      }),
      loadUsers: async () => ([
        { id: 'bde1', first_name: 'Rep', last_name: 'One', role: 'sales_rep', email: 'rep@example.com' },
        { id: 'bdm1', first_name: 'Manager', last_name: 'One', role: 'sales_manager', email: 'mgr@example.com' },
        { id: 'viewer1', first_name: 'View', last_name: 'Only', role: 'viewer' },
      ]),
    });

    expect(summary.bde_only_leaderboard).toHaveLength(1);
    expect(summary.bde_only_leaderboard[0].employee_id).toBe('bde1');
    expect(summary.bde_only_leaderboard[0].role_label).toBe('BDE');
    expect(summary.bdm_leaderboard).toHaveLength(1);
    expect(summary.bdm_leaderboard[0].employee_id).toBe('bdm1');
    expect(summary.bdm_leaderboard[0].role_label).toBe('BDM');
    expect(summary.bdm_leaderboard[0].actual_pipeline).toBe('250000');
    expect(summary.pipeline_leaderboard.some((row) => row.employee_id === 'viewer1')).toBe(false);
  });

  it('hides admins and inactive users; only sales_rep (BDE) and sales_manager (BDM)', async () => {
    const summary = await enrichSalesTargetDashboard({
      bde_leaderboard: [
        { employee_id: 'admin1', actual_pipeline: '900000', role: 'super_admin' },
        { employee_id: 'gone1', actual_pipeline: '800000', role: 'sales_rep' },
        { employee_id: 'old1', actual_pipeline: '700000', role: 'sales_rep' },
      ],
      monthly_pipeline_actual: '0',
    }, {
      listProposals: async () => ({
        data: [
          { owner_id: 'bde1', deal_size: 100000, currency: 'INR' },
          { owner_id: 'admin1', deal_size: 500000, currency: 'INR' },
          { owner_id: 'old1', deal_size: 400000, currency: 'INR' },
          { owner_id: 'bdm1', deal_size: 200000, currency: 'INR' },
        ],
      }),
      loadUsers: async () => ([
        { id: 'bde1', first_name: 'Rep', last_name: 'One', role: 'sales_rep', is_active: true },
        { id: 'bdm1', first_name: 'Mgr', last_name: 'One', role: 'sales_manager', is_active: true },
        { id: 'admin1', first_name: 'Super', last_name: 'Admin', role: 'super_admin', is_active: true },
        { id: 'old1', first_name: 'Old', last_name: 'Rep', role: 'sales_rep', is_active: false },
      ]),
    });

    const ids = summary.pipeline_leaderboard.map((row) => row.employee_id);
    expect(ids).toEqual(['bdm1', 'bde1']);
    expect(summary.bde_only_leaderboard.map((r) => r.employee_id)).toEqual(['bde1']);
    expect(summary.bdm_leaderboard.map((r) => r.employee_id)).toEqual(['bdm1']);
    expect(summary.bdm_leaderboard[0].role_label).toBe('BDM');
  });
});
