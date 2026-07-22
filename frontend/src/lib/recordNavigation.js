export const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';

export function recordDetailHref(href) {
  if (!href || href.includes('?')) return href;
  return href.endsWith('/') ? href : `${href}/`;
}

/** Full page navigation — required for static-export detail routes on nginx. */
export function navigateToRecord(href) {
  if (typeof window === 'undefined') return;
  window.location.assign(recordDetailHref(href));
}
