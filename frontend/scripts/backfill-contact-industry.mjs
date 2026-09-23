/**
 * Backfill Industry onto existing contacts (and matching leads) from a CSV.
 * Does not re-import records — matches by email and PATCHes only.
 *
 * Usage (from sale-crm/ or frontend/):
 *   set CRM_API_URL=https://salescrm-api.duckdns.org/api/v1
 *   set CRM_API_EMAIL=you@origami.dev
 *   set CRM_API_PASSWORD=your-password
 * 
 *   node scripts/backfill-contact-industry.mjs "path\to\file.csv"
 *
 * Optional:
 *   CRM_API_TOKEN=...     skip login
 *   CRM_DRY_RUN=1         print matches only, no PATCH
 *   CRM_FORCE=1           overwrite records that already have industry
 *   CRM_SKIP_LEADS=1      only patch contacts
 */
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const API_BASE = (process.env.CRM_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://salescrm-api.duckdns.org/api/v1')
  .replace(/\/$/, '');
const DRY_RUN = process.env.CRM_DRY_RUN === '1' || process.env.CRM_DRY_RUN === 'true';
const FORCE = process.env.CRM_FORCE === '1' || process.env.CRM_FORCE === 'true';
const SKIP_LEADS = process.env.CRM_SKIP_LEADS === '1' || process.env.CRM_SKIP_LEADS === 'true';

const EMAIL_ALIASES = new Set(['email', 'e-mail', 'email address', 'email_address', 'work email']);
const INDUSTRY_ALIASES = new Set([
  'industry',
  'industry_type',
  'industry type',
  'sector',
  'vertical',
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

async function listAll(api, pathName) {
  const all = [];
  let page = 1;
  const pageSize = 100;
  for (;;) {
    const res = await api.get(pathName, { params: { page, page_size: pageSize } });
    const rows = res.data?.data || [];
    all.push(...rows);
    const total = res.data?.meta?.total ?? all.length;
    if (!rows.length || all.length >= total) break;
    page += 1;
  }
  return all;
}

async function patchByEmail({
  label, records, fromCsv, api, pathName,
}) {
  let matched = 0;
  let patched = 0;
  let skippedHasValue = 0;
  let missing = 0;
  const failures = [];

  for (const [email, industry] of fromCsv.entries()) {
    const record = records.find((r) => String(r.email || '').trim().toLowerCase() === email);
    if (!record) {
      missing += 1;
      continue;
    }
    matched += 1;
    const existing = String(record.industry || '').trim();
    if (existing && !FORCE) {
      skippedHasValue += 1;
      continue;
    }
    if (DRY_RUN) {
      console.log(`[dry-run] ${label} would set ${email} -> ${industry}`);
      patched += 1;
      continue;
    }
    try {
      await api.patch(`${pathName}/${record.id}`, { industry });
      patched += 1;
      console.log(`patched ${label} ${email} -> ${industry}`);
    } catch (err) {
      failures.push({ email, error: err.response?.data?.message || err.message });
    }
  }

  return { matched, patched, skippedHasValue, missing, failures };
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node scripts/backfill-contact-industry.mjs <path-to-csv>');
    process.exit(1);
  }
  const abs = path.resolve(csvPath);
  if (!fs.existsSync(abs)) {
    console.error(`CSV not found: ${abs}`);
    process.exit(1);
  }

  const { headers, records } = parseCsv(fs.readFileSync(abs, 'utf8'));
  const emailCol = findColumn(headers, EMAIL_ALIASES);
  const industryCol = findColumn(headers, INDUSTRY_ALIASES);
  if (!emailCol) {
    console.error(`No email column found. Headers: ${headers.join(', ')}`);
    process.exit(1);
  }
  if (!industryCol) {
    console.error(`No industry column found. Headers: ${headers.join(', ')}`);
    process.exit(1);
  }

  const fromCsv = new Map();
  for (const row of records) {
    const email = String(row[emailCol] || '').trim().toLowerCase();
    const industry = String(row[industryCol] || '').trim();
    if (!email || !industry) continue;
    if (!fromCsv.has(email)) fromCsv.set(email, industry);
  }

  console.log(`API: ${API_BASE}`);
  console.log(`CSV rows with Industry: ${fromCsv.size}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'PATCH'}${FORCE ? ' (force overwrite)' : ' (skip if industry set)'}`);

  const token = await login();
  const api = axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${token}` },
  });

  const contacts = await listAll(api, '/contacts');
  console.log(`Contacts in CRM: ${contacts.length}`);
  const contactStats = await patchByEmail({
    label: 'contact',
    records: contacts,
    fromCsv,
    api,
    pathName: '/contacts',
  });

  let leadStats = null;
  if (!SKIP_LEADS) {
    const leads = await listAll(api, '/leads');
    console.log(`Leads in CRM: ${leads.length}`);
    leadStats = await patchByEmail({
      label: 'lead',
      records: leads,
      fromCsv,
      api,
      pathName: '/leads',
    });
  }

  console.log('\nContacts');
  console.log(` matched: ${contactStats.matched}`);
  console.log(` patched: ${contactStats.patched}`);
  console.log(` skipped (already had industry): ${contactStats.skippedHasValue}`);
  console.log(` CSV emails not found: ${contactStats.missing}`);
  if (contactStats.failures.length) {
    console.log(` failures: ${contactStats.failures.length}`);
    contactStats.failures.slice(0, 10).forEach((f) => console.log(`  - ${f.email}: ${f.error}`));
  }

  if (leadStats) {
    console.log('\nLeads');
    console.log(` matched: ${leadStats.matched}`);
    console.log(` patched: ${leadStats.patched}`);
    console.log(` skipped (already had industry): ${leadStats.skippedHasValue}`);
    console.log(` CSV emails not found: ${leadStats.missing}`);
    if (leadStats.failures.length) {
      console.log(` failures: ${leadStats.failures.length}`);
      leadStats.failures.slice(0, 10).forEach((f) => console.log(`  - ${f.email}: ${f.error}`));
    }
  }
}

main().catch((err) => {
  console.error(err.response?.data || err.message || err);
  process.exit(1);
});
