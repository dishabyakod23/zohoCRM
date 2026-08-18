import {
  industryDropdownValue,
  isOtherIndustrySelected,
  customIndustryText,
  resolveIndustryChange,
} from '../industryHelpers.js';

describe('industryHelpers', () => {
  it('keeps preset industries in the dropdown', () => {
    expect(industryDropdownValue('Finance')).toBe('Finance');
    expect(isOtherIndustrySelected('Finance')).toBe(false);
  });

  it('maps custom values to Other and exposes the typed industry', () => {
    expect(industryDropdownValue('Logistics')).toBe('Other');
    expect(isOtherIndustrySelected('Logistics')).toBe(true);
    expect(customIndustryText('Logistics')).toBe('Logistics');
  });

  it('shows the extra field when Other is selected', () => {
    expect(industryDropdownValue('Other')).toBe('Other');
    expect(isOtherIndustrySelected('Other')).toBe(true);
    expect(customIndustryText('Other')).toBe('');
  });

  it('preserves a custom value when switching the dropdown to Other', () => {
    expect(resolveIndustryChange('Logistics', 'Other')).toBe('Logistics');
    expect(resolveIndustryChange('Finance', 'Other')).toBe('Other');
    expect(resolveIndustryChange('Finance', 'Healthcare')).toBe('Healthcare');
  });
});
