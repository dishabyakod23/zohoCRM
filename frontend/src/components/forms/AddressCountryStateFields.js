'use client';
import FormField from './FormField.js';
import {
  ADDRESS_COUNTRIES,
  statesForCountry,
  usesStateDropdown,
} from '../../lib/addressRegions.js';

export function AddressCountryField({
  value,
  onChange,
  name = 'country',
  noneLabel = '--None--',
}) {
  return (
    <FormField label="Country / Region" name={name}>
      <select
        className="input"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{noneLabel}</option>
        {ADDRESS_COUNTRIES.map((country) => (
          <option key={country} value={country}>{country}</option>
        ))}
      </select>
    </FormField>
  );
}

export function AddressStateField({
  country,
  value,
  onChange,
  name = 'state',
  noneLabel = '--None--',
}) {
  const states = statesForCountry(country);
  const showDropdown = usesStateDropdown(country);

  return (
    <FormField label="State / Province" name={name}>
      {showDropdown ? (
        <select
          className="input"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{noneLabel}</option>
          {states.map((state) => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
      ) : (
        <input
          className="input"
          placeholder={country ? 'Enter state / province' : 'Select a country first'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </FormField>
  );
}
