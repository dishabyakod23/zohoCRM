'use client';

import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid';

export default function SortableEmailHeader({ label = 'Email', sort, onSortChange }) {
  const isAsc = sort === 'email_asc';
  const isDesc = sort === 'email_desc';

  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <span className="inline-flex flex-col -space-y-1.5">
        <button
          type="button"
          onClick={() => onSortChange?.('email_asc')}
          className={`p-0 leading-none rounded hover:text-brand-600 ${isAsc ? 'text-brand-600' : 'text-gray-300'}`}
          aria-label="Sort email A to Z"
          title="Sort A → Z"
        >
          <ChevronUpIcon className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => onSortChange?.('email_desc')}
          className={`p-0 leading-none rounded hover:text-brand-600 ${isDesc ? 'text-brand-600' : 'text-gray-300'}`}
          aria-label="Sort email Z to A"
          title="Sort Z → A"
        >
          <ChevronDownIcon className="w-3 h-3" />
        </button>
      </span>
    </span>
  );
}
