'use client';

import { useParams, usePathname } from 'next/navigation';

export const STATIC_EXPORT_PLACEHOLDER_ID = '_';

export function getRecordIdFromPathname(pathname) {
  if (!pathname) return '';
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1] || '';
  return last && last !== STATIC_EXPORT_PLACEHOLDER_ID ? last : '';
}

/** Resolves record id for static-export detail routes (nginx serves /module/_/ shell). */
export function useRecordId(paramName = 'id') {
  const params = useParams();
  const pathname = usePathname();

  // Browser URL is authoritative on static export; do not memoize (SSR caches "_").
  if (typeof window !== 'undefined') {
    const fromUrl = getRecordIdFromPathname(window.location.pathname);
    if (fromUrl) return fromUrl;
  }

  const paramId = params?.[paramName];
  if (paramId && paramId !== STATIC_EXPORT_PLACEHOLDER_ID) {
    return String(paramId);
  }

  const fromPath = getRecordIdFromPathname(pathname);
  if (fromPath) return fromPath;

  return paramId ? String(paramId) : '';
}

export function isPlaceholderRecordId(id) {
  return !id || id === STATIC_EXPORT_PLACEHOLDER_ID;
}
