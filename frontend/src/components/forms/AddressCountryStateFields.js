'use client';
import { useEffect, useMemo, useState } from 'react';
import FormField from './FormField.js';
import { fetchCountries, fetchStates } from '../../lib/services/lookups.js';
import {
  ADDRESS_COUNTRIES,
  statesForCountry,
} from '../../lib/addressRegions.js';

const FALLBACK_COUNTRIES = ADDRESS_COUNTRIES.map((country) => ({
  value: country,
  label: country,
}));

function toOptions(list = []) {
  return (list || [])
    .map((item) => {
      if (typeof item === 'string') return { value: item, label: item };
      const value = item?.value ?? item?.code ?? item?.name ?? item?.label;
      if (!value) return null;
      return { value: String(value), label: String(item.label || item.name || value) };
    })
    .filter(Boolean);
}

function withCurrentOption(options = [], value) {
  const list = toOptions(options);
  if (!value) return list;
  const exists = list.some((item) => item.value === String(value));
  if (exists) return list;
  return [...list, { value: String(value), label: String(value) }];
}

function useCountryOptions() {
  const [options, setOptions] = useState(FALLBACK_COUNTRIES);

  useEffect(() => {
    let cancelled = false;
    fetchCountries()
      .then((data) => {
        if (cancelled) return;
        const parsed = toOptions(data);
        setOptions(parsed.length ? parsed : FALLBACK_COUNTRIES);
      })
      .catch(() => {
        if (!cancelled) setOptions(FALLBACK_COUNTRIES);
      });
    return () => { cancelled = true; };
  }, []);

  return options;
}

function useStateOptions(country) {
  const [options, setOptions] = useState(() => (
    statesForCountry(country).map((state) => ({ value: state, label: state }))
  ));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const key = String(country || '').trim();
    if (!key) {
      setOptions([]);
      setLoaded(true);
      return undefined;
    }

    setLoaded(false);
    const fallback = statesForCountry(key).map((state) => ({ value: state, label: state }));
    setOptions(fallback);

    fetchStates(key)
      .then((data) => {
        if (cancelled) return;
        const parsed = toOptions(data);
        setOptions(parsed.length ? parsed : fallback);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setOptions(fallback);
        setLoaded(true);
      });

    return () => { cancelled = true; };
  }, [country]);

  return { options, loaded };
}

export function AddressCountrySelect({
  value,
  onChange,
  noneLabel = '--None--',
  className = 'input',
}) {
  const options = useCountryOptions();
  const merged = useMemo(() => withCurrentOption(options, value), [options, value]);

  return (
    <select
      className={className}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{noneLabel}</option>
      {merged.map((country) => (
        <option key={country.value} value={country.value}>{country.label}</option>
      ))}
    </select>
  );
}

export function AddressStateSelect({
  country,
  value,
  onChange,
  noneLabel = '--None--',
  className = 'input',
}) {
  const { options, loaded } = useStateOptions(country);
  const showDropdown = options.length > 0;
  const merged = useMemo(
    () => (showDropdown ? withCurrentOption(options, value) : options),
    [showDropdown, options, value],
  );

  useEffect(() => {
    if (!loaded || !value || !showDropdown) return;
    const exists = options.some((item) => item.value === String(value));
    if (!exists) onChange('');
    // Intentionally omit onChange from deps — parents pass inline handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, value, showDropdown, options]);

  if (showDropdown) {
    return (
      <select
        className={className}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={!country}
      >
        <option value="">{noneLabel}</option>
        {merged.map((state) => (
          <option key={state.value} value={state.value}>{state.label}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      className={className}
      placeholder={country ? 'Enter state / province' : 'Select a country first'}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={!country}
    />
  );
}

export function AddressCountryField({
  value,
  onChange,
  name = 'country',
  noneLabel = '--None--',
}) {
  return (
    <FormField label="Country / Region" name={name}>
      <AddressCountrySelect value={value} onChange={onChange} noneLabel={noneLabel} />
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
  return (
    <FormField label="State / Province" name={name}>
      <AddressStateSelect
        country={country}
        value={value}
        onChange={onChange}
        noneLabel={noneLabel}
      />
    </FormField>
  );
}
