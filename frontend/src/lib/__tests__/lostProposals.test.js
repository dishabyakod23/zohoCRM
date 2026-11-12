import { NAV_MODULES } from '../constants.js';
import { applyLeadRecordFilters, hasLeadClientFilters } from '../listRecordFilters.js';
import { LOST_PROPOSALS_PATH } from '../pipelineHelpers.js';

const rows = [
  { id: 'p1', deal_status: 'active_proposal' },
  { id: 'p2', deal_status: 'deal_lost' },
  { id: 'p3', deal_status: null },
];

describe('lost proposals tab', () => {
  it('is the last item in the sidebar and uses the Proposals permission', () => {
    const last = NAV_MODULES[NAV_MODULES.length - 1];
    expect(last).toMatchObject({ href: LOST_PROPOSALS_PATH, label: 'Lost Proposals', permissionKey: 'proposals' });
  });

  it('shows only lost proposals in the tab and hides them from Proposals', () => {
    expect(applyLeadRecordFilters(rows, { deal_status: 'deal_lost' }).map((r) => r.id)).toEqual(['p2']);
    expect(applyLeadRecordFilters(rows, { exclude_deal_status: 'deal_lost' }).map((r) => r.id)).toEqual(['p1', 'p3']);
    expect(hasLeadClientFilters({ exclude_deal_status: 'deal_lost' })).toBe(true);
  });
});
