import { pipelineFromDashboardHome } from '../dashboard.js';

jest.mock('../../api.js', () => ({ __esModule: true, default: { get: jest.fn() } }));

describe('pipelineFromDashboardHome', () => {
  // Shape of the production /dashboard/home response (Nov 2026).
  const home = {
    leads_this_month: 15,
    qualified_count: 0,
    proposals: { count: 9, deal_size_inr: '18347245.00' },
    pipeline_counts: [
      { stage: 'raw_prospect', label: 'Cold Lead', count: 783 },
      { stage: 'contacted', label: 'Warm Lead', count: 39 },
      { stage: 'qualified_lead', label: 'Qualified Lead', count: 0 },
      { stage: 'proposal', label: 'Proposal', count: 9 },
    ],
  };

  it('gives the same numbers the dashboard used to count from every lead', () => {
    expect(pipelineFromDashboardHome(home)).toEqual({
      leadsByPipeline: [
        { status: 'Cold Lead', count: 783, permissionKey: 'raw_leads' },
        { status: 'Warm Lead', count: 39, permissionKey: 'leads' },
        { status: 'Proposal', count: 9, permissionKey: 'proposals' },
      ],
      totalLeads: 831,
      qualifiedCount: 0,
      leadsThisMonth: 15,
      proposals: { total: 9, dealSize: 18347245 },
    });
  });

  it('returns null when the response has no pipeline counts, so the dashboard falls back', () => {
    expect(pipelineFromDashboardHome({ top_accounts: [] })).toBeNull();
  });
});
