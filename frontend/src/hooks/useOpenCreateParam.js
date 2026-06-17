'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/** Open create modal when URL contains ?create=1 (Quick Create links). */
export function useOpenCreateParam(canEdit, openCreate) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined' || !canEdit) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') !== '1') return;
    openCreate();
    params.delete('create');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [canEdit, openCreate, pathname, router]);
}
