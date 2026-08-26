'use client';

import { appHref } from '../../lib/recordNavigation.js';

/**
 * In-app link that always does a full navigation (trailingSlash / static-export safe).
 * Prefer this over next/link for CRM chrome — soft client routing can stall in production.
 */
export default function AppLink({ href, children, ...rest }) {
  return (
    <a href={appHref(href)} {...rest}>
      {children}
    </a>
  );
}
