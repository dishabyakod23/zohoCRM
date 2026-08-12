import { convertToInr, FALLBACK_RATES_TO_INR, fetchRatesToInr, resetFxRateCache, sumAmountsInInr } from '../fxRates.js';

describe('convertToInr', () => {
  it('leaves INR amounts unchanged', () => {
    expect(convertToInr(1500000, 'INR')).toBe(1500000);
  });

  it('converts USD to INR using the given rate', () => {
    expect(convertToInr(28400, 'USD', { USD: 83.5, INR: 1 })).toBe(28400 * 83.5);
  });

  it('does not add USD as if it were rupees', () => {
    expect(convertToInr(28400, 'USD', { USD: 83.5, INR: 1 })).not.toBe(28400);
  });
});

describe('sumAmountsInInr', () => {
  beforeEach(() => resetFxRateCache());

  it('converts mixed proposal currencies before totaling', async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error('offline'));
    const originalFetch = global.fetch;
    global.fetch = fetcher;

    const total = await sumAmountsInInr([
      { deal_size: 28400, currency: 'USD' },
      { deal_size: 1500000, currency: 'INR' },
      { deal_size: 1200000, currency: 'INR' },
    ]);

    global.fetch = originalFetch;
    expect(total).toBe(28400 * FALLBACK_RATES_TO_INR.USD + 1500000 + 1200000);
    expect(total).not.toBe(2728400);
  });
});

describe('fetchRatesToInr', () => {
  beforeEach(() => resetFxRateCache());

  it('builds INR rates from a USD base payload', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { INR: 84, EUR: 0.92 } }),
    });
    const rates = await fetchRatesToInr({ fetcher });
    expect(rates.USD).toBe(84);
    expect(rates.INR).toBe(1);
    expect(rates.EUR).toBeCloseTo(84 / 0.92);
  });
});
