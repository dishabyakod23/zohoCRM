'use client';
import Link from 'next/link';
import { recordDetailHref } from '../../lib/recordHelpers.js';
import { tableLinkClass } from '../../lib/tableStyles.js';

export default function RelatedRecordCard({ relatedType, relatedId, label }) {
  const href = recordDetailHref(relatedType, relatedId);
  if (!href) return null;

  return (
    <div className="card p-4">
      <h3 className="text-xs font-semibold text-zoho-muted uppercase tracking-wider mb-2">Related To</h3>
      <Link href={href} className={`text-sm font-medium ${tableLinkClass}`}>
        {label || `${relatedType} #${relatedId}`}
      </Link>
    </div>
  );
}
