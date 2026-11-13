'use client';
import { useEffect, useState } from 'react';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import Badge from '../../../components/ui/Badge.js';
import RecordDetailLayout from '../../../components/records/RecordDetailLayout.js';
import RecordDetailSkeleton from '../../../components/records/RecordDetailSkeleton.js';
import RecordDetailLink from '../../../components/records/RecordDetailLink.js';
import { useToast } from '../../../components/ui/Toast.js';
import { useRecordId, isValidRecordId } from '../../../hooks/useRecordId.js';
import { navigateToRecord } from '../../../lib/recordNavigation.js';
import * as leadsApi from '../../../lib/services/leads.js';
import * as accountsApi from '../../../lib/services/accounts.js';
import { proposalsForAccount, accountProjectHref } from '../../../lib/accountProposalRows.js';
import { proposalDealStatusLabel, proposalTypeLabel } from '../../../lib/pipelineHelpers.js';
import { formatMoney } from '../../../lib/currencies.js';

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
};

const money = (value, currency) => (value == null || value === '' ? '—' : formatMoney(value, currency));

const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

function Stat({ label, value }) {
  return (
    <div className="card px-4 py-3 min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-zoho-muted font-medium">{label}</p>
      <p className="text-base font-semibold text-zoho-text truncate mt-0.5" title={String(value)}>{value}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wider text-zoho-muted font-medium">{label}</dt>
      <dd className="text-sm text-zoho-text mt-0.5 break-words">{children || '—'}</dd>
    </div>
  );
}

/**
 * A project of an account: a proposal that was converted into that account. It is still a lead
 * record on the server, shown here read-only so it opens inside Accounts, not as a proposal.
 * URL: /accounts/project/?id=<lead id> (a static page, so no server rewrite rule is needed).
 */
export default function AccountProjectPage() {
  const id = useRecordId();
  const { showToast } = useToast();
  const [project, setProject] = useState(null);
  const [account, setAccount] = useState(null);
  const [siblings, setSiblings] = useState([]);

  useEffect(() => {
    if (!isValidRecordId(id)) {
      navigateToRecord('/accounts');
      return undefined;
    }
    let cancelled = false;
    setProject(null);
    leadsApi.getLead(id)
      .then(async (lead) => {
        if (cancelled) return;
        setProject(lead);
        const [converted, accountResult] = await Promise.all([
          leadsApi.listConvertedProposals().catch(() => []),
          lead.company
            ? accountsApi.listAccounts({ search: lead.company, page_size: 50 }).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
        ]);
        if (cancelled) return;
        setSiblings(proposalsForAccount({ name: lead.company }, converted));
        setAccount((accountResult.data || []).find((a) => sameName(a.name || a.account_name, lead.company)) || null);
      })
      .catch(() => {
        if (cancelled) return;
        showToast('Project not found');
        navigateToRecord('/accounts');
      });
    return () => { cancelled = true; };
  }, [id, showToast]);

  if (!project) return <CRMLayout><RecordDetailSkeleton /></CRMLayout>;

  const index = siblings.findIndex((p) => String(p.id) === String(project.id));
  const number = index >= 0 ? index + 1 : 1;
  const accountName = account?.name || project.company || 'Account';
  const currency = project.currency || account?.currency;
  const contactName = `${project.first_name || ''} ${project.last_name || ''}`.trim();
  const others = siblings.filter((p) => String(p.id) !== String(project.id));

  return (
    <CRMLayout>
      <RecordDetailLayout
        backHref={account?.id ? `/accounts/${account.id}` : '/accounts'}
        backLabel={account?.id ? accountName : 'Accounts'}
        title={project.proposal_name || `Project ${number}`}
        subtitle={`Project ${number} · ${accountName}`}
        avatarLabel={`P${number}`}
        tabs={['Overview']}
        badges={(
          <>
            {project.deal_status && <Badge label={project.deal_status_label || proposalDealStatusLabel(project.deal_status)} />}
            {project.proposal_type && <Badge label={project.proposal_type_label || proposalTypeLabel(project.proposal_type)} />}
          </>
        )}
        lastUpdated={project.updated_at ? new Date(project.updated_at).toLocaleString() : undefined}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Deal Size" value={money(project.deal_size ?? project.proposal_amount, currency)} />
            <Stat label="AMC / IT Support" value={money(project.amc_it_support, project.amc_currency || currency)} />
            <Stat label="Proposal Date" value={formatDate(project.proposal_date)} />
            <Stat label="Closure Date" value={formatDate(project.closure_date)} />
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-zoho-text mb-3">Project Details</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Project Name">{project.proposal_name}</Field>
              <Field label="Account">
                {account?.id ? (
                  <RecordDetailLink href={`/accounts/${account.id}`} className="text-brand-600 hover:underline">{accountName}</RecordDetailLink>
                ) : accountName}
              </Field>
              <Field label="Proposal Type">{project.proposal_type ? project.proposal_type_label || proposalTypeLabel(project.proposal_type) : ''}</Field>
              <Field label="Owner">{project.owner_name}</Field>
              <Field label="Became an account on">{project.converted_at ? formatDate(project.converted_at) : ''}</Field>
            </dl>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-zoho-text mb-2">Description</h3>
            <p className="text-sm text-zoho-text whitespace-pre-wrap">
              {project.proposal_description || <span className="text-zoho-muted">No description added.</span>}
            </p>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-zoho-text mb-3">Client Contact</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
              <Field label="Name">{contactName}</Field>
              <Field label="Email">{project.email}</Field>
              <Field label="Phone">{project.phone || project.mobile}</Field>
            </dl>
          </div>

          {others.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-zoho-text mb-3">Other projects of {accountName}</h3>
              <ul className="divide-y divide-zoho-border">
                {others.map((p) => {
                  const n = siblings.findIndex((s) => String(s.id) === String(p.id)) + 1;
                  return (
                    <li key={p.id} className="py-2 flex items-center justify-between gap-4 text-sm">
                      <RecordDetailLink href={accountProjectHref(p.id)} className="font-medium text-brand-600 hover:underline truncate">
                        {`Project ${n}`}{p.proposal_name ? ` — ${p.proposal_name}` : ''}
                      </RecordDetailLink>
                      <span className="text-zoho-muted shrink-0">{money(p.deal_size ?? p.proposal_amount, p.currency || currency)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </RecordDetailLayout>
    </CRMLayout>
  );
}
