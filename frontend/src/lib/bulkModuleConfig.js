import * as leadsApi from './services/leads.js';
import * as contactsApi from './services/contacts.js';
import * as accountsApi from './services/accounts.js';
import * as dealsApi from './services/deals.js';
import * as tasksApi from './services/tasks.js';
import * as callsApi from './services/calls.js';
import * as meetingsApi from './services/meetings.js';
import * as campaignsApi from './services/campaigns.js';
import * as documentsApi from './services/documents.js';
import * as visitsApi from './services/visits.js';
import * as projectsApi from './services/projects.js';
import {
  PIPELINE_RAW, PIPELINE_LEAD, PIPELINE_QUALIFIED, PIPELINE_PROPOSAL,
} from './pipelineHelpers.js';

const CONVERT_OPTIONS = [
  { value: PIPELINE_LEAD, label: 'Lead' },
  { value: PIPELINE_QUALIFIED, label: 'Qualified Lead' },
  { value: PIPELINE_PROPOSAL, label: 'Proposal' },
];

export const BULK_MODULE_CONFIG = {
  leads: {
    label: 'Records',
    emailField: 'email',
    statusField: 'lead_status',
    massUpdateFields: ['status', 'convert'],
    convertOptions: CONVERT_OPTIONS,
    update: (id, payload) => leadsApi.updateLead(id, payload),
    convert: (id, target) => leadsApi.advanceLeadStage(id, target, { proposal: target === PIPELINE_PROPOSAL }),
    deleteOne: (id) => leadsApi.deleteLead(id),
    bulkDelete: (ids) => leadsApi.bulkDeleteLeads(ids),
    exportRow: (r) => ({
      first_name: r.first_name, last_name: r.last_name, company: r.company,
      email: r.email, phone: r.phone, status: r.lead_status || r.status, source: r.source,
    }),
    mailingLabel: (r) => `${r.first_name || ''} ${r.last_name || ''}\n${r.company || ''}\n${[r.street, r.city, r.state, r.zip_code || r.zip].filter(Boolean).join(', ')}`,
  },
  'raw-leads': {
    label: 'Records',
    emailField: 'email',
    statusField: 'lead_status',
    massUpdateFields: ['status', 'convert'],
    convertOptions: CONVERT_OPTIONS,
    update: (id, payload) => leadsApi.updateLead(id, payload),
    convert: (id, target) => leadsApi.advanceLeadStage(id, target, { proposal: target === PIPELINE_PROPOSAL }),
    deleteOne: (id) => leadsApi.deleteLead(id),
    bulkDelete: (ids) => leadsApi.bulkDeleteLeads(ids),
    exportRow: (r) => ({
      first_name: r.first_name, last_name: r.last_name, company: r.company,
      email: r.email, phone: r.phone, status: r.lead_status, source: r.source,
    }),
    mailingLabel: (r) => `${r.first_name || ''} ${r.last_name || ''}\n${r.company || ''}`,
  },
  'qualified-leads': {
    label: 'Records',
    emailField: 'email',
    statusField: 'lead_status',
    massUpdateFields: ['status', 'convert'],
    convertOptions: CONVERT_OPTIONS.filter((o) => o.value !== PIPELINE_RAW && o.value !== PIPELINE_LEAD),
    update: (id, payload) => leadsApi.updateLead(id, payload),
    convert: (id, target) => leadsApi.advanceLeadStage(id, target, { proposal: target === PIPELINE_PROPOSAL }),
    deleteOne: (id) => leadsApi.deleteLead(id),
    bulkDelete: (ids) => leadsApi.bulkDeleteLeads(ids),
    exportRow: (r) => ({
      first_name: r.first_name, last_name: r.last_name, company: r.company, email: r.email,
    }),
    mailingLabel: (r) => `${r.first_name || ''} ${r.last_name || ''}\n${r.company || ''}`,
  },
  proposals: {
    label: 'Records',
    emailField: 'email',
    statusField: 'lead_status',
    massUpdateFields: ['status', 'convert'],
    convertOptions: [],
    update: (id, payload) => leadsApi.updateLead(id, payload),
    convert: (id, target) => leadsApi.advanceLeadStage(id, target, { proposal: target === PIPELINE_PROPOSAL }),
    deleteOne: (id) => leadsApi.deleteLead(id),
    bulkDelete: (ids) => leadsApi.bulkDeleteLeads(ids),
    exportRow: (r) => ({
      first_name: r.first_name, last_name: r.last_name, company: r.company, email: r.email,
    }),
    mailingLabel: (r) => `${r.first_name || ''} ${r.last_name || ''}\n${r.company || ''}`,
  },
  contacts: {
    label: 'Records',
    emailField: 'email',
    statusField: null,
    massUpdateFields: [],
    update: () => Promise.resolve(),
    deleteOne: (id) => contactsApi.deleteContact(id),
    exportRow: (r) => ({
      first_name: r.first_name, last_name: r.last_name, email: r.email, phone: r.phone, account: r.account_name,
    }),
    mailingLabel: (r) => `${r.first_name || ''} ${r.last_name || ''}\n${r.account_name || ''}`,
  },
  accounts: {
    label: 'Records',
    emailField: null,
    statusField: 'account_type',
    massUpdateFields: ['status'],
    update: (id, payload) => accountsApi.updateAccount(id, payload),
    deleteOne: (id) => accountsApi.deleteAccount(id),
    exportRow: (r) => ({ name: r.name, industry: r.industry, phone: r.phone, city: r.city, status: r.account_type }),
    mailingLabel: (r) => `${r.name || ''}\n${[r.city, r.state].filter(Boolean).join(', ')}`,
  },
  deals: {
    label: 'Records',
    emailField: null,
    statusField: 'stage',
    massUpdateFields: ['status'],
    update: (id, payload) => dealsApi.updateDeal(id, payload),
    deleteOne: (id) => dealsApi.deleteDeal(id),
    exportRow: (r) => ({ name: r.name, stage: r.stage, amount: r.amount, account: r.account_name }),
    mailingLabel: (r) => `${r.name || ''}\n${r.account_name || ''}`,
  },
  tasks: {
    label: 'Records',
    emailField: null,
    statusField: 'status',
    massUpdateFields: ['status'],
    update: (id, payload) => tasksApi.updateTask(id, payload),
    deleteOne: (id) => tasksApi.deleteTask(id),
    exportRow: (r) => ({ title: r.title, due_date: r.due_date, status: r.status, assigned: r.assigned_name }),
    mailingLabel: (r) => r.title || '',
  },
  calls: {
    label: 'Records',
    statusField: 'call_type',
    massUpdateFields: ['status'],
    update: (id, payload) => callsApi.updateCall(id, payload),
    deleteOne: (id) => callsApi.deleteCall(id),
    exportRow: (r) => ({ subject: r.subject, call_type: r.call_type, date: r.call_date }),
    mailingLabel: (r) => r.subject || '',
  },
  meetings: {
    label: 'Records',
    statusField: null,
    massUpdateFields: [],
    update: () => Promise.resolve(),
    deleteOne: (id) => meetingsApi.deleteMeeting(id),
    exportRow: (r) => ({ title: r.title, from: r.from_time, to: r.to_time }),
    mailingLabel: (r) => r.title || '',
  },
  campaigns: {
    label: 'Records',
    statusField: 'status',
    massUpdateFields: ['status'],
    update: (id, payload) => campaignsApi.updateCampaign(id, payload),
    deleteOne: (id) => campaignsApi.deleteCampaign(id),
    exportRow: (r) => ({ name: r.name, type: r.type, status: r.status }),
    mailingLabel: (r) => r.name || '',
  },
  documents: {
    label: 'Records',
    statusField: null,
    massUpdateFields: [],
    update: () => Promise.resolve(),
    deleteOne: (id) => documentsApi.deleteDocument(id),
    exportRow: (r) => ({ name: r.document_name, type: r.related_entity_type }),
    mailingLabel: (r) => r.document_name || '',
  },
  visits: {
    label: 'Records',
    statusField: 'status',
    massUpdateFields: ['status'],
    update: (id, payload) => visitsApi.updateVisit(id, payload),
    deleteOne: (id) => visitsApi.deleteVisit(id),
    exportRow: (r) => ({ name: r.visit_name, date: r.visit_date, status: r.status }),
    mailingLabel: (r) => r.visit_name || '',
  },
  projects: {
    label: 'Records',
    statusField: 'status',
    massUpdateFields: ['status'],
    update: (id, payload) => projectsApi.updateProject(id, payload),
    deleteOne: (id) => projectsApi.deleteProject(id),
    exportRow: (r) => ({ name: r.project_name, status: r.status }),
    mailingLabel: (r) => r.project_name || '',
  },
};

export function getBulkConfig(moduleKey) {
  return BULK_MODULE_CONFIG[moduleKey] || BULK_MODULE_CONFIG.leads;
}

export async function bulkDeleteRecords(ids, config) {
  if (config.bulkDelete) return config.bulkDelete(ids);
  await Promise.all(ids.map((id) => config.deleteOne(id)));
  return { success_count: ids.length };
}

export function exportRecordsCsv(records, config, filename) {
  const rows = records.map((r) => config.exportRow(r));
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export function printMailingLabels(records, config) {
  const labels = records.map((r) => config.mailingLabel(r)).join('\n\n---\n\n');
  const w = window.open('', '_blank');
  w.document.write(`<pre style="font-family:sans-serif;font-size:14px;padding:24px;">${labels.replace(/\n/g, '<br>')}</pre>`);
  w.document.close();
  w.print();
}

export function sendBulkEmail(records, emailField) {
  const emails = records.map((r) => r[emailField]).filter(Boolean);
  if (!emails.length) return null;
  return `mailto:?bcc=${encodeURIComponent(emails.join(','))}`;
}
