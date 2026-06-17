import * as leadsApi from './services/leads.js';
import * as contactsApi from './services/contacts.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sameEmail(a, b) {
  return normalizeEmail(a) === normalizeEmail(b);
}

/** Find an existing lead or contact using this email (case-insensitive). */
export async function findEmailConflict(email, { excludeLeadId, excludeContactId } = {}) {
  const needle = normalizeEmail(email);
  if (!needle) return null;

  const [leadsRes, contactsRes] = await Promise.all([
    leadsApi.listLeads({ search: email.trim(), page_size: 50 }),
    contactsApi.listContacts({ search: email.trim(), page_size: 50 }),
  ]);

  const lead = leadsRes.data.find(
    (r) => sameEmail(r.email, needle) && String(r.id) !== String(excludeLeadId),
  );
  if (lead) {
    return {
      module: 'lead',
      id: lead.id,
      name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.company,
    };
  }

  const contact = contactsRes.data.find(
    (r) => sameEmail(r.email, needle) && String(r.id) !== String(excludeContactId),
  );
  if (contact) {
    return {
      module: 'contact',
      id: contact.id,
      name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
    };
  }

  return null;
}

/** Returns an error message when email is already in use, or null if available. */
export async function validateEmailUnique(email, { excludeLeadId, excludeContactId } = {}) {
  const conflict = await findEmailConflict(email, { excludeLeadId, excludeContactId });
  if (!conflict) return null;
  const moduleLabel = conflict.module === 'lead' ? 'lead' : 'contact';
  return `A ${moduleLabel} with this email already exists.`;
}
