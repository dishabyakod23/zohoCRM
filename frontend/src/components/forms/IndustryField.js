'use client';
import { useEffect, useMemo, useState } from 'react';
import FormField, { inputClass } from './FormField.js';
import { fetchIndustries } from '../../lib/services/lookups.js';
import {
  industryDropdownValue,
  isOtherIndustrySelected,
  customIndustryText,
  resolveIndustryChange,
  withCurrentIndustryOption,
} from '../../lib/industryHelpers.js';

function useIndustryOptions(optionsProp) {
  const [options, setOptions] = useState(() => optionsProp || []);

  useEffect(() => {
    if (optionsProp) {
      setOptions(optionsProp);
      return undefined;
    }
    let cancelled = false;
    fetchIndustries()
      .then((data) => { if (!cancelled) setOptions(data); })
      .catch(() => { if (!cancelled) setOptions([]); });
    return () => { cancelled = true; };
  }, [optionsProp]);

  return options;
}

function IndustrySelect({
  value,
  onChange,
  options,
  noneLabel = '--None--',
  className = 'input',
}) {
  const mergedOptions = useMemo(
    () => withCurrentIndustryOption(options, value),
    [options, value],
  );
  const dropdownValue = industryDropdownValue(value, mergedOptions);
  const showOther = isOtherIndustrySelected(value, mergedOptions);

  return (
    <div className="space-y-2">
      <select
        className={className}
        value={dropdownValue}
        onChange={(e) => onChange(resolveIndustryChange(value, e.target.value, mergedOptions))}
      >
        <option value="">{noneLabel}</option>
        {mergedOptions.map((item) => {
          const optionValue = typeof item === 'string' ? item : item.value;
          const optionLabel = typeof item === 'string' ? item : (item.label || item.value);
          return (
            <option key={optionValue} value={optionValue}>{optionLabel}</option>
          );
        })}
      </select>
      {showOther && (
        <input
          className={className}
          placeholder="Enter industry"
          value={customIndustryText(value, mergedOptions)}
          onChange={(e) => onChange(e.target.value || 'Other')}
        />
      )}
    </div>
  );
}

export default function IndustryField({
  value,
  onChange,
  error,
  noneLabel = '--None--',
  options: optionsProp,
}) {
  const options = useIndustryOptions(optionsProp);
  const mergedOptions = useMemo(
    () => withCurrentIndustryOption(options, value),
    [options, value],
  );
  const dropdownValue = industryDropdownValue(value, mergedOptions);
  const showOther = isOtherIndustrySelected(value, mergedOptions);

  return (
    <>
      <FormField label="Industry" name="industry">
        <select
          className="input"
          value={dropdownValue}
          onChange={(e) => onChange(resolveIndustryChange(value, e.target.value, mergedOptions))}
        >
          <option value="">{noneLabel}</option>
          {mergedOptions.map((item) => {
            const optionValue = typeof item === 'string' ? item : item.value;
            const optionLabel = typeof item === 'string' ? item : (item.label || item.value);
            return (
              <option key={optionValue} value={optionValue}>{optionLabel}</option>
            );
          })}
        </select>
      </FormField>
      {showOther && (
        <FormField label="Specify Industry" name="industry_other" error={error}>
          <input
            className={inputClass(error)}
            placeholder="Enter industry"
            value={customIndustryText(value, mergedOptions)}
            onChange={(e) => onChange(e.target.value || 'Other')}
          />
        </FormField>
      )}
    </>
  );
}

export function IndustrySelectControl({
  value,
  onChange,
  noneLabel = '--None--',
  options: optionsProp,
}) {
  const options = useIndustryOptions(optionsProp);
  return (
    <IndustrySelect
      value={value}
      onChange={onChange}
      options={options}
      noneLabel={noneLabel}
    />
  );
}
