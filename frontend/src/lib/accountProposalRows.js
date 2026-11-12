/**
 * Accounts list shown like the Proposals table: one header per company, and under it the
 * proposals that were converted into that account (Proposal 1, 2, 3…).
 * A converted proposal stays a lead record (is_converted, pipeline_stage=proposal) with no account
 * id on it, so proposals are matched to accounts by company name.
 */
const companyKey = (value) => String(value || '').trim().toLowerCase();

const createdTime = (r) => new Date(r?.proposal_date || r?.created_at || 0).getTime() || 0;

/** Converted proposals grouped by company name, oldest first. */
export function proposalsByCompany(proposals = []) {
  const map = new Map();
  for (const proposal of proposals) {
    const key = companyKey(proposal?.company);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(proposal);
  }
  for (const list of map.values()) list.sort((a, b) => createdTime(a) - createdTime(b));
  return map;
}

/**
 * Table rows for the accounts on this page. Each row is an account (same id, so selection, notes
 * and mass update still act on the account) carrying one of its proposals in `_proposal`.
 * An account without proposals gets a single row. Accounts sharing a company name share one
 * group, and that company's proposals are spread across them so none is listed twice.
 */
export function buildAccountProposalRows(accounts = [], proposals = []) {
  const byCompany = proposalsByCompany(proposals);
  const groups = new Map();
  for (const account of accounts) {
    const key = companyKey(account?.name) || `id:${account?.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(account);
  }
  const rows = [];
  for (const [key, groupAccounts] of groups) {
    const list = byCompany.get(key) || [];
    const count = Math.max(groupAccounts.length, list.length);
    for (let i = 0; i < count; i += 1) {
      const account = groupAccounts[Math.min(i, groupAccounts.length - 1)];
      rows.push({
        ...account,
        _groupKey: key,
        _rowKey: `${account.id}:${list[i]?.id || `none-${i}`}`,
        _proposal: list[i] || null,
        _proposalNumber: list[i] ? i + 1 : null,
      });
    }
  }
  return rows;
}

/** Groups for RecordDataTable's groupRows: `{ key, account, records, proposals }` per company. */
export function groupAccountProposalRows(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = row._groupKey || `id:${row.id}`;
    if (!groups.has(key)) groups.set(key, { key, account: row, records: [] });
    groups.get(key).records.push(row);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    proposals: g.records.map((r) => r._proposal).filter(Boolean),
  }));
}
