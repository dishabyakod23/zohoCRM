import api from '../../api.js';
import { migrateRecordNotes } from '../notes.js';

jest.mock('../../api.js', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('migrateRecordNotes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('copies notes from contact to lead and skips duplicates', async () => {
    api.get
      .mockResolvedValueOnce({
        data: {
          data: [
            { id: 'n1', body: 'First note' },
            { id: 'n2', body: 'Already there' },
            { id: 'n3', body: '  ' },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ id: 'n9', body: 'Already there' }],
        },
      });
    api.post.mockResolvedValue({ data: { data: { id: 'n-new', body: 'First note' } } });

    const result = await migrateRecordNotes('contact', 'c1', 'lead', 'l1');

    expect(api.get).toHaveBeenCalledWith('/notes', {
      params: expect.objectContaining({ entity_type: 'contact', entity_id: 'c1' }),
    });
    expect(api.get).toHaveBeenCalledWith('/notes', {
      params: expect.objectContaining({ entity_type: 'lead', entity_id: 'l1' }),
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith(
      '/notes',
      expect.objectContaining({
        entity_type: 'lead',
        entity_id: 'l1',
        body: 'First note',
      }),
    );
    expect(result.migrated).toBe(1);
  });

  it('no-ops when source and target are the same record', async () => {
    const result = await migrateRecordNotes('lead', 'l1', 'lead', 'l1');
    expect(result.migrated).toBe(0);
    expect(api.get).not.toHaveBeenCalled();
  });
});
