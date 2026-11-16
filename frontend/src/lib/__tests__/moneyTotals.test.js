import { formatMoneyTotalsByCurrency } from '../currencies.js';

const rows = [
  { deal_size: '320000', currency: 'INR' },
  { deal_size: '85000', currency: 'INR' },
  { deal_size: '120000', currency: 'INR' },
  { deal_size: '75000', currency: 'INR' },
];

describe('formatMoneyTotalsByCurrency', () => {
  it('is short by default', () => {
    expect(formatMoneyTotalsByCurrency(rows, { amountKey: 'deal_size' })).toBe('₹6L');
  });

  it('writes the full amount when compact is off', () => {
    expect(formatMoneyTotalsByCurrency(rows, { amountKey: 'deal_size', compact: false })).toBe('₹6,00,000.00');
  });
});
