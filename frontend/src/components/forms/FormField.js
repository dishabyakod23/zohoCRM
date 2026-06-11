'use client';

export default function FormField({ label, required, error, children, name }) {
  return (
    <div data-field={name}>
      <label className="label">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

export function inputClass(error) {
  return `input ${error ? 'border-red-500 focus:ring-red-500' : ''}`;
}
