import {
  industryDropdownValue,
  isOtherIndustrySelected,
  customIndustryText,
  resolveIndustryChange,
  withCurrentIndustryOption,
} from '../industryHelpers.js';

const OPTIONS = [
  { value: 'Finance', label: 'Finance' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Other', label: 'Other' },
];

describe('industryHelpers', () => {
  it('keeps preset industries in the dropdown', () => {
    expect(industryDropdownValue('Finance', OPTIONS)).toBe('Finance');
    expect(isOtherIndustrySelected('Finance', OPTIONS)).toBe(false);
  });

  it('maps custom values to Other and exposes the typed industry', () => {
    expect(industryDropdownValue('Logistics', OPTIONS)).toBe('Other');
    expect(isOtherIndustrySelected('Logistics', OPTIONS)).toBe(true);
    expect(customIndustryText('Logistics', OPTIONS)).toBe('Logistics');
  });

  it('shows the extra field when Other is selected', () => {
    expect(industryDropdownValue('Other', OPTIONS)).toBe('Other');
    expect(isOtherIndustrySelected('Other', OPTIONS)).toBe(true);
    expect(customIndustryText('Other', OPTIONS)).toBe('');
  });

  it('preserves a custom value when switching the dropdown to Other', () => {
    expect(resolveIndustryChange('Logistics', 'Other', OPTIONS)).toBe('Logistics');
    expect(resolveIndustryChange('Finance', 'Other', OPTIONS)).toBe('Other');
    expect(resolveIndustryChange('Finance', 'Healthcare', OPTIONS)).toBe('Healthcare');
  });

  it('keeps orphan values selectable when Other is not in the lookup', () => {
    const noOther = [{ value: 'Finance', label: 'Finance' }];
    expect(industryDropdownValue('Logistics', noOther)).toBe('Logistics');
    expect(isOtherIndustrySelected('Logistics', noOther)).toBe(false);
    expect(withCurrentIndustryOption(noOther, 'Logistics')).toEqual([
      { value: 'Finance', label: 'Finance' },
      { value: 'Logistics', label: 'Logistics' },
    ]);
  });
});
