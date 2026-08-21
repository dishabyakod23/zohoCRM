import {
  chunkArray,
  mergeBulkImportResults,
  postBulkImportInChunks,
  BULK_IMPORT_CHUNK_SIZE,
  BULK_IMPORT_TIMEOUT_MS,
} from '../importHelpers.js';

describe('bulk import chunking', () => {
  it('splits records into chunks of 200 by default', () => {
    const records = Array.from({ length: 1187 }, (_, i) => ({ id: i + 1 }));
    const chunks = chunkArray(records, BULK_IMPORT_CHUNK_SIZE);
    expect(chunks).toHaveLength(6);
    expect(chunks[0]).toHaveLength(200);
    expect(chunks[5]).toHaveLength(187);
  });

  it('merges imported/skipped counts and concatenates records', () => {
    const merged = mergeBulkImportResults([
      { imported: 200, skipped: 1, records: [{ id: 'a' }], skip_messages: ['dup'] },
      { imported: 187, skipped: 0, records: [{ id: 'b' }, { id: 'c' }] },
    ]);
    expect(merged.imported).toBe(387);
    expect(merged.skipped).toBe(1);
    expect(merged.records.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(merged.skip_messages).toEqual(['dup']);
  });

  it('posts each chunk with campaign_id and extended timeout', async () => {
    const posts = [];
    const apiClient = {
      post: jest.fn(async (url, body, config) => {
        posts.push({ url, body, config });
        return { data: { data: { imported: body.records.length, records: body.records } } };
      }),
    };

    const records = Array.from({ length: 450 }, (_, i) => ({ email: `u${i}@ex.com` }));
    const result = await postBulkImportInChunks(apiClient, '/contacts/bulk-import', {
      records,
      campaign_id: 'camp-1',
    });

    expect(apiClient.post).toHaveBeenCalledTimes(3);
    expect(posts.every((p) => p.config?.timeout === BULK_IMPORT_TIMEOUT_MS)).toBe(true);
    expect(posts.every((p) => p.body.campaign_id === 'camp-1')).toBe(true);
    expect(posts.map((p) => p.body.records.length)).toEqual([200, 200, 50]);
    expect(result.imported).toBe(450);
  });
});
