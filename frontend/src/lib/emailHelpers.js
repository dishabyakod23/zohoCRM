import * as leadsApi from './services/leads.js';
import * as contactsApi from './services/contacts.js';
import { DEFAULT_PAGE_SIZE } from './constants.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sameEmail(a, b) {
  return normalizeEmail(a) === normalizeEmail(b);
}

function isForbidden(err) {
  return err?.response?.status === 403;
}

async function searchLeadsForEmail(params) {
  try {
    return await leadsApi.listLeads(params);
  } catch (err) {
    if (isForbidden(err)) return { data: [] };
    throw err;
  }
}

async function searchContactsForEmail(params) {
  try {
    return await contactsApi.listContacts(params);
  } catch (err) {
    if (isForbidden(err)) return { data: [] };
    throw err;
  }
}

/**
 * Find an existing lead or contact using this email (case-insensitive).
 *
 * - excludeLeadId: only check other leads (contacts may share a synced copy)
 * - excludeContactId: only check other contacts
 * - checkLeads / checkContacts: skip modules the user cannot list (avoids 403 on save)
 */
export async function findEmailConflict(email, {
  excludeLeadId,
  excludeContactId,
  checkLeads = true,
  checkContacts = true,
} = {}) {
  const needle = normalizeEmail(email);
  if (!needle) return null;

  const onlyLeads = !!excludeLeadId && !excludeContactId;
  const onlyContacts = !!excludeContactId && !excludeLeadId;
  const shouldCheckLeads = checkLeads && (onlyLeads || !onlyContacts);
  const shouldCheckContacts = checkContacts && (onlyContacts || !onlyLeads);

  const [leadsRes, contactsRes] = await Promise.all([
    shouldCheckLeads
      ? searchLeadsForEmail({ search: email.trim(), page_size: DEFAULT_PAGE_SIZE })
      : Promise.resolve({ data: [] }),
    shouldCheckContacts
      ? searchContactsForEmail({ search: email.trim(), page_size: DEFAULT_PAGE_SIZE })
      : Promise.resolve({ data: [] }),
  ]);

  if (shouldCheckLeads) {
    const lead = leadsRes.data.find(
      (r) => sameEmail(r.email, needle) && String(r.id) !== String(excludeLeadId || ''),
    );
    if (lead) {
      return {
        module: 'lead',
        id: lead.id,
        name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.company,
      };
    }
  }

  if (shouldCheckContacts) {
    const contact = contactsRes.data.find(
      (r) => sameEmail(r.email, needle) && String(r.id) !== String(excludeContactId || ''),
    );
    if (contact) {
      return {
        module: 'contact',
        id: contact.id,
        name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
      };
    }
  }

  return null;
}

/** Returns an error message when email is already in use, or null if available. */
export async function validateEmailUnique(email, options = {}) {
  const conflict = await findEmailConflict(email, options);
  if (!conflict) return null;
  const moduleLabel = conflict.module === 'lead' ? 'lead' : 'contact';
  return `A ${moduleLabel} with this email already exists.`;
}
