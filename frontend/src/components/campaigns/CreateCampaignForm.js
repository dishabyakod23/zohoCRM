'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CRMLayout from '../layout/CRMLayout.js';
import FormField, { inputClass } from '../forms/FormField.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import { validateRequired } from '../../lib/validators.js';
import * as campaignsApi from '../../lib/services/campaigns.js';
import * as leadsApi from '../../lib/services/leads.js';
import * as contactsApi from '../../lib/services/contacts.js';
import * as accountsApi from '../../lib/services/accounts.js';
import { fetchCampaignTypes, fetchCampaignStatuses, fetchUsers } from '../../lib/services/lookups.js';
import { PIPELINE_RAW, PIPELINE_LEAD, PIPELINE_QUALIFIED, PIPELINE_PROPOSAL } from '../../lib/pipelineHelpers.js';

const RECIPIENT_MODULES = [
  { key: 'contacts', label: 'Contacts' },
  { key: 'raw_leads', label: 'Raw Leads' },
  { key: 'leads', label: 'Leads' },
  { key: 'qualified_leads', label: 'Qualified Leads' },
  { key: 'proposals', label: 'Proposals' },
  { key: 'accounts', label: 'Accounts' },
];

const LEAD_STAGE_BY_MODULE = {
  raw_leads: PIPELINE_RAW,
  leads: PIPELINE_LEAD,
  qualified_leads: PIPELINE_QUALIFIED,
  proposals: PIPELINE_PROPOSAL,
};

/** Fetch selectable {key, member_type, member_id, name, email, module} recipients for the chosen modules. */
async function fetchRecipientPool(modules) {
  const tasks = [];

  if (modules.includes('contacts')) {
    tasks.push(
      contactsApi.listContacts({ page_size: 500 }).then(({ data }) =>
        (data || []).filter((c) => c.email).map((c) => ({
          key: `contact:${c.id}`,
          member_type: 'contact',
          member_id: c.id,
          name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email,
          email: c.email,
          module: 'Contacts',
        }))
      )
    );
  }

  for (const [key, stage] of Object.entries(LEAD_STAGE_BY_MODULE)) {
    if (!modules.includes(key)) continue;
    const label = RECIPIENT_MODULES.find((m) => m.key === key)?.label || key;
    tasks.push(
      leadsApi.listLeads({ pipeline_stage: stage, page_size: 1000 }).then(({ data }) =>
        (data || []).filter((l) => l.email).map((l) => ({
          key: `lead:${l.id}`,
          member_type: 'lead',
          member_id: l.id,
          name: `${l.first_name || ''} ${l.last_name || ''}`.trim() || l.company || l.email,
          email: l.email,
          module: label,
        }))
      )
    );
  }

  if (modules.includes('accounts')) {
    tasks.push(
      accountsApi.listAccounts({ page_size: 500 }).then(({ data }) =>
        (data || []).filter((a) => a.email).map((a) => ({
          key: `account:${a.id}`,
          member_type: 'account',
          member_id: a.id,
          name: a.name || a.account_name || a.email,
          email: a.email,
          module: 'Accounts',
        }))
      )
    );
  }

  const results = await Promise.all(tasks);
  const pool = results.flat();
  const dedup = new Map();
  for (const r of pool) dedup.set(r.key, r);
  return Array.from(dedup.values());
}

export function emptyCampaignForm() {
  return {
    owner_id: '',
    name: '',
    start_date: '',
    expected_revenue: '',
    actual_cost: '',
    numbers_sent: '',
    type: '',
    status: '',
    end_date: '',
    budgeted_cost: '',
    expected_response: '',
    description: '',
  };
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-sm font-semibold text-zoho-text border-b border-zoho-border pb-2 mb-4 mt-8 first:mt-0">
      {children}
    </h3>
  );
}

function RsAmountInput({ value, onChange, error, name }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-zoho-muted shrink-0 w-8">Rs.</span>
      <input
        className={inputClass(error)}
        type="number"
        min={0}
        step="any"
        name={name}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

export default function CreateCampaignForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState(() => ({ ...emptyCampaignForm(), owner_id: user?.id || '' }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  const [recipientModules, setRecipientModules] = useState([]);
  const [recipientPool, setRecipientPool] = useState([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState(() => new Set());

  useEffect(() => {
    if (user?.id && !form.owner_id) {
      setForm((f) => ({ ...f, owner_id: user.id }));
    }
  }, [user?.id, form.owner_id]);

  useEffect(() => {
    if (!recipientModules.length) {
      setRecipientPool([]);
      setSelectedRecipients(new Set());
      return;
    }
    let cancelled = false;
    setRecipientsLoading(true);
    fetchRecipientPool(recipientModules)
      .then((pool) => {
        if (cancelled) return;
        setRecipientPool(pool);
        const poolKeys = new Set(pool.map((r) => r.key));
        setSelectedRecipients((prev) => new Set([...prev].filter((k) => poolKeys.has(k))));
      })
      .catch(() => { if (!cancelled) setRecipientPool([]); })
      .finally(() => { if (!cancelled) setRecipientsLoading(false); });
    return () => { cancelled = true; };
  }, [recipientModules]);

  const toggleRecipientModule = (key) => {
    setRecipientModules((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  const toggleRecipient = (key) => {
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const allRecipientsSelected = recipientPool.length > 0 && selectedRecipients.size === recipientPool.length;

  const toggleSelectAllRecipients = () => {
    setSelectedRecipients(allRecipientsSelected ? new Set() : new Set(recipientPool.map((r) => r.key)));
  };

  useEffect(() => {
    Promise.all([fetchUsers(), fetchCampaignTypes(), fetchCampaignStatuses()])
      .then(([u, t, s]) => {
        setUsers(u);
        setTypeOptions(t);
        setStatusOptions(s);
      })
      .catch(() => {});
  }, []);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setErrors((er) => ({ ...er, [field]: null }));
  };

  const handleSave = async () => {
    const errs = validateRequired(
      {
        name: 'Campaign Name',
        type: 'Type',
        status: 'Status',
        start_date: 'Start Date',
        end_date: 'End Date',
      },
      form,
    );
    setErrors(errs);
    if (Object.keys(errs).length) {
      showToast('Please fill in all required fields before saving.');
      return;
    }
    setSaving(true);
    try {
      const created = await campaignsApi.createCampaign(form);
      const recipients = recipientPool.filter((r) => selectedRecipients.has(r.key));
      if (recipients.length && created?.id) {
        try {
          await campaignsApi.addCampaignMembers(created.id, recipients.map((r) => ({
            member_type: r.member_type,
            member_id: r.member_id,
          })));
          showToast(`Campaign saved with ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}`, 'success');
        } catch (err) {
          showToast(`Campaign saved, but recipients could not be added: ${getApiError(err)}`);
        }
      } else {
        showToast('Campaign saved', 'success');
      }
      router.push(created?.id ? `/campaigns/${created.id}` : '/campaigns');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CRMLayout>
      <div className="p-6 max-w-5xl mx-auto w-full">
        <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-xs font-medium text-zoho-muted hover:text-brand-600 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Campaigns
        </Link>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-zoho-text">Create Campaign</h1>
          <div className="flex gap-2">
            <Link href="/campaigns" className="btn-secondary">Cancel</Link>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Campaign'}
            </button>
          </div>
        </div>

        <div className="card p-6">
          <SectionTitle>Campaign Information</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            <FormField label="Campaign Owner" name="owner_id">
              <select className="input" value={form.owner_id} onChange={set('owner_id')}>
                <option value="">—None—</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Type" required error={errors.type} name="type">
              <select className={inputClass(errors.type)} value={form.type} onChange={set('type')}>
                <option value="">—None—</option>
                {typeOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Campaign Name" required error={errors.name} name="name">
              <input className={inputClass(errors.name)} value={form.name} onChange={set('name')} />
            </FormField>

            <FormField label="Status" required error={errors.status} name="status">
              <select className={inputClass(errors.status)} value={form.status} onChange={set('status')}>
                <option value="">—None—</option>
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Start Date" required error={errors.start_date} name="start_date">
              <input
                className={inputClass(errors.start_date)}
                type="date"
                title="DD/MM/YYYY"
                value={form.start_date?.slice(0, 10) || ''}
                onChange={set('start_date')}
              />
            </FormField>

            <FormField label="End Date" required error={errors.end_date} name="end_date">
              <input
                className={inputClass(errors.end_date)}
                type="date"
                title="DD/MM/YYYY"
                value={form.end_date?.slice(0, 10) || ''}
                onChange={set('end_date')}
              />
            </FormField>

            <FormField label="Expected Revenue" name="expected_revenue">
              <RsAmountInput value={form.expected_revenue} onChange={set('expected_revenue')} name="expected_revenue" />
            </FormField>

            <FormField label="Budgeted Cost" name="budgeted_cost">
              <RsAmountInput value={form.budgeted_cost} onChange={set('budgeted_cost')} name="budgeted_cost" />
            </FormField>

            <FormField label="Actual Cost" name="actual_cost">
              <RsAmountInput value={form.actual_cost} onChange={set('actual_cost')} name="actual_cost" />
            </FormField>

            <FormField label="Expected Response" name="expected_response">
              <input className="input" type="number" min={0} step="any" value={form.expected_response} onChange={set('expected_response')} />
            </FormField>

            <FormField label="Numbers sent" name="numbers_sent">
              <input className="input" type="number" min={0} step={1} value={form.numbers_sent} onChange={set('numbers_sent')} />
            </FormField>
          </div>

          <SectionTitle>Campaign Recipients</SectionTitle>
          <p className="text-xs text-zoho-muted -mt-2 mb-3">
            Choose which modules to pull recipients from, then select the emails that should be added to this campaign.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mb-4">
            {RECIPIENT_MODULES.map((m) => (
              <label key={m.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  checked={recipientModules.includes(m.key)}
                  onChange={() => toggleRecipientModule(m.key)}
                />
                <span className="text-sm text-zoho-text">{m.label}</span>
              </label>
            ))}
          </div>

          {recipientModules.length > 0 && (
            recipientsLoading ? (
              <p className="text-sm text-zoho-muted py-4">Loading recipients…</p>
            ) : recipientPool.length === 0 ? (
              <p className="text-sm text-zoho-muted py-4">No emails found for the selected module(s).</p>
            ) : (
              <div className="border border-zoho-border rounded-lg overflow-hidden">
                <label className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-b border-zoho-border cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    checked={allRecipientsSelected}
                    onChange={toggleSelectAllRecipients}
                  />
                  <span className="text-sm font-medium text-zoho-text">
                    All recipients ({selectedRecipients.size}/{recipientPool.length} selected)
                  </span>
                </label>
                <div className="max-h-64 overflow-y-auto divide-y divide-zoho-border">
                  {recipientPool.map((r) => (
                    <label key={r.key} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        checked={selectedRecipients.has(r.key)}
                        onChange={() => toggleRecipient(r.key)}
                      />
                      <span className="text-sm text-zoho-text">{r.name}</span>
                      <span className="text-xs text-zoho-muted ml-auto shrink-0">{r.email}</span>
                      <span className="text-[10px] uppercase tracking-wide text-brand-600 bg-brand-50 rounded px-1.5 py-0.5 shrink-0">{r.module}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          )}

          <SectionTitle>Description Information</SectionTitle>
          <FormField label="Description" name="description">
            <textarea className="input min-h-[120px] w-full" value={form.description} onChange={set('description')} />
          </FormField>
        </div>
      </div>
    </CRMLayout>
  );
}
