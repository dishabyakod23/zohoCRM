/**
 * Revised proposals. Every version is its own proposal record; a revision points at the original
 * with `revision_of` and carries `proposal_version` (1 = original, 2, 3…).
 * The Proposals table shows only the latest version of each proposal; older ones are its history.
 */
export const proposalRootId = (proposal) => String(proposal?.revision_of || proposal?.id || '');

const versionOf = (proposal) => Number(proposal?.proposal_version) || 1;
const createdTime = (proposal) => new Date(proposal?.created_at || 0).getTime() || 0;

/** Versions of each proposal keyed by the original's id, oldest version first. */
export function groupProposalVersions(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const root = proposalRootId(row);
    if (!root) continue;
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(row);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => versionOf(a) - versionOf(b) || createdTime(a) - createdTime(b));
  }
  return groups;
}

/**
 * Only the latest version of each proposal, in the order the rows came in.
 * `excludeRoots` drops whole proposals, e.g. ones whose latest version already became an account
 * (that version is no longer in the list, so an older one must not take its place).
 */
export function latestProposalVersions(rows = [], { excludeRoots } = {}) {
  const groups = groupProposalVersions(rows);
  return rows.filter((row) => {
    const root = proposalRootId(row);
    if (excludeRoots?.has?.(root)) return false;
    const versions = groups.get(root) || [row];
    return versions[versions.length - 1] === row;
  });
}

/** Version number to show for `proposal` among its `versions` (falls back to its position). */
export function proposalVersionNumber(proposal, versions = []) {
  const stored = Number(proposal?.proposal_version);
  if (stored > 0) return stored;
  const index = versions.findIndex((v) => String(v.id) === String(proposal?.id));
  return index >= 0 ? index + 1 : 1;
}

/** Version number for the next revision of a proposal that has `versions`. */
export function nextProposalVersion(versions = []) {
  const highest = versions.reduce((max, v) => Math.max(max, versionOf(v)), 0);
  return Math.max(highest, versions.length) + 1;
}

/** Create-form link that adds a revised version of `proposalId`. */
export function reviseProposalHref(proposalId) {
  return `/proposals/create/?from=${encodeURIComponent(proposalId)}&revise=1`;
}
