'use client';
import { CURRENCIES, DEFAULT_CURRENCY } from '../../lib/currencies.js';

export default function CurrencyAmountInput({
  amount = '',
  currency = DEFAULT_CURRENCY,
  onAmountChange,
  onCurrencyChange,
  allowCurrencyChange = true,
  className = '',
  inputClassName = 'input flex-1 min-w-0',
  selectClassName = 'input w-[7.5rem] shrink-0 text-xs',
  placeholder,
  min = 0,
  step = 'any',
}) {
  const resolvedCurrency = currency || DEFAULT_CURRENCY;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {allowCurrencyChange ? (
        <select
          className={selectClassName}
          value={resolvedCurrency}
          onChange={onCurrencyChange}
          aria-label="Currency"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
          ))}
        </select>
      ) : (
        <span className="text-xs text-zoho-muted shrink-0 w-12">{resolvedCurrency}</span>
      )}
      <input
        className={inputClassName}
        type="number"
        min={min}
        step={step}
        placeholder={placeholder}
        value={amount}
        onChange={onAmountChange}
      />
    </div>
  );
}
