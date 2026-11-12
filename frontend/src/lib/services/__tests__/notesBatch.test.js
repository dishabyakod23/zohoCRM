import api from '../../api.js';
import { listNotesBatched } from '../notes.js';

jest.mock('../../api.js', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

describe('listNotesBatched', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url, { params }) => {
      if (url !== '/notes/batch') return Promise.resolve({ data: { data: [] } });
      const ids = params.entity_ids.split(',');
      // One note for every id, plus a second note for the first id of the chunk.
      const notes = ids.map((id) => ({ id: `n-${id}`, entity_id: id, body: `note ${id}` }));
      notes.push({ id: `n2-${ids[0]}`, entity_id: ids[0], body: 'second' });
      return Promise.resolve({ data: { data: notes } });
    });
  });

  it('combines rows asked for together into /notes/batch requests of up to 200 ids', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id${i}`);
    const results = await Promise.all(ids.map((id) => listNotesBatched('lead', id)));

    const batchCalls = api.get.mock.calls.filter(([url]) => url === '/notes/batch');
    expect(batchCalls).toHaveLength(2);
    expect(batchCalls.map(([, { params }]) => params.entity_ids.split(',').length)).toEqual([200, 50]);
    expect(batchCalls[0][1].params.entity_type).toBe('lead');

    expect(results[0].map((n) => n.id)).toEqual(['n-id0', 'n2-id0']);
    expect(results[1].map((n) => n.body)).toEqual(['note id1']);
  });

  it('keeps entity types in separate requests and asks once per repeated id', async () => {
    await Promise.all([
      listNotesBatched('lead', 'a'),
      listNotesBatched('lead', 'a'),
      listNotesBatched('contact', 'b'),
    ]);
    const batchCalls = api.get.mock.calls.filter(([url]) => url === '/notes/batch').map(([, { params }]) => params);
    expect(batchCalls).toEqual([
      { entity_type: 'lead', entity_ids: 'a' },
      { entity_type: 'contact', entity_ids: 'b' },
    ]);
  });

  it('falls back to the single-record call for types the batch endpoint does not cover', async () => {
    await listNotesBatched('deal', 'd1');
    expect(api.get).toHaveBeenCalledWith('/notes', expect.anything());
  });

  it('rejects every row in a chunk when its request fails', async () => {
    api.get.mockRejectedValue(new Error('boom'));
    await expect(listNotesBatched('account', 'x')).rejects.toThrow('boom');
  });
});
