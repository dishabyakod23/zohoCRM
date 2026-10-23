export const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';

/**
 * Normalize an in-app path for trailingSlash / static export.
 * Preserves query string and hash: `/leads/create?x=1` → `/leads/create/?x=1`
 */
export function appHref(href) {
  if (!href || typeof href !== 'string') return href;
  if (href.includes('://')) return href;

  const hashIndex = href.indexOf('#');
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;

  const queryIndex = withoutHash.indexOf('?');
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : '';
  let path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;

  if (!path) path = '/';
  if (!path.endsWith('/')) path = `${path}/`;

  return `${path}${query}${hash}`;
}

/** @deprecated Prefer appHref — kept for existing call sites. */
export function recordDetailHref(href) {
  return appHref(href);
}

function bareRecordId(id) {
  if (id == null || id === '') return '';
  const raw = String(id);
  const splitAt = raw.indexOf(':');
  if (splitAt > 0 && splitAt < 20) return raw.slice(splitAt + 1);
  return raw;
}

/** Static-export-safe record URL: `/module/_/?id=` when the host has no nginx rewrite. */
export function moduleRecordHref(module, id) {
  const slug = String(module || '').replace(/^\/+|\/+$/g, '');
  const bare = bareRecordId(id);
  if (!slug) return '/';
  if (!bare) return `/${slug}/`;
  if (isStaticExport) return `/${slug}/_/?id=${encodeURIComponent(bare)}`;
  return `/${slug}/${bare}`;
}

export function contactDetailHref(id) {
  return moduleRecordHref('contacts', id);
}

export function dealDetailHref(id) {
  return moduleRecordHref('deals', id);
}

/** Company detail URL — uses placeholder + ?id= on static export so it works without nginx rewrite rules. */
export function companyDetailHref(id) {
  if (!id) return '/companies/';
  if (isStaticExport) {
    return `/companies/_/?id=${encodeURIComponent(id)}`;
  }
  return appHref(`/companies/${id}`);
}

/** Sequence detail URL — static export serves /sequences/_/ with ?id= query. */
export function sequenceDetailHref(id) {
  if (!id) return '/sequences/';
  if (isStaticExport) {
    return `/sequences/_/?id=${encodeURIComponent(id)}`;
  }
  return appHref(`/sequences/${id}`);
}

/** Sales target edit URL — static export serves only /settings/sales-targets/_/edit/. */
export function salesTargetEditHref(id) {
  if (!id) return '/settings/sales-targets/';
  if (isStaticExport) {
    return `/settings/sales-targets/_/edit/?id=${encodeURIComponent(id)}`;
  }
  return appHref(`/settings/sales-targets/${id}/edit`);
}

/** Full page navigation — required when soft client routing stalls (static export / overlays). */
export function navigateToRecord(href) {
  if (typeof window === 'undefined') return;
  window.location.assign(appHref(href));
}
