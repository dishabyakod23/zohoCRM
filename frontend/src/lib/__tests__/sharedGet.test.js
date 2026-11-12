import { shareInflightGets } from '../sharedGet.js';

function slowGet() {
  return jest.fn((url, config) => new Promise((resolve) => {
    setTimeout(() => resolve({ status: 200, data: { data: [{ id: 1, url, params: config?.params }] } }), 10);
  }));
}

describe('shareInflightGets', () => {
  it('sends one request when the same GET is made twice at once', async () => {
    const get = slowGet();
    const shared = shareInflightGets(get);
    const [a, b] = await Promise.all([
      shared('/contacts/directory', { params: { page: 1, page_size: 25 } }),
      shared('/contacts/directory', { params: { page_size: 25, page: 1 } }),
    ]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(a.data).toEqual(b.data);
  });

  it('gives each caller its own copy of the data', async () => {
    const shared = shareInflightGets(slowGet());
    const [a, b] = await Promise.all([shared('/leads'), shared('/leads')]);
    a.data.data.push('changed by first caller');
    expect(b.data.data).toHaveLength(1);
  });

  it('keeps different URLs or params separate', async () => {
    const get = slowGet();
    const shared = shareInflightGets(get);
    await Promise.all([shared('/leads', { params: { page: 1 } }), shared('/leads', { params: { page: 2 } }), shared('/accounts')]);
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('fetches fresh once the earlier request has finished', async () => {
    const get = slowGet();
    const shared = shareInflightGets(get);
    await shared('/leads');
    await shared('/leads');
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('never shares downloads or requests that can be aborted', async () => {
    const get = slowGet();
    const shared = shareInflightGets(get);
    const signal = new AbortController().signal;
    await Promise.all([shared('/export', { responseType: 'blob' }), shared('/export', { responseType: 'blob' })]);
    await Promise.all([shared('/leads', { signal }), shared('/leads', { signal })]);
    expect(get).toHaveBeenCalledTimes(4);
  });

  it('shares a failure with everyone who was waiting, then allows a retry', async () => {
    const get = jest.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue({ data: 'ok' });
    const shared = shareInflightGets(get);
    const results = await Promise.allSettled([shared('/x'), shared('/x')]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    await expect(shared('/x')).resolves.toEqual({ data: 'ok' });
  });
});
