import { filterLeadsByPipelineStage, hasStaleProposalFields, PIPELINE_LEAD } from '../pipelineHelpers.js';

// A proposal that was marked lost and moved back to Warm Leads keeps its old proposal fields.
const movedBack = {
  id: 'l1', first_name: 'Amit', email: 'amit@example.com',
  pipeline_stage: 'lead', lead_status: 'contacted',
  proposal_date: '2026-10-15', deal_status: 'deal_lost', proposal_type: 'fixed_cost',
};

describe('leads that still carry proposal fields', () => {
  it('shows a lead in the stage its pipeline_stage says, whatever proposal fields remain', () => {
    expect(hasStaleProposalFields(movedBack)).toBe(false);
    expect(filterLeadsByPipelineStage([movedBack], PIPELINE_LEAD).map((l) => l.id)).toEqual(['l1']);
  });

  it('still hides a leftover row that has proposal fields and no stage', () => {
    const leftover = { id: 'l2', lead_status: 'contacted', proposal_date: '2026-10-15', deal_status: 'active_proposal' };
    expect(hasStaleProposalFields(leftover)).toBe(true);
    expect(filterLeadsByPipelineStage([leftover], PIPELINE_LEAD)).toEqual([]);
  });

  it('never treats a proposal as stale', () => {
    expect(hasStaleProposalFields({ id: 'p1', pipeline_stage: 'proposal', proposal_date: '2026-10-15' })).toBe(false);
  });
});
