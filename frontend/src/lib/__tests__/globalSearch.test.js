import api from '../api.js';
import * as campaignsApi from '../services/campaigns.js';
import { runGlobalSearch, matchPagesAndActions, visibleSearchSources } from '../globalSearch.js';

jest.mock('../api.js', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../services/campaigns.js', () => ({ listCampaigns: jest.fn() }));
jest.mock('../services/sequences.js', () => ({ listSequences: jest.fn().mockResolvedValue({ data: [] }) }));
jest.mock('../services/documents.js', () => ({ listDocuments: jest.fn().mockResolvedValue({ data: [] }) }));
jest.mock('../services/meetings.js', () => ({ listMeetings: jest.fn().mockResolvedValue({ data: [] }) }));
jest.mock('../services/tasks.js', () => ({ listTasks: jest.fn().mockResolvedValue({ data: [] }) }));

const ROWS = {
  '/contacts': [
    { id: 'c1', first_name: 'Asha', last_name: 'Rao', email: 'asha@zyarex.com' },
    { id: 'c2', first_name: 'Asha', last_name: 'Menon', email: 'menon@x.com' },
  ],
  '/leads': [{ id: 'l1', first_name: 'Asha', last_name: 'Rao', company: 'Zyarex', pipeline_stage: 'proposal' }],
  '/accounts': [{ id: 'a1', account_name: 'Zyarex Rao Pvt' }],
  '/companies': [{ id: 'co1', name: 'Rao Foods', module: 'company' }, { id: 'co2', name: 'Rao Moved', _crm_module: 'account', module: 'account' }],
  '/deals': [],
};

const allowAll = () => true;

async function collect(query, can = allowAll) {
  const groups = {};
  await runGlobalSearch(query, { can, onGroup: (key, label, results) => { groups[key] = results; } });
  return groups;
}

describe('global search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url) => Promise.resolve({ data: { data: ROWS[url] || [] } }));
    campaignsApi.listCampaigns.mockResolvedValue({ data: [{ id: 'cm1', name: 'Rao Diwali Push' }] });
  });

  it('makes one request per record type and finds matches across modules', async () => {
    const groups = await collect('rao');
    expect(api.get.mock.calls.filter(([url]) => url === '/contacts')).toHaveLength(1);
    expect(groups.contacts.map((r) => r.id)).toEqual(['c1']);
    expect(groups.leads[0]).toMatchObject({ id: 'l1', href: expect.stringContaining('/proposals/') });
    expect(groups.accounts.map((r) => r.name)).toEqual(['Zyarex Rao Pvt']);
    expect(groups.campaigns.map((r) => r.href)).toEqual(['/campaigns/cm1']);
  });

  it('sends the longest word to the API and requires every word to match', async () => {
    const groups = await collect('asha rao');
    const [, { params }] = api.get.mock.calls.find(([url]) => url === '/contacts');
    expect(params.search).toBe('asha');
    expect(groups.contacts.map((r) => r.id)).toEqual(['c1']);
  });

  it('leaves out company rows that were moved to Accounts', async () => {
    const groups = await collect('rao');
    expect(groups.companies.map((r) => r.name)).toEqual(['Rao Foods']);
  });

  it('only searches modules the user can view', async () => {
    const can = (key) => key === 'contacts';
    expect(visibleSearchSources(can).map((s) => s.key)).toEqual(['contacts']);
    await collect('rao', can);
    expect(api.get.mock.calls.map(([url]) => url)).toEqual(['/contacts']);
    expect(campaignsApi.listCampaigns).not.toHaveBeenCalled();
  });

  it('keeps going when one module fails', async () => {
    api.get.mockImplementation((url) => (url === '/leads'
      ? Promise.reject(new Error('down'))
      : Promise.resolve({ data: { data: ROWS[url] || [] } })));
    const groups = await collect('rao');
    expect(groups.leads).toEqual([]);
    expect(groups.contacts).toHaveLength(1);
  });

  it('matches pages and quick actions without any request', () => {
    expect(matchPagesAndActions('repo', allowAll).map((r) => r.name)).toEqual(['Reports']);
    expect(matchPagesAndActions('create contact', allowAll).map((r) => r.href)).toEqual(['/contacts/create']);
    expect(matchPagesAndActions('reports', () => false)).toEqual([]);
  });
});
