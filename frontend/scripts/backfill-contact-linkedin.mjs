/**
 * Backfill LinkedIn URLs (stored as skype_id) onto existing contacts from a CSV.
 * Does not re-import contacts — matches by email and PATCHes only.
 *
 * Usage (from frontend/):
 *   set CRM_API_URL=https://test-crm.origami.dev/api/v1
 *   set CRM_API_EMAIL=you@origami.dev
 *   set CRM_API_PASSWORD=your-password
 *   node scripts/backfill-contact-linkedin.mjs path\to\contacts.csv
 *
 * Optional:
 *   CRM_API_TOKEN=...     skip login
 *   CRM_DRY_RUN=1         print matches only, no PATCH
 *   CRM_FORCE=1           overwrite contacts that already have skype_id
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const API_BASE = (process.env.CRM_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://test-crm.origami.dev/api/v1')
  .replace(/\/$/, '');
const DRY_RUN = process.env.CRM_DRY_RUN === '1' || process.env.CRM_DRY_RUN === 'true';
const FORCE = process.env.CRM_FORCE === '1' || process.env.CRM_FORCE === 'true';

const EMAIL_ALIASES = new Set(['email', 'e-mail', 'email address', 'email_address', 'work email']);
const LINKEDIN_ALIASES = new Set([
  'linkedin',
  'linkedin_url',
  'linkedin url',
  'linkedin_profile',
  'linkedin profile',
  'li_url',
  'profile_url',
  'skype',
  'skype_id',
  'skype id',
]);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((h) => String(h || '').trim());
  const records = rows.slice(1)
    .filter((r) => r.some((c) => String(c || '').trim()))
    .map((r) => {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] != null ? String(r[idx]).trim() : '';
      });
      return obj;
    });
  return { headers, records };
}

function findColumn(headers, aliases) {
  const normalized = headers.map((h) => ({ raw: h, key: String(h || '').trim().toLowerCase() }));
  for (const { raw, key } of normalized) {
    if (aliases.has(key)) return raw;
  }
  return null;
}

function resolveLinkedIn(value) {
  const v = String(value || '').trim();
  return v || null;
}

async function login() {
  if (process.env.CRM_API_TOKEN) return process.env.CRM_API_TOKEN;
  const email = process.env.CRM_API_EMAIL;
  const password = process.env.CRM_API_PASSWORD;
  if (!email || !password) {
    throw new Error('Set CRM_API_TOKEN or CRM_API_EMAIL + CRM_API_PASSWORD');
  }
  const res = await axios.post(`${API_BASE}/auth/login`, { email, password });
  const token = res.data?.data?.access_token || res.data?.access_token;
  if (!token) throw new Error('Login succeeded but no access_token returned');
  return token;
}

async function listAllContacts(api) {
  const all = [];
  let page = 1;
  const pageSize = 100;
  for (;;) {
    const res = await api.get('/contacts', { params: { page, page_size: pageSize } });
    const rows = res.data?.data || [];
    all.push(...rows);
    const total = res.data?.meta?.total ?? all.length;
    console.log(`  loaded contacts page ${page} (${all.length}/${total})`);
    if (!rows.length || all.length >= total) break;
    page += 1;
  }
  return all;
}

/** Prefer exact email match via search — avoids loading the full contacts table on large envs. */
async function findContactByEmail(api, email) {
  const res = await api.get('/contacts', {
    params: { search: email, page: 1, page_size: 25 },
  });
  const rows = res.data?.data || [];
  const want = String(email || '').trim().toLowerCase();
  return rows.find((c) => String(c.email || '').trim().toLowerCase() === want) || null;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node scripts/backfill-contact-linkedin.mjs <path-to-csv>');
    process.exit(1);
  }
  const abs = path.resolve(csvPath);
  if (!fs.existsSync(abs)) {
    console.error(`CSV not found: ${abs}`);
    process.exit(1);
  }

  const { headers, records } = parseCsv(fs.readFileSync(abs, 'utf8'));
  const emailCol = findColumn(headers, EMAIL_ALIASES);
  const linkedInCol = findColumn(headers, LINKEDIN_ALIASES);
  if (!emailCol) {
    console.error(`No email column found. Headers: ${headers.join(', ')}`);
    process.exit(1);
  }
  if (!linkedInCol) {
    console.error(`No LinkedIn column found. Headers: ${headers.join(', ')}`);
    process.exit(1);
  }

  const fromCsv = new Map();
  for (const row of records) {
    const email = String(row[emailCol] || '').trim().toLowerCase();
    const linkedIn = resolveLinkedIn(row[linkedInCol]);
    if (!email || !linkedIn) continue;
    if (!fromCsv.has(email)) fromCsv.set(email, linkedIn);
  }

  console.log(`API: ${API_BASE}`);
  console.log(`CSV rows with LinkedIn: ${fromCsv.size}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'PATCH'}${FORCE ? ' (force overwrite)' : ' (skip if skype_id set)'}`);

  const token = await login();
  const api = axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${token}` },
  });

  let matched = 0;
  let patched = 0;
  let skippedHasValue = 0;
  let missing = 0;
  const failures = [];
  let i = 0;

  for (const [email, linkedIn] of fromCsv.entries()) {
    i += 1;
    if (i % 50 === 0 || i === 1) console.log(`… ${i}/${fromCsv.size}`);
    let contact;
    try {
      contact = await findContactByEmail(api, email);
    } catch (err) {
      failures.push({ email, error: err.response?.data?.detail || err.message });
      continue;
    }
    if (!contact) {
      missing += 1;
      continue;
    }
    matched += 1;
    const existing = String(contact.skype_id || '').trim();
    if (existing && !FORCE) {
      skippedHasValue += 1;
      continue;
    }
    if (DRY_RUN) {
      console.log(`[dry-run] would set ${email} -> ${linkedIn}`);
      patched += 1;
      continue;
    }
    try {
      await api.patch(`/contacts/${contact.id}`, { skype_id: linkedIn });
      patched += 1;
      console.log(`patched ${email}`);
    } catch (err) {
      failures.push({ email, error: err.response?.data?.detail || err.response?.data?.message || err.message });
    }
  }

  console.log('\nDone');
  console.log(` matched: ${matched}`);
  console.log(` patched: ${patched}`);
  console.log(` skipped (already had LinkedIn): ${skippedHasValue}`);
  console.log(` CSV emails not found in CRM: ${missing}`);
  if (failures.length) {
    console.log(` failures: ${failures.length}`);
    failures.slice(0, 10).forEach((f) => console.log(`  - ${f.email}: ${f.error}`));
  }
}

main().catch((err) => {
  console.error(err.response?.data || err.message || err);
  process.exit(1);
});
