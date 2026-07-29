import * as contactsApi from './contacts.js';
import * as leadsApi from './leads.js';
import * as accountsApi from './accounts.js';
import {
  buildPhoneLookupIndex,
  createPhoneLookup,
  extractCloudTalkPhone,
} from '../phoneLookup.js';
import { cloudTalkCallSummary } from './cloudTalkCalls.js';
import { cachedRequest } from '../requestCache.js';

const CACHE_MS = 5 * 60 * 1000;

const CONTACT_PHONE_FIELDS = ['phone', 'mobile', 'other_phone', 'home_phone', 'asst_phone'];
const LEAD_PHONE_FIELDS = ['phone', 'mobile'];
const ACCOUNT_PHONE_FIELDS = ['phone'];

function toIndexRecords(records, entityType, phoneFields) {
  return (records || []).map((record) => ({ record, entityType, phoneFields }));
}

let cachedLookup = null;
let cachedAt = 0;

function buildLookupFromCrm() {
  return cachedRequest('crm-phone-lookup', async () => {
    const [contactsRes, leadsRes, accountsRes] = await Promise.all([
      contactsApi.listAllContacts().catch(() => ({ data: [] })),
      leadsApi.listAllLeads().catch(() => ({ data: [] })),
      accountsApi.listAllAccounts().catch(() => ({ data: [] })),
    ]);

    const index = buildPhoneLookupIndex([
      ...toIndexRecords(accountsRes.data, 'account', ACCOUNT_PHONE_FIELDS),
      ...toIndexRecords(leadsRes.data, 'lead', LEAD_PHONE_FIELDS),
      ...toIndexRecords(contactsRes.data, 'contact', CONTACT_PHONE_FIELDS),
    ]);

    return createPhoneLookup(index);
  }, CACHE_MS);
}

export async function getCrmPhoneLookup({ force = false } = {}) {
  if (!force && cachedLookup && Date.now() - cachedAt < CACHE_MS) {
    return cachedLookup;
  }

  cachedLookup = await buildLookupFromCrm();
  cachedAt = Date.now();
  return cachedLookup;
}

export function invalidateCrmPhoneLookup() {
  cachedLookup = null;
  cachedAt = 0;
}

function cloudTalkLogMeta(log) {
  const cdr = log.meta?.cdr || {};
  const type = String(cdr.type || (log.summary?.includes('Incoming') ? 'incoming' : 'outgoing')).toLowerCase();
  const status = log.summary?.includes('missed') ? 'missed' : 'answered';
  const duration = Number(log.meta?.duration ?? cdr.talking_time ?? cdr.billsec) || 0;
  const phone = extractCloudTalkPhone(log);
  return { type, status, duration, phone };
}

export function enrichActivityLogWithPhoneNames(log, lookup) {
  if (!log || !lookup) return log;

  if (log.source === 'cloudtalk') {
    const existingName = log.meta?.contact_name || log.meta?.contact?.name;
    const { type, status, duration, phone } = cloudTalkLogMeta(log);
    const resolved = existingName ? null : lookup.resolve(phone);
    const contactName = existingName || resolved?.name || null;

    if (contactName && contactName !== existingName) {
      return {
        ...log,
        summary: cloudTalkCallSummary({ type, status, phone, contactName, duration }),
        resolved_contact: resolved || { name: contactName },
      };
    }

    const summary = lookup.replaceInText(log.summary);
    return summary !== log.summary ? { ...log, summary } : log;
  }

  const summary = lookup.replaceInText(log.summary);
  return summary !== log.summary ? { ...log, summary } : log;
}

export function enrichActivityLogsWithPhoneNames(logs, lookup) {
  return (logs || []).map((log) => enrichActivityLogWithPhoneNames(log, lookup));
}
