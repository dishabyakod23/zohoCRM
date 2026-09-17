'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CRMLayout from '../../components/layout/CRMLayout.js';

/**
 * Meetings live on Calendar (with Outlook sync). Keep this route as a
 * redirect so old bookmarks / Activities links still work.
 */
function MeetingsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const create = searchParams.get('create');
    router.replace(create === '1' ? '/calendar?create_meeting=1' : '/calendar');
  }, [router, searchParams]);

  return (
    <CRMLayout>
      <div className="p-6 text-sm text-zoho-muted">Opening calendar…</div>
    </CRMLayout>
  );
}

export default function MeetingsPage() {
  return (
    <Suspense fallback={(
      <CRMLayout>
        <div className="p-6 text-sm text-zoho-muted">Opening calendar…</div>
      </CRMLayout>
    )}>
      <MeetingsRedirect />
    </Suspense>
  );
}
