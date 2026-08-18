import { INDUSTRIES } from './constants.js';

const PRESET_INDUSTRIES = new Set(INDUSTRIES.filter((item) => item !== 'Other'));

export function industryDropdownValue(value) {
  if (!value) return '';
  if (PRESET_INDUSTRIES.has(value)) return value;
  return 'Other';
}

export function isOtherIndustrySelected(value) {
  return Boolean(value) && !PRESET_INDUSTRIES.has(value);
}

export function customIndustryText(value) {
  if (!value || PRESET_INDUSTRIES.has(value) || value === 'Other') return '';
  return value;
}

export function resolveIndustryChange(currentValue, nextDropdownValue) {
  if (nextDropdownValue !== 'Other') return nextDropdownValue;
  if (currentValue && !PRESET_INDUSTRIES.has(currentValue)) return currentValue;
  return 'Other';
}
