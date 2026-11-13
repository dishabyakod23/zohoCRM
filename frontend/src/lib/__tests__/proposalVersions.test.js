import {
  groupProposalVersions, latestProposalVersions, nextProposalVersion, proposalRootId, proposalVersionNumber,
  reviseProposalHref,
} from '../proposalVersions.js';
import { applyLeadRecordFilters } from '../listRecordFilters.js';
import { toLeadPayload } from '../leadHelpers.js';

const rows = [
  { id: 'a3', revision_of: 'a1', proposal_version: 3, deal_size: 300, deal_status: 'active_proposal' },
  { id: 'a1', proposal_version: 1, deal_size: 100, deal_status: 'active_proposal' },
  { id: 'b1', deal_size: 50, deal_status: 'active_proposal' },
  { id: 'a2', revision_of: 'a1', proposal_version: 2, deal_size: 200, deal_status: 'deal_lost' },
  { id: 'c2', revision_of: 'c1', proposal_version: 2, deal_size: 70, deal_status: 'deal_lost' },
  { id: 'c1', deal_size: 60, deal_status: 'active_proposal' },
];

describe('revised proposals', () => {
  it('groups versions under the original, oldest first', () => {
    const groups = groupProposalVersions(rows);
    expect(groups.get('a1').map((r) => r.id)).toEqual(['a1', 'a2', 'a3']);
    expect(proposalRootId(rows[0])).toBe('a1');
    expect(proposalVersionNumber(rows[3], groups.get('a1'))).toBe(2);
    expect(proposalVersionNumber({ id: 'b1' }, groups.get('b1'))).toBe(1);
  });

  it('keeps only the latest version of each proposal', () => {
    expect(latestProposalVersions(rows).map((r) => r.id)).toEqual(['a3', 'b1', 'c2']);
  });

  it('drops a proposal whose latest version already became an account', () => {
    expect(latestProposalVersions(rows, { excludeRoots: new Set(['a1']) }).map((r) => r.id)).toEqual(['b1', 'c2']);
  });

  it('numbers the next revision after the highest version', () => {
    expect(nextProposalVersion(groupProposalVersions(rows).get('a1'))).toBe(4);
    expect(nextProposalVersion([{ id: 'b1' }])).toBe(2);
  });

  it('judges the tab by the latest version: a lost revision moves the whole proposal to Lost', () => {
    const open = applyLeadRecordFilters(rows, { latest_version_only: true, exclude_deal_status: 'deal_lost' });
    expect(open.map((r) => r.id)).toEqual(['a3', 'b1']);
    const lost = applyLeadRecordFilters(rows, { latest_version_only: true, deal_status: 'deal_lost' });
    expect(lost.map((r) => r.id)).toEqual(['c2']);
  });

  it('sends the version fields only for a revised proposal', () => {
    const revised = toLeadPayload({ first_name: 'A', revision_of: 'a1', proposal_version: 4 });
    expect(revised).toMatchObject({ revision_of: 'a1', proposal_version: 4 });
    const ordinary = toLeadPayload({ first_name: 'A' });
    expect(ordinary).not.toHaveProperty('revision_of');
    expect(ordinary).not.toHaveProperty('proposal_version');
  });

  it('links to the create form in revise mode', () => {
    expect(reviseProposalHref('a1')).toBe('/proposals/create/?from=a1&revise=1');
  });
});
