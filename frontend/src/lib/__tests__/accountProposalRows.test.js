import { buildAccountProposalRows, groupAccountProposalRows, proposalsForAccount } from '../accountProposalRows.js';

const accounts = [
  { id: 'a1', name: 'ACE Gallagher' },
  { id: 'a2', name: 'info data' },
  { id: 'a3', name: 'Info Data ' },
  { id: 'a4', name: 'newone' },
];
const proposals = [
  { id: 'p2', company: 'ace gallagher', proposal_date: '2026-11-05', deal_size: 20 },
  { id: 'p1', company: 'ACE Gallagher', proposal_date: '2026-11-04', deal_size: 10 },
  { id: 'p3', company: 'info data', proposal_date: '2026-10-23' },
  { id: 'p9', company: 'Someone Else' },
];

describe('accounts shown with their proposals', () => {
  const rows = buildAccountProposalRows(accounts, proposals);

  it('lists each proposal under its account, oldest first, keeping the account id', () => {
    const ace = rows.filter((r) => r.id === 'a1');
    expect(ace.map((r) => [r._proposal.id, r._proposalNumber])).toEqual([['p1', 1], ['p2', 2]]);
    expect(new Set(rows.map((r) => r._rowKey)).size).toBe(rows.length);
  });

  it('gives an account without proposals one empty row', () => {
    const row = rows.filter((r) => r.id === 'a4');
    expect(row).toHaveLength(1);
    expect(row[0]._proposal).toBeNull();
  });

  it('puts accounts with the same company name under one header without repeating proposals', () => {
    const groups = groupAccountProposalRows(rows);
    expect(groups.map((g) => g.key)).toEqual(['ace gallagher', 'info data', 'newone']);
    const info = groups.find((g) => g.key === 'info data');
    expect(info.records.map((r) => r.id)).toEqual(['a2', 'a3']);
    expect(info.proposals.map((p) => p.id)).toEqual(['p3']);
  });

  it('finds the proposals of one account for its detail page', () => {
    expect(proposalsForAccount({ id: 'a1', name: 'ACE Gallagher' }, proposals).map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(proposalsForAccount({ id: 'a4', name: 'newone' }, proposals)).toEqual([]);
  });
});
