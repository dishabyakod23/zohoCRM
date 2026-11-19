import {
  mapWithConcurrency, patchImportedCsvExtras, reusableUploadPayload, extrasFailureMessage,
} from '../importHelpers.js';

describe('follow-up PATCHes after an import', () => {
  it('never runs more than the limit at once', async () => {
    let running = 0;
    let peak = 0;
    const results = await mapWithConcurrency(Array.from({ length: 40 }, (_, i) => i), 5, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 1));
      running -= 1;
      if (n === 7) throw new Error('boom');
      return n;
    });
    expect(peak).toBe(5);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(results[3]).toEqual({ status: 'fulfilled', value: 3 });
  });

  const processed = [
    { email: 'a@x.com', skype_id: 'https://linkedin.com/in/a', industry: 'Health' },
    { email: 'b@x.com', skype_id: 'https://linkedin.com/in/b', industry: '' },
    { email: 'c@x.com', skype_id: 'https://linkedin.com/in/c', industry: 'Retail' },
  ];
  const extrasFor = (r) => ({ skype_id: r.skype_id, industry: r.industry });

  it('sends only what the import did not save, and counts failures', async () => {
    const patch = jest.fn(async (id) => { if (id === 'c') throw new Error('no'); });
    const created = [
      { id: 'a', email: 'a@x.com', skype_id: 'https://linkedin.com/in/a' },
      { id: 'b', email: 'b@x.com', skype_id: 'https://linkedin.com/in/b' },
      { id: 'c', email: 'c@x.com', skype_id: '' },
    ];
    const out = await patchImportedCsvExtras({ created, processedRecords: processed, extrasFor, patch, patchWhenMissing: ['industry'] });
    expect(patch.mock.calls).toEqual([
      ['a', { industry: 'Health' }],
      ['c', { skype_id: 'https://linkedin.com/in/c', industry: 'Retail' }],
    ]);
    expect(out).toEqual({ patched: 1, failed: 1 });
    expect(extrasFailureMessage(out.failed, 'contacts')).toMatch(/^1 contacts were imported/);
  });

  it('sends nothing when the import saved everything', async () => {
    const patch = jest.fn();
    const created = [{ id: 'a', email: 'a@x.com', skype_id: 'https://linkedin.com/in/a', industry: 'Health' }];
    const out = await patchImportedCsvExtras({ created, processedRecords: processed, extrasFor, patch });
    expect(patch).not.toHaveBeenCalled();
    expect(out).toEqual({ patched: 0, failed: 0 });
  });
});

describe('reusing the CSV check', () => {
  const payload = { readyRecords: [{ email: 'a@x.com' }] };

  it('reuses a recent check', () => {
    expect(reusableUploadPayload({ upload_payload: payload, checked_at: 1000 }, { now: 2000 })).toBe(payload);
  });

  it('checks again when the old check is stale or missing', () => {
    expect(reusableUploadPayload({ upload_payload: payload, checked_at: 1000 }, { now: 1000 + 6 * 60 * 1000 })).toBeNull();
    expect(reusableUploadPayload(null)).toBeNull();
    expect(reusableUploadPayload({ upload_payload: {}, checked_at: Date.now() })).toBeNull();
  });
});
