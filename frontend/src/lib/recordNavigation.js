export const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';

export function recordDetailHref(href) {
  if (!href || href.includes('?')) return href;
  return href.endsWith('/') ? href : `${href}/`;
}

/** Company detail URL — uses placeholder + ?id= on static export so it works without nginx rewrite rules. */
export function companyDetailHref(id) {
  if (!id) return '/companies/';
  if (isStaticExport) {
    return `/companies/_/?id=${encodeURIComponent(id)}`;
  }
  return recordDetailHref(`/companies/${id}`);
}

/** Full page navigation — required for static-export detail routes on nginx. */
export function navigateToRecord(href) {
  if (typeof window === 'undefined') return;
  window.location.assign(recordDetailHref(href));
}
