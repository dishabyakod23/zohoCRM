'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { inputClass } from './FormField.js';

/**
 * Searchable account name field: pick an existing account or type a new name.
 * @param {Array<{ value: string, label: string }>} options
 * @param {string} valueId - selected account id (or '')
 * @param {string} valueLabel - display text / new account name
 * @param {(next: { account_id: string, account_name: string }) => void} onChange
 */
export default function AccountNameCombobox({
  options = [],
  valueId = '',
  valueLabel = '',
  onChange,
  error,
  placeholder = 'Search or type account name',
  disabled = false,
  id,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(valueLabel || '');
  const rootRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    setQuery(valueLabel || '');
  }, [valueLabel, valueId]);

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options
      .filter((a) => String(a.label || '').toLowerCase().includes(q))
      .slice(0, 50);
  }, [options, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return options.find((a) => String(a.label || '').toLowerCase() === q) || null;
  }, [options, query]);

  const showCreateOption = query.trim() && !exactMatch;

  const emit = (account_id, account_name) => {
    onChange?.({ account_id: account_id || '', account_name: account_name || '' });
  };

  const selectOption = (opt) => {
    setQuery(opt.label || '');
    emit(opt.value, opt.label || '');
    setOpen(false);
  };

  const commitTyped = () => {
    const name = query.trim();
    if (!name) {
      emit('', '');
      return;
    }
    if (exactMatch) {
      emit(exactMatch.value, exactMatch.label);
      setQuery(exactMatch.label);
      return;
    }
    emit('', name);
  };

  return (
    <div className="relative" ref={rootRef}>
      <div className="relative">
        <input
          id={id}
          type="text"
          autoComplete="off"
          disabled={disabled}
          className={inputClass(error)}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setOpen(true);
            const match = options.find(
              (a) => String(a.label || '').toLowerCase() === next.trim().toLowerCase(),
            );
            if (match) emit(match.value, match.label);
            else emit('', next);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // slight delay so option click can register
            window.setTimeout(() => commitTyped(), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              if (filtered.length === 1) {
                selectOption(filtered[0]);
              } else if (exactMatch) {
                selectOption(exactMatch);
              } else {
                commitTyped();
                setOpen(false);
              }
            }
            if (e.key === 'ArrowDown' && open && listRef.current) {
              e.preventDefault();
              const first = listRef.current.querySelector('button');
              first?.focus();
            }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Show accounts"
          onClick={() => setOpen((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-zoho-muted hover:text-zoho-text"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open && !disabled && (
        <div
          ref={listRef}
          className="absolute z-40 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-zoho-border rounded-xl shadow-card-hover py-1"
        >
          {filtered.length === 0 && !showCreateOption && (
            <p className="px-3 py-2 text-xs text-zoho-muted">No accounts found</p>
          )}
          {filtered.map((a) => (
            <button
              key={a.value}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-50 transition-colors ${
                a.value === valueId ? 'bg-brand-50 text-brand-700 font-medium' : 'text-zoho-text'
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectOption(a)}
            >
              {a.label}
            </button>
          ))}
          {showCreateOption && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm text-brand-600 hover:bg-brand-50 border-t border-zoho-border font-medium"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const name = query.trim();
                emit('', name);
                setQuery(name);
                setOpen(false);
              }}
            >
              Use “{query.trim()}” as new account
            </button>
          )}
        </div>
      )}
    </div>
  );
}
