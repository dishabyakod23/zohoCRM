/**
 * Create Origami team contacts, a test sequence, enroll members, and verify Resend.
 *
 * Usage (from frontend/):
 *   set CRM_API_EMAIL=you@origami.dev
 *   set CRM_API_PASSWORD=your-password
 *   node scripts/setup-sequence-test.mjs
 *
 * Optional:
 *   CRM_API_TOKEN=...           (skip login)
 *   CRM_SENDING_EMAIL=disha@origami.dev
 *   CRM_SEQUENCE_NAME=Origami Resend Test
 *   CRM_DRY_RUN=1               (health + auth only)
 */
import axios from 'axios';

const API_BASE = process.env.CRM_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://salescrm-api.duckdns.org/api/v1';
const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');
const TIMEZONE = 'Asia/Kolkata';
const SEND_FROM = process.env.CRM_SENDING_EMAIL || 'disha@origami.dev';
const SEQUENCE_NAME = process.env.CRM_SEQUENCE_NAME || `Origami Resend Test ${new Date().toISOString().slice(0, 10)}`;
const EXISTING_SEQUENCE_ID = process.env.CRM_SEQUENCE_ID || '';
const DEFAULT_COMPANY = process.env.CRM_CONTACT_COMPANY || 'Origami';

const TEAM = [
  { name: 'Vishwanath Kolachana', email: 'vishwanath@origami.dev' },
  { name: 'Disha Byakod', email: 'disha@origami.dev' },
  { name: 'Satesh Kumar Reddy', email: 'Satesh@origami.dev' },
  { name: 'Ashwin Snafz', email: 'ashwin@origami.dev' },
  { name: 'Srinadh Abburi', email: 'srinadh@origami.dev' },
  { name: 'Akshay Rajkumar', email: 'akshayrajkumar@origami.dev' },
  { name: 'Gajendra Tana', email: 'gajendra@origami.dev' },
  { name: 'Manjula BusiReddy', email: 'Manjula@origami.dev' },
  { name: 'Abhishek', email: 'abhishek@origami.dev' },
  { name: 'Abhaya Saxena', email: 'abhaya@origami.dev' },
  { name: 'Sudeep', email: 'sudeep@origami.dev' },
  { name: 'Manjunath', email: 'manjunath@origami.dev' },
  { name: 'Kavya G N', email: 'kavya@origami.dev' },
  { name: 'Shangasri', email: 'shangasri@origami.dev' },
];

function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first_name: parts[0] || 'Contact', last_name: '.' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

function normalizeScheduledTime(time) {
  if (!time) return null;
  const parts = String(time).trim().split(':');
  if (parts.length < 2) return null;
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${(parts[2] || '00').padStart(2, '0')}`;
}

function buildScheduledAtIso(scheduledDate, scheduledTime, timezone) {
  if (!scheduledDate || !scheduledTime) return null;
  const time = normalizeScheduledTime(scheduledTime);
  if (!time) return null;
  const tz = timezone || 'UTC';
  const [year, month, day] = scheduledDate.split('-').map(Number);
  const [hour, minute, second] = time.split(':').map(Number);
  if (!year || !month || !day) return null;

  let guessMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  for (let i = 0; i < 4; i += 1) {
    const partsObj = Object.fromEntries(
      formatter.formatToParts(new Date(guessMs)).map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(
      Number(partsObj.year),
      Number(partsObj.month) - 1,
      Number(partsObj.day),
      Number(partsObj.hour),
      Number(partsObj.minute),
      Number(partsObj.second),
    );
    guessMs += Date.UTC(year, month - 1, day, hour, minute, second) - asUtc;
  }
  return new Date(guessMs).toISOString();
}

function scheduleInMinutes(minutesFromNow, tz = TIMEZONE) {
  const target = new Date(Date.now() + minutesFromNow * 60_000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(target).map((p) => [p.type, p.value]),
  );
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${hour}:${parts.minute}:${parts.second}`;
  return {
    scheduled_date: date,
    scheduled_time: `${hour}:${parts.minute}`,
    scheduled_at: buildScheduledAtIso(date, time, tz),
  };
}

function unwrap(res) {
  return res?.data?.data ?? res?.data ?? res;
}

function apiError(err) {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail ?? err?.response?.data?.message ?? err.message;
  return `[${status || 'ERR'}] ${typeof detail === 'object' ? JSON.stringify(detail) : detail}`;
}

async function login() {
  const token = process.env.CRM_API_TOKEN;
  if (token) return token;

  const email = process.env.CRM_API_EMAIL;
  const password = process.env.CRM_API_PASSWORD;
  if (!email || !password) {
    throw new Error('Set CRM_API_EMAIL + CRM_API_PASSWORD or CRM_API_TOKEN');
  }

  const res = await axios.post(`${API_BASE}/auth/login`, { email, password }, { timeout: 60_000 });
  const payload = unwrap(res);
  if (!payload?.access_token) throw new Error('Login succeeded but no access_token returned');
  console.log(`Logged in as ${payload.user?.email || email} (${payload.user?.role || 'unknown role'})`);
  return payload.access_token;
}

function client(token) {
  return axios.create({
    baseURL: API_BASE,
    timeout: 60_000,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
}

async function checkHealth() {
  const res = await axios.get(`${API_ORIGIN}/health`, { timeout: 15_000 });
  const h = res.data || {};
  console.log('\n=== API / Resend health ===');
  console.log(JSON.stringify(h, null, 2));
  const ok = h.resend_configured === true && h.sequence_email_provider === 'resend';
  if (!ok) console.warn('WARNING: Resend may not be fully configured on the API.');
  if (h.sequence_scheduler_enabled !== true) console.warn('WARNING: sequence_scheduler_enabled is false — scheduled sends may not run.');
  return h;
}

async function findContactByEmail(api, email) {
  const res = await api.get('/contacts', { params: { search: email, page: 1, page_size: 20 } });
  const rows = res.data?.data || [];
  const needle = email.toLowerCase();
  return rows.find((r) => String(r.email || '').toLowerCase() === needle) || null;
}

async function ensureContacts(api) {
  console.log('\n=== Contacts ===');
  const created = [];
  for (const person of TEAM) {
    const existing = await findContactByEmail(api, person.email);
    if (existing?.id) {
      console.log(`  exists  ${person.email} → ${existing.id}`);
      created.push({ ...person, id: existing.id });
      continue;
    }
    const { first_name, last_name } = splitName(person.name);
    try {
      const res = await api.post('/contacts', {
        first_name,
        last_name,
        email: person.email,
        company_name: DEFAULT_COMPANY,
        lead_source: 'Other',
      });
      const row = unwrap(res);
      console.log(`  created ${person.email} → ${row.id}`);
      created.push({ ...person, id: row.id });
    } catch (err) {
      console.error(`  FAILED  ${person.email}: ${apiError(err)}`);
    }
  }
  return created;
}

async function setupSequence(api, ownerId) {
  if (EXISTING_SEQUENCE_ID) {
    console.log(`\n=== Sequence (existing ${EXISTING_SEQUENCE_ID}) ===`);
    const seqRes = await api.get(`/sequences/${EXISTING_SEQUENCE_ID}`);
    const sequence = unwrap(seqRes);
    const stepsRes = await api.get(`/sequences/${EXISTING_SEQUENCE_ID}/steps`);
    const steps = unwrap(stepsRes);
    const step = Array.isArray(steps) ? steps[0] : steps?.steps?.[0];
    return { sequence, step, schedule: null };
  }

  console.log('\n=== Sequence ===');
  const schedule = scheduleInMinutes(2);
  const seqRes = await api.post('/sequences', {
    name: SEQUENCE_NAME,
    description: 'Automated Resend integration test for Origami team contacts',
    sending_email: SEND_FROM,
    timezone: TIMEZONE,
    send_window_start: '00:00',
    send_window_end: '23:59',
    send_days: 127,
    daily_send_limit: 500,
    stop_on_reply: false,
    stop_on_click: false,
    stop_on_unsubscribe: true,
    stop_on_bounce: false,
    allow_re_enrollment: true,
    owner_id: ownerId || null,
  });
  const sequence = unwrap(seqRes);
  console.log(`  created sequence ${sequence.id} — ${sequence.name}`);

  const stepRes = await api.post(`/sequences/${sequence.id}/steps`, {
    step_order: 1,
    type: 'AUTO_EMAIL',
    scheduled_date: schedule.scheduled_date,
    scheduled_time: schedule.scheduled_time,
    timezone: TIMEZONE,
    scheduled_at: schedule.scheduled_at,
    subject: 'Origami CRM — Resend sequence test',
    html_body: `<p>Hi {{first_name}},</p><p>This is a <strong>test email</strong> from the Origami Sales CRM sequence engine (Resend).</p><p>If you received this, delivery is working. Open/click/bounce events should appear in sequence analytics after Resend webhooks fire.</p><p>— CRM test script</p>`,
    text_body: 'Hi — this is a Resend sequence test from Origami Sales CRM.',
    active: true,
  });
  const step = unwrap(stepRes);
  console.log(`  created step 1 (${step.id}) scheduled ${schedule.scheduled_date} ${schedule.scheduled_time} ${TIMEZONE}`);

  await api.post(`/sequences/${sequence.id}/activate`);
  console.log('  activated sequence');

  return { sequence, step, schedule };
}

async function enrollAndTrigger(api, sequenceId, contacts) {
  console.log('\n=== Enroll & trigger ===');
  const members = contacts.filter((c) => c.id).map((c) => ({
    member_type: 'contact',
    member_id: c.id,
  }));
  if (!members.length) throw new Error('No contact IDs to enroll');

  await api.post(`/sequences/${sequenceId}/enroll`, { members });
  console.log(`  enrolled ${members.length} contacts`);

  const enrollRes = await api.get(`/sequences/${sequenceId}/enrollments`, { params: { page: 1, page_size: 100 } });
  const enrollments = enrollRes.data?.data || [];
  const nowIso = new Date(Date.now() - 30_000).toISOString();

  for (const row of enrollments) {
    const id = row.id || row.enrollment_id;
    if (!id) continue;
    try {
      await api.patch(`/enrollments/${id}`, { next_action_at: nowIso });
      console.log(`  next_action_at=now for ${row.member_name || id}`);
    } catch (err) {
      console.warn(`  could not patch enrollment ${id}: ${apiError(err)}`);
    }
  }

  return enrollments;
}

async function sendTestEmails(api, sequenceId, contacts) {
  console.log('\n=== Send-test (immediate) ===');
  const results = [];
  for (const person of contacts) {
    if (!person.email) continue;
    try {
      const res = await api.post(`/sequences/${sequenceId}/send-test`, {
        to_email: person.email,
        subject: 'Origami CRM — immediate Resend test',
        html_body: `<p>Hi ${splitName(person.name).first_name},</p><p>Immediate send-test from sequence setup script.</p>`,
      });
      results.push({ email: person.email, ok: true, data: unwrap(res) });
      console.log(`  sent test → ${person.email}`);
    } catch (err) {
      results.push({ email: person.email, ok: false, error: apiError(err) });
      console.error(`  FAILED test → ${person.email}: ${apiError(err)}`);
    }
  }
  return results;
}

async function pollStats(api, sequenceId, attempts = 6) {
  console.log('\n=== Analytics (polling) ===');
  let last = null;
  for (let i = 0; i < attempts; i += 1) {
    if (i > 0) await new Promise((r) => setTimeout(r, 20_000));
    try {
      const res = await api.get(`/sequences/${sequenceId}/stats`);
      last = unwrap(res);
      console.log(`  poll ${i + 1}: sent=${last.sent ?? 0} delivered=${last.delivered ?? 0} opened=${last.opened ?? 0} bounced=${last.bounced ?? 0} pending=${last.pending ?? '?'}`);
      if ((last.sent ?? 0) > 0) break;
    } catch (err) {
      console.warn(`  stats poll failed: ${apiError(err)}`);
    }
  }
  return last;
}

async function main() {
  console.log(`API: ${API_BASE}`);
  const health = await checkHealth();
  const token = await login();
  if (process.env.CRM_DRY_RUN === '1') {
    console.log('\nCRM_DRY_RUN=1 — stopping after auth.');
    return;
  }

  const api = client(token);
  const me = unwrap(await api.get('/auth/me'));
  const contacts = await ensureContacts(api);
  const { sequence, step } = await setupSequence(api, me?.id);
  await enrollAndTrigger(api, sequence.id, contacts);
  const testResults = await sendTestEmails(api, sequence.id, contacts);
  const stats = await pollStats(api, sequence.id);

  console.log('\n=== Summary ===');
  console.log(`Sequence ID: ${sequence.id}`);
  console.log(`Step ID: ${step.id}`);
  console.log(`Contacts: ${contacts.filter((c) => c.id).length}/${TEAM.length}`);
  console.log(`Send-test OK: ${testResults.filter((r) => r.ok).length}/${testResults.length}`);
  console.log(`Resend on API: ${health.resend_configured ? 'yes' : 'no'} | scheduler: ${health.sequence_scheduler_enabled ? 'yes' : 'no'}`);
  if (stats) {
    console.log(`Stats: sent=${stats.sent ?? 0} delivered=${stats.delivered ?? 0} opened=${stats.opened ?? 0} bounced=${stats.bounced ?? 0}`);
    console.log('Open the sequence Analytics tab in CRM to see step funnel + bounce reasons after webhooks arrive.');
  }
  console.log('\nResend dashboard: https://resend.com/emails — filter by recipient @origami.dev');
  console.log('Webhook endpoint should be: POST https://salescrm-api.duckdns.org/api/v1/webhooks/email/resend');
}

main().catch((err) => {
  console.error('\nFATAL:', err.message || err);
  process.exit(1);
});
