function optionValues(options = []) {
  return (options || [])
    .map((item) => (typeof item === 'string' ? item : item?.value))
    .filter(Boolean)
    .map((value) => String(value));
}

function presetIndustrySet(options = []) {
  return new Set(
    optionValues(options).filter((value) => value.toLowerCase() !== 'other'),
  );
}

function hasOtherOption(options = []) {
  return optionValues(options).some((value) => value.toLowerCase() === 'other');
}

export function industryDropdownValue(value, options = []) {
  if (!value) return '';
  const presets = presetIndustrySet(options);
  if (presets.has(value)) return value;
  if (String(value).toLowerCase() === 'other') return 'Other';
  if (hasOtherOption(options)) return 'Other';
  return value;
}

export function isOtherIndustrySelected(value, options = []) {
  if (!value) return false;
  if (String(value).toLowerCase() === 'other') return true;
  const presets = presetIndustrySet(options);
  return hasOtherOption(options) && !presets.has(value);
}

export function customIndustryText(value, options = []) {
  if (!value) return '';
  if (String(value).toLowerCase() === 'other') return '';
  const presets = presetIndustrySet(options);
  if (presets.has(value)) return '';
  return value;
}

export function resolveIndustryChange(currentValue, nextDropdownValue, options = []) {
  if (nextDropdownValue !== 'Other') return nextDropdownValue;
  if (currentValue && isOtherIndustrySelected(currentValue, options)) return currentValue;
  return 'Other';
}

/** Ensure a saved custom/orphan industry still appears in the select options. */
export function withCurrentIndustryOption(options = [], value) {
  const list = Array.isArray(options) ? [...options] : [];
  if (!value) return list;
  const exists = list.some((item) => String(typeof item === 'string' ? item : item?.value) === String(value));
  if (exists || isOtherIndustrySelected(value, list)) return list;
  return [...list, { value, label: value }];
}
