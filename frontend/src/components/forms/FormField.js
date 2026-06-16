'use client';
import { cloneElement, isValidElement } from 'react';

export default function FormField({ label, required, error, children, name }) {
  const fieldId = name || `field-${String(label).replace(/\s+/g, '-').toLowerCase()}`;
  const child = isValidElement(children)
    ? cloneElement(children, {
      id: children.props.id || fieldId,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `${fieldId}-error` : undefined,
    })
    : children;

  return (
    <div data-field={name}>
      <label className="label" htmlFor={fieldId}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {child}
      {error && <p id={`${fieldId}-error`} className="text-xs text-red-600 mt-1" role="alert">{error}</p>}
    </div>
  );
}

export function inputClass(error) {
  return `input ${error ? 'border-red-500 focus:ring-red-500' : ''}`;
}
