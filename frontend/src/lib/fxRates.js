/** Fallback USD→INR and other majors when live FX cannot be fetched (Aug 2026 levels). */
export const FALLBACK_RATES_TO_INR = {
  INR: 1,
  USD: 95.41,
  EUR: 103,
  GBP: 120,
  AUD: 63,
  CAD: 70,
  SGD: 71,
  AED: 26,
  SAR: 25.5,
  JPY: 0.64,
  CNY: 13.3,
  CHF: 109,
  HKD: 12.2,
  NZD: 57,
  MYR: 22,
  ZAR: 5.3,
  THB: 2.7,
  KWD: 308,
  QAR: 26.2,
  BHD: 253,
  OMR: 248,
  NPR: 0.71,
  LKR: 0.32,
  BDT: 0.8,
  PKR: 0.34,
};

const FX_API_URL = 'https://api.frankfurter.dev/v1/latest?from=USD';

const CACHE_MS = 60 * 60 * 1000;
let cachedRates = null;
let cachedAt = 0;

export function convertToInr(amount, currency = 'INR', ratesToInr = FALLBACK_RATES_TO_INR) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num === 0) return 0;
  const code = String(currency || 'INR').toUpperCase();
  if (code === 'INR') return num;
  const rate = Number(ratesToInr?.[code]);
  if (!Number.isFinite(rate) || rate <= 0) return num;
  return num * rate;
}

function ratesFromUsdBase(usdRates = {}) {
  const usdToInr = Number(usdRates.INR);
  if (!Number.isFinite(usdToInr) || usdToInr <= 0) return null;

  const rates = { ...FALLBACK_RATES_TO_INR, USD: usdToInr, INR: 1 };
  for (const [code, perUsd] of Object.entries(usdRates)) {
    const qty = Number(perUsd);
    if (!Number.isFinite(qty) || qty <= 0 || code === 'INR') continue;
    rates[code] = usdToInr / qty;
  }
  return rates;
}

export async function fetchRatesToInr({ fetcher = fetch } = {}) {
  if (cachedRates && Date.now() - cachedAt < CACHE_MS) return cachedRates;

  try {
    const res = await fetcher(FX_API_URL);
    if (!res?.ok) throw new Error('fx request failed');
    const data = await res.json();
    const rates = ratesFromUsdBase(data.rates);
    if (!rates) throw new Error('fx payload missing INR');
    cachedRates = rates;
    cachedAt = Date.now();
    return rates;
  } catch {
    cachedRates = FALLBACK_RATES_TO_INR;
    cachedAt = Date.now();
    return FALLBACK_RATES_TO_INR;
  }
}

export function resetFxRateCache() {
  cachedRates = null;
  cachedAt = 0;
}

export async function sumAmountsInInr(rows = [], { amountOf, currencyOf } = {}) {
  const rates = await fetchRatesToInr();
  return (rows || []).reduce((sum, row) => {
    const amount = amountOf ? amountOf(row) : Number(row.deal_size ?? row.proposal_amount ?? row.amount);
    const currency = currencyOf ? currencyOf(row) : (row.currency || 'INR');
    return sum + convertToInr(amount, currency, rates);
  }, 0);
}
