'use client';

import { useParams, usePathname } from 'next/navigation';

export const STATIC_EXPORT_PLACEHOLDER_ID = '_';

const MODULE_SLUGS = new Set([
  'leads',
  'contacts',
  'accounts',
  'deals',
  'tasks',
  'calls',
  'meetings',
  'campaigns',
  'documents',
  'visits',
  'projects',
  'raw-leads',
  'qualified-leads',
  'proposals',
  'create',
  'dashboard',
  'settings',
  'reports',
  'calendar',
  'work-items',
  'recycle-bin',
  'activities',
  'help',
  'login',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidRecordId(id) {
  if (!id || id === STATIC_EXPORT_PLACEHOLDER_ID) return false;
  const value = String(id).trim();
  if (!value || MODULE_SLUGS.has(value.toLowerCase())) return false;
  return UUID_RE.test(value);
}

export function isPlaceholderRecordId(id) {
  return !isValidRecordId(id);
}

export function getRecordIdFromPathname(pathname) {
  if (!pathname) return '';
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return '';
  const last = segments[segments.length - 1] || '';
  if (!last || last === STATIC_EXPORT_PLACEHOLDER_ID) return '';
  if (MODULE_SLUGS.has(last.toLowerCase())) return '';
  return last;
}

/** Resolves record id for static-export detail routes (nginx serves /module/_/ shell). */
export function useRecordId(paramName = 'id') {
  const params = useParams();
  const pathname = usePathname();
  const paramId = params?.[paramName];

  // Prefer dynamic route param during client navigation (window may still be on list URL).
  if (paramId && paramId !== STATIC_EXPORT_PLACEHOLDER_ID && isValidRecordId(paramId)) {
    return String(paramId);
  }

  if (typeof window !== 'undefined') {
    const fromUrl = getRecordIdFromPathname(window.location.pathname);
    if (fromUrl && isValidRecordId(fromUrl)) return fromUrl;
  }

  const fromPath = getRecordIdFromPathname(pathname);
  if (fromPath && isValidRecordId(fromPath)) return fromPath;

  if (paramId && paramId !== STATIC_EXPORT_PLACEHOLDER_ID && isValidRecordId(paramId)) {
    return String(paramId);
  }

  return '';
}
