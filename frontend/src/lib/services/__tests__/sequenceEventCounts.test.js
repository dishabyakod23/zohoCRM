import api from '../../api.js';
import {
  getSequenceEmailEventCounts,
  getEmailEventCountMap,
  openRateFromEventCounts,
} from '../sequences.js';

jest.mock('../../api.js', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

describe('sequence email-event counts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url, { params }) => {
      const ids = params.sequence_ids.split(',');
      return Promise.resolve({
        data: { data: Object.fromEntries(ids.map((id) => [id, { SENT: 10, OPENED: 4 }])) },
      });
    });
  });

  it('asks for up to 100 sequences per request and merges the results', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `s${i}`);
    const counts = await getSequenceEmailEventCounts(ids);
    const calls = api.get.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls.every(([url]) => url === '/sequences/email-event-counts')).toBe(true);
    expect(calls.map(([, { params }]) => params.sequence_ids.split(',').length)).toEqual([100, 50]);
    expect(Object.keys(counts)).toHaveLength(150);
  });

  it('works out the open rate from SENT and OPENED', () => {
    expect(openRateFromEventCounts({ SENT: 10, OPENED: 4 })).toBe('40%');
    expect(openRateFromEventCounts(undefined)).toBeNull();
  });

  it('maps one sequence into the Analytics card shape, with missing types as 0', async () => {
    const map = await getEmailEventCountMap('s1');
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(map).toMatchObject({ sent: 10, opened: 4, clicked: 0, bounced: 0 });
  });

  it('reports unknown counts as null when the request fails', async () => {
    api.get.mockRejectedValue(new Error('down'));
    const map = await getEmailEventCountMap('s1');
    expect(map.sent).toBeNull();
    expect(map.opened).toBeNull();
  });
});
