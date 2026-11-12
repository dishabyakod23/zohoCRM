import * as leadsApi from '../leads.js';
import * as accountsApi from '../accounts.js';
import { proposalOutcomeMove, convertWonProposalToAccount } from '../proposalOutcome.js';

jest.mock('../leads.js', () => ({ convertLead: jest.fn() }));
jest.mock('../accounts.js', () => ({ convertCompanyToAccount: jest.fn(), listAccounts: jest.fn().mockResolvedValue({ data: [] }), deleteAccount: jest.fn() }));
jest.mock('../notes.js', () => ({ migrateRecordNotes: jest.fn().mockResolvedValue({}) }));

describe('proposal deal outcome', () => {
  it('moves only when the status changes to won or lost', () => {
    expect(proposalOutcomeMove('active_proposal', 'deal_won')).toBe('account');
    expect(proposalOutcomeMove('', 'deal_lost')).toBe('cold');
    expect(proposalOutcomeMove('deal_lost', 'deal_lost')).toBeNull();
    expect(proposalOutcomeMove('deal_won', 'active_proposal')).toBeNull();
    expect(proposalOutcomeMove('active_proposal', undefined)).toBeNull();
  });

  it('converts a won proposal to an account without creating a deal', async () => {
    leadsApi.convertLead.mockResolvedValue({ account: { id: 'a9' } });
    await expect(convertWonProposalToAccount('l1')).resolves.toBe('a9');
    expect(leadsApi.convertLead).toHaveBeenCalledWith('l1', expect.objectContaining({ create_deal: false }));
    expect(accountsApi.convertCompanyToAccount).toHaveBeenCalledWith('a9');
  });

  it('merges into an existing account with the same company name', async () => {
    accountsApi.listAccounts.mockResolvedValueOnce({ data: [{ id: 'a1', name: 'Acme' }] });
    leadsApi.convertLead.mockResolvedValue({ account: { id: 'a2' } });
    await expect(convertWonProposalToAccount('l1', 'acme')).resolves.toBe('a1');
    expect(accountsApi.deleteAccount).toHaveBeenCalledWith('a2');
  });
});
