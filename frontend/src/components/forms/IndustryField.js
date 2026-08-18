'use client';
import FormField, { inputClass } from './FormField.js';
import { INDUSTRIES } from '../../lib/constants.js';
import {
  industryDropdownValue,
  isOtherIndustrySelected,
  customIndustryText,
  resolveIndustryChange,
} from '../../lib/industryHelpers.js';

export default function IndustryField({
  value,
  onChange,
  error,
  noneLabel = '--None--',
}) {
  const dropdownValue = industryDropdownValue(value);
  const showOther = isOtherIndustrySelected(value);

  return (
    <>
      <FormField label="Industry" name="industry">
        <select
          className="input"
          value={dropdownValue}
          onChange={(e) => onChange(resolveIndustryChange(value, e.target.value))}
        >
          <option value="">{noneLabel}</option>
          {INDUSTRIES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </FormField>
      {showOther && (
        <FormField label="Specify Industry" name="industry_other" error={error}>
          <input
            className={inputClass(error)}
            placeholder="Enter industry"
            value={customIndustryText(value)}
            onChange={(e) => onChange(e.target.value || 'Other')}
          />
        </FormField>
      )}
    </>
  );
}

export function IndustrySelectControl({ value, onChange, noneLabel = '--None--' }) {
  const dropdownValue = industryDropdownValue(value);
  const showOther = isOtherIndustrySelected(value);

  return (
    <div className="space-y-2">
      <select
        className="input"
        value={dropdownValue}
        onChange={(e) => onChange(resolveIndustryChange(value, e.target.value))}
      >
        <option value="">{noneLabel}</option>
        {INDUSTRIES.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      {showOther && (
        <input
          className="input"
          placeholder="Enter industry"
          value={customIndustryText(value)}
          onChange={(e) => onChange(e.target.value || 'Other')}
        />
      )}
    </div>
  );
}
