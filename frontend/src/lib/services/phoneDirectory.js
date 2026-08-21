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
let cachedIncludeAccounts = true;

function buildLookupFromCrm({ includeAccounts = true } = {}) {
  const cacheKey = includeAccounts ? 'crm-phone-lookup' : 'crm-phone-lookup:people';
  return cachedRequest(cacheKey, async () => {
    const tasks = [
      contactsApi.listAllContacts().catch(() => ({ data: [] })),
      leadsApi.listAllLeads().catch(() => ({ data: [] })),
    ];
    if (includeAccounts) {
      tasks.push(accountsApi.listAllAccounts().catch(() => ({ data: [] })));
    }

    const [contactsRes, leadsRes, accountsRes] = await Promise.all(tasks);

    const index = buildPhoneLookupIndex([
      ...(includeAccounts
        ? toIndexRecords(accountsRes?.data, 'account', ACCOUNT_PHONE_FIELDS)
        : []),
      ...toIndexRecords(leadsRes.data, 'lead', LEAD_PHONE_FIELDS),
      ...toIndexRecords(contactsRes.data, 'contact', CONTACT_PHONE_FIELDS),
    ]);

    return createPhoneLookup(index);
  }, CACHE_MS);
}

export async function getCrmPhoneLookup({ force = false, includeAccounts = true } = {}) {
  if (
    !force
    && cachedLookup
    && cachedIncludeAccounts === includeAccounts
    && Date.now() - cachedAt < CACHE_MS
  ) {
    return cachedLookup;
  }

  cachedLookup = await buildLookupFromCrm({ includeAccounts });
  cachedIncludeAccounts = includeAccounts;
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
    const callerName = log.user_name || resolved?.owner_name || null;

    if (contactName || resolved) {
      return {
        ...log,
        summary: cloudTalkCallSummary({
          type,
          status,
          phone,
          contactName,
          duration,
          callerName,
        }),
        resolved_contact: resolved || (contactName ? { name: contactName, id: resolved?.id || null } : null),
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
