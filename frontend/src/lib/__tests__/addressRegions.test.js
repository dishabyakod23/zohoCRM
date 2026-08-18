import {
  normalizeCountry,
  statesForCountry,
  usesStateDropdown,
  isStateInCountry,
  nextStateForCountry,
} from '../addressRegions.js';

describe('addressRegions', () => {
  it('returns US states when the country is United States or USA', () => {
    expect(normalizeCountry('USA')).toBe('United States');
    expect(statesForCountry('United States')).toContain('Texas');
    expect(statesForCountry('USA')).toContain('Texas');
    expect(statesForCountry('United States')).not.toContain('Maharashtra');
  });

  it('returns Indian states only for India', () => {
    expect(statesForCountry('India')).toContain('Jharkhand');
    expect(usesStateDropdown('India')).toBe(true);
  });

  it('uses a text field when the country has no region list', () => {
    expect(usesStateDropdown('Singapore')).toBe(false);
    expect(usesStateDropdown('Other')).toBe(false);
    expect(statesForCountry('Singapore')).toEqual([]);
  });

  it('clears a state that does not belong to the newly selected country', () => {
    expect(isStateInCountry('United States', 'Jharkhand')).toBe(false);
    expect(nextStateForCountry('United States', 'Jharkhand')).toBe('');
    expect(nextStateForCountry('United States', 'Texas')).toBe('Texas');
  });
});
