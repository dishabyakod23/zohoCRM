/** Fallback USD→INR and other majors when live FX cannot be fetched. */
export const FALLBACK_RATES_TO_INR = {
  INR: 1,
  USD: 83.5,
  EUR: 90,
  GBP: 105,
  AUD: 55,
  CAD: 61,
  SGD: 62,
  AED: 22.7,
  SAR: 22.3,
  JPY: 0.56,
  CNY: 11.6,
  CHF: 95,
  HKD: 10.7,
  NZD: 50,
  MYR: 19,
  ZAR: 4.6,
  THB: 2.4,
  KWD: 270,
  QAR: 22.9,
  BHD: 221,
  OMR: 217,
  NPR: 0.62,
  LKR: 0.28,
  BDT: 0.7,
  PKR: 0.3,
};

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
    const res = await fetcher('https://api.frankfurter.app/latest?from=USD');
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
