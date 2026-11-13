import * as leadsApi from './leads.js';
import * as accountsApi from './accounts.js';
import * as notesApi from './notes.js';
import { DEAL_STATUS_WON, DEAL_STATUS_LOST } from '../pipelineHelpers.js';

/**
 * Where a proposal goes when its Deal Status is changed: 'account' for Deal Won (it becomes an
 * Account), 'lost' for Deal Lost (it stays a proposal and shows in the Lost Proposals tab).
 * Only a change counts, so re-saving an unchanged status does nothing.
 */
export function proposalOutcomeMove(previousStatus, nextStatus) {
  if (!nextStatus || nextStatus === previousStatus) return null;
  if (nextStatus === DEAL_STATUS_WON) return 'account';
  if (nextStatus === DEAL_STATUS_LOST) return 'lost';
  return null;
}

/** Notification shown after proposals move because of their Deal Status ('account' or 'lost'). */
export function proposalMovedMessage(move, count = 1) {
  const where = move === 'account' ? 'Accounts' : 'Lost Proposals';
  return count > 1
    ? `${count} proposals have been moved to ${where}`
    : `The proposal has been moved to ${where}`;
}

const norm = (v) => String(v || '').trim().toLowerCase();

async function findExistingAccountId(company) {
  const name = norm(company);
  if (!name) return null;
  try {
    const { data = [] } = await accountsApi.listAccounts({ search: company, page_size: 50 });
    const match = data.find((a) => norm(a.name || a.account_name || a.company) === name);
    return match?.id || null;
  } catch {
    return null;
  }
}

/**
 * A won proposal becomes an Account (no deal created). If an account with the same company name already
 * exists, the proposal is merged into it (its notes move there and the duplicate is removed) instead.
 * Returns the account id when the API gives one.
 */
export async function convertWonProposalToAccount(id, company) {
  const existingId = await findExistingAccountId(company);
  const result = await leadsApi.convertLead(id, {
    create_deal: false, deal_name: '', close_date: '', stage_value: 'qualification', amount: '',
  });
  const newId = result?.account?.id || result?.account_id || null;
  if (existingId && newId && newId !== existingId) {
    await notesApi.migrateRecordNotes('account', newId, 'account', existingId).catch(() => ({ migrated: 0 }));
    await accountsApi.deleteAccount(newId);
    return existingId;
  }
  if (newId) await accountsApi.convertCompanyToAccount(newId);
  return newId;
}
