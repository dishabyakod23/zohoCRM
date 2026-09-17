'use client';

/** Ensure LinkedIn profile URLs open correctly in a new tab. */
export function linkedInProfileHref(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('linkedin.com') || value.startsWith('www.linkedin.com')) {
    return `https://${value}`;
  }
  if (value.startsWith('/in/') || value.startsWith('in/')) {
    const path = value.startsWith('/') ? value : `/${value}`;
    return `https://www.linkedin.com${path}`;
  }
  // Bare handle / slug
  if (/^[\w-]+$/.test(value)) {
    return `https://www.linkedin.com/in/${value}`;
  }
  return `https://${value.replace(/^\/+/, '')}`;
}

export function resolveRecordLinkedInUrl(record = {}) {
  const candidates = [
    record.skype_id,
    record.linkedin,
    record.linkedin_url,
    record.linkedin_profile,
    record.linkedinUrl,
    record.LinkedIn,
    record['LinkedIn URL'],
    record['linkedin url'],
    record.li_url,
    record.profile_url,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value) return value;
  }
  return null;
}

/**
 * Table cell: clickable LinkedIn profile link (opens in new tab).
 */
export default function LinkedInCell({ value, record, className = '' }) {
  const raw = value != null && String(value).trim() !== ''
    ? value
    : resolveRecordLinkedInUrl(record || {});
  const href = linkedInProfileHref(raw);
  if (!href) {
    return <span className="text-zoho-muted">—</span>;
  }

  const label = (() => {
    const display = String(raw || href).trim();
    try {
      const url = new URL(href);
      const hostPath = `${url.hostname.replace(/^www\./, '')}${url.pathname}`.replace(/\/$/, '');
      const text = hostPath || display;
      return text.length > 42 ? `${text.slice(0, 40)}…` : text;
    } catch {
      return display.length > 42 ? `${display.slice(0, 40)}…` : (display || 'Open profile');
    }
  })();

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
      className={`text-brand-600 hover:underline text-xs font-medium max-w-[14rem] truncate inline-block ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </a>
  );
}
