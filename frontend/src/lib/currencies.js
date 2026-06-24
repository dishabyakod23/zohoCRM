/** ISO 4217 currencies available in monetary fields */
export const DEFAULT_CURRENCY = 'INR';

export const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', locale: 'en-IN' },
  { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'en-DE' },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', locale: 'en-CA' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', locale: 'en-SG' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', locale: 'en-AE' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR', locale: 'ar-SA' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', locale: 'zh-CN' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', locale: 'de-CH' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', locale: 'en-HK' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', locale: 'en-NZ' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', locale: 'ms-MY' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', locale: 'en-ZA' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', locale: 'th-TH' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KWD', locale: 'ar-KW' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'QAR', locale: 'ar-QA' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BHD', locale: 'ar-BH' },
  { code: 'OMR', name: 'Omani Rial', symbol: 'OMR', locale: 'ar-OM' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs.', locale: 'ne-NP' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs.', locale: 'en-LK' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', locale: 'bn-BD' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs.', locale: 'en-PK' },
];

const currencyByCode = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]));

export function getCurrency(code) {
  return currencyByCode[code] || currencyByCode[DEFAULT_CURRENCY];
}

function trimCompactDecimal(value, decimals = 1) {
  return Number(value).toFixed(decimals).replace(/\.0$/, '');
}

/** INR amounts as ₹1cr, ₹60L, etc. Falls back to formatMoney for other currencies. */
export function formatIndianCompact(amount, currencyCode = DEFAULT_CURRENCY) {
  if (amount == null || amount === '') return '—';
  const num = Number(amount);
  if (Number.isNaN(num)) return amount;

  const currency = getCurrency(currencyCode);
  if (currency.code !== 'INR') return formatMoney(amount, currencyCode);

  const symbol = currency.symbol;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1_00_00_000) {
    return `${sign}${symbol}${trimCompactDecimal(abs / 1_00_00_000)}cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}${symbol}${trimCompactDecimal(abs / 1_00_000)}L`;
  }
  return formatMoney(num, 'INR');
}

export function formatMoney(amount, currencyCode = DEFAULT_CURRENCY) {
  if (amount == null || amount === '') return '—';
  const num = Number(amount);
  if (Number.isNaN(num)) return amount;
  const currency = getCurrency(currencyCode);
  const fractionDigits = ['JPY', 'KWD', 'BHD', 'OMR'].includes(currency.code) ? 0 : 2;
  try {
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(num);
  } catch {
    return `${currency.symbol} ${num.toLocaleString()}`;
  }
}
