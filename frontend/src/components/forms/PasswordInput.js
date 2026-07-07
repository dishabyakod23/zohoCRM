'use client';

import { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { inputClass } from './FormField.js';

export default function PasswordInput({
  className,
  error,
  inputClassName,
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const fieldClass = className || inputClassName || inputClass(error);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`${fieldClass} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zoho-muted hover:text-zoho-text transition-colors"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? (
          <EyeIcon className="w-5 h-5" aria-hidden="true" />
        ) : (
          <EyeSlashIcon className="w-5 h-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
