'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AppLink from '../ui/AppLink.js';
import CRMLayout from '../layout/CRMLayout.js';
import FormField from '../forms/FormField.js';
import { useToast } from '../ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import { CURRENCIES, DEFAULT_CURRENCY, formatIndianCompact } from '../../lib/currencies.js';
import { formatTargetAmount } from '../../lib/salesTargetHelpers.js';
import { fetchUsers } from '../../lib/services/lookups.js';
import * as salesTargetsApi from '../../lib/services/salesTargets.js';
import { downloadBlob } from '../../lib/importHelpers.js';
import { normalizeRole } from '../../lib/roles.js';
import { navigateToRecord } from '../../lib/recordNavigation.js';
import {
  PLAN_METRICS,
  PLAN_ROLES,
  DEFAULT_TARGET_MODEL,
  amountUnit,
  planRoleForUser,
  monthsInRange,
  weeksInRange,
  periodSummary,
  emptyPlanRow,
  autoDistribute,
  summarizePlan,
  weeklyPerPerson,
  breakdownRow,
  buildMonthlyTargetForms,
  planToCsv,
  applyCsvToPlan,
} from '../../lib/teamTargetPlan.js';

const LIST_PATH = '/settings?sales_targets=1';

const STEPS = [
  { title: 'Setup Period', hint: 'Choose target duration & currency' },
  { title: 'Target Model', hint: 'Select metrics and allocation method' },
  { title: 'Assign Targets', hint: 'Set targets for each team member' },
  { title: 'Review & Save', hint: 'Validate and activate targets' },
];

const METRIC_STYLES = {
  revenue: 'bg-purple-50 text-purple-700',
  pipeline: 'bg-blue-50 text-blue-700',
  meetings: 'bg-green-50 text-green-700',
  proposals: 'bg-amber-50 text-amber-700',
};

const ROLE_BADGE = {
  sales_manager: 'bg-purple-50 text-purple-700 border-purple-200',
  sales_rep: 'bg-blue-50 text-blue-700 border-blue-200',
};

const SAVE_CONCURRENCY = 4;

function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fixed(value, digits = 2) {
  return num(value).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function StepHeader({ step, maxStep, onSelect }) {
  return (
    <div className="card px-4 py-3 flex flex-wrap items-center gap-3">
      {STEPS.map((s, i) => {
        const n = i + 1;
        const active = n === step;
        const reachable = n <= maxStep;
        return (
          <div key={s.title} className="flex items-center gap-3 flex-1 min-w-[180px]">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onSelect(n)}
              className="flex items-center gap-3 text-left disabled:cursor-default"
            >
              <span className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold text-white ${active ? 'bg-red-600' : 'bg-gray-400'}`}>
                {n}
              </span>
              <span>
                <span className={`block text-sm font-semibold ${active ? 'text-red-600' : 'text-zoho-text'}`}>{s.title}</span>
                <span className="block text-xs text-zoho-muted">{s.hint}</span>
              </span>
            </button>
            {n < STEPS.length && <span className="hidden lg:block flex-1 h-px bg-zoho-border" />}
          </div>
        );
      })}
    </div>
  );
}

function SummaryStrip({ setup, totals, unit, onEdit }) {
  const coverage = totals.revenue ? totals.pipeline / totals.revenue : 0;
  const money = (v) => formatTargetAmount(v * unit.multiplier, setup.currency);
  const compact = (v) => formatIndianCompact(v * unit.multiplier, setup.currency);
  const items = [
    { label: 'Target Period', value: periodSummary(setup.start_date, setup.end_date) },
    { label: 'Revenue Target', value: `${money(totals.revenue)} (${compact(totals.revenue)})` },
    { label: 'Pipeline Target', value: `${money(totals.pipeline)} (${fixed(coverage, 1)}× Coverage)` },
    {
      label: 'Team',
      value: `${totals.bdmCount} BDM${totals.bdmCount === 1 ? '' : 's'} + ${totals.bdeCount} BDE${totals.bdeCount === 1 ? '' : 's'} (${totals.bdmCount + totals.bdeCount} Users)`,
    },
  ];
  return (
    <div className="card px-4 py-3 flex flex-wrap items-center gap-4">
      {items.map((item) => (
        <div key={item.label} className="flex-1 min-w-[180px]">
          <p className="text-xs text-zoho-muted">{item.label}</p>
          <p className="text-sm font-semibold text-zoho-text">{item.value}</p>
        </div>
      ))}
      <button type="button" onClick={onEdit} className="btn-secondary text-xs">Edit Setup</button>
    </div>
  );
}

function RevenueDonut({ totals, currency, unit }) {
  const total = totals.bdmRevenue + totals.bdeRevenue;
  const r = 52;
  const c = 2 * Math.PI * r;
  const bdmLen = total ? (totals.bdmRevenue / total) * c : 0;
  const pct = (v) => (total ? Math.round((v / total) * 100) : 0);
  const compact = (v) => formatIndianCompact(v * unit.multiplier, currency);
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg viewBox="0 0 140 140" className="w-32 h-32 shrink-0" role="img" aria-label="Revenue split between BDMs and BDEs">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e5e7eb" strokeWidth="18" />
        {total > 0 && (
          <>
            <circle cx="70" cy="70" r={r} fill="none" stroke="#3b82f6" strokeWidth="18" />
            <circle
              cx="70" cy="70" r={r} fill="none" stroke="#8b5cf6" strokeWidth="18"
              strokeDasharray={`${bdmLen} ${c - bdmLen}`} transform="rotate(-90 70 70)"
            />
          </>
        )}
        <text x="70" y="68" textAnchor="middle" className="fill-current text-zoho-text" fontSize="15" fontWeight="700">{compact(total)}</text>
        <text x="70" y="86" textAnchor="middle" fill="#6b7280" fontSize="11">Total</text>
      </svg>
      <div className="space-y-2 text-sm">
        <p className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-violet-500" />BDMs ({totals.bdmCount}) <span className="ml-2 font-medium">{compact(totals.bdmRevenue)} ({pct(totals.bdmRevenue)}%)</span></p>
        <p className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-blue-500" />BDEs ({totals.bdeCount}) <span className="ml-2 font-medium">{compact(totals.bdeRevenue)} ({pct(totals.bdeRevenue)}%)</span></p>
      </div>
    </div>
  );
}

function WeeklyCard({ title, weekly, unit, tone }) {
  if (!weekly) return null;
  const amount = (v) => `${unit.label.startsWith('₹') ? '₹' : ''}${fixed(v)} ${unit.short} / week`;
  const count = (v) => (v < 1 ? '< 1' : `${Math.round(v)}`);
  return (
    <div className="flex-1 min-w-[150px]">
      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2 ${tone}`}>{title}</span>
      <ul className="text-xs space-y-1 text-zoho-text">
        <li>Revenue: {amount(weekly.revenue)}</li>
        <li>Pipeline: {amount(weekly.pipeline)}</li>
        <li>Qualified Meetings: {count(weekly.meetings)}</li>
        <li>Proposals: {count(weekly.proposals)}</li>
      </ul>
    </div>
  );
}

export default function TeamTargetWizard() {
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canSave = can('settings_sales_targets', 'create');
  const fileInput = useRef(null);

  const [users, setUsers] = useState([]);
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [setup, setSetup] = useState({
    start_date: '',
    end_date: '',
    currency: DEFAULT_CURRENCY,
    team_revenue: '',
    member_ids: [],
  });
  const [model, setModel] = useState(DEFAULT_TARGET_MODEL);
  const [rows, setRows] = useState([]);
  const [view, setView] = useState('monthly');
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    fetchUsers()
      .then((list) => {
        const active = list.filter((u) => u.is_active !== false);
        setUsers(active);
        // Pre-select the sales team (BDMs and BDEs).
        const sales = active.filter((u) => ['sales_manager', 'sales_rep'].includes(normalizeRole(u.role)));
        setSetup((s) => (s.member_ids.length ? s : { ...s, member_ids: sales.map((u) => String(u.id)) }));
      })
      .catch((err) => showToast(getApiError(err)));
  }, [showToast]);

  // Keep one plan row per selected member, preserving values already entered.
  useEffect(() => {
    setRows((current) => {
      const byId = new Map(current.map((r) => [String(r.employee_id), r]));
      return setup.member_ids
        .map((id) => users.find((u) => String(u.id) === id))
        .filter(Boolean)
        .sort((a, b) => (planRoleForUser(a) === planRoleForUser(b) ? 0 : planRoleForUser(a) === 'sales_manager' ? -1 : 1))
        .map((u) => byId.get(String(u.id)) || emptyPlanRow(u));
    });
  }, [setup.member_ids, users]);

  const unit = amountUnit(setup.currency);
  const months = useMemo(() => monthsInRange(setup.start_date, setup.end_date), [setup.start_date, setup.end_date]);
  const weeks = weeksInRange(setup.start_date, setup.end_date);
  const totals = useMemo(() => summarizePlan(rows), [rows]);
  const metrics = PLAN_METRICS.filter((m) => model.metrics.includes(m.key));
  const money = (v) => formatTargetAmount(v * unit.multiplier, setup.currency);

  const goTo = (n) => {
    setStep(n);
    setMaxStep((m) => Math.max(m, n));
  };

  const validateSetup = () => {
    if (!setup.start_date || !setup.end_date || !months.length) return 'Choose a valid start and end date.';
    if (!setup.member_ids.length) return 'Select at least one team member.';
    return null;
  };

  const runAutoDistribute = () => {
    if (!num(setup.team_revenue)) {
      showToast('Enter the team revenue target in Setup Period first.');
      return;
    }
    setRows((current) => autoDistribute(current, { teamRevenue: setup.team_revenue, model, months: months.length }));
  };

  const next = () => {
    if (step === 1) {
      const err = validateSetup();
      if (err) { showToast(err); return; }
    }
    if (step === 2 && rows.every((r) => !num(r.revenue)) && num(setup.team_revenue)) {
      setRows((current) => autoDistribute(current, { teamRevenue: setup.team_revenue, model, months: months.length }));
    }
    goTo(step + 1);
  };

  const updateRow = (id, key, value) => {
    setRows((current) => current.map((r) => (r.employee_id === id ? { ...r, [key]: value } : r)));
  };

  const removeMember = (id) => {
    setSetup((s) => ({ ...s, member_ids: s.member_ids.filter((m) => m !== String(id)) }));
  };

  const toggleMember = (id) => {
    setSetup((s) => ({
      ...s,
      member_ids: s.member_ids.includes(id) ? s.member_ids.filter((m) => m !== id) : [...s.member_ids, id],
    }));
  };

  const toggleMetric = (key) => {
    setModel((m) => ({
      ...m,
      metrics: m.metrics.includes(key) ? m.metrics.filter((k) => k !== key) : [...m.metrics, key],
    }));
  };

  const setRoleRate = (field, role, value) => {
    setModel((m) => ({ ...m, [field]: { ...m[field], [role]: value } }));
  };

  const exportCsv = () => {
    downloadBlob(new Blob([planToCsv(rows)], { type: 'text/csv;charset=utf-8' }), 'sales-targets.csv');
  };

  const importCsv = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const { rows: updated, unmatched } = applyCsvToPlan(rows, await file.text());
    setRows(updated);
    showToast(
      unmatched.length ? `Imported. Not on this team: ${unmatched.join(', ')}` : 'Targets imported',
      unmatched.length ? 'error' : 'success',
    );
  };

  const save = async (status) => {
    const err = validateSetup();
    if (err) { showToast(err); goTo(1); return; }
    if (!rows.some((r) => num(r.revenue) || num(r.pipeline) || num(r.meetings) || num(r.proposals))) {
      showToast('Enter at least one target before saving.');
      return;
    }
    const forms = buildMonthlyTargetForms(rows, {
      start: setup.start_date, end: setup.end_date, currency: setup.currency, status, metrics: model.metrics,
    });
    const failures = [];
    let done = 0;
    setSaving({ done: 0, total: forms.length });
    const queue = [...forms];
    const worker = async () => {
      while (queue.length) {
        const form = queue.shift();
        try {
          await salesTargetsApi.createSalesTarget(form);
        } catch (e) {
          const member = rows.find((r) => r.employee_id === form.employee_id)?.name || form.employee_id;
          failures.push(`${member} ${form.period_name}: ${getApiError(e)}`);
        }
        done += 1;
        setSaving({ done, total: forms.length });
      }
    };
    await Promise.all(Array.from({ length: SAVE_CONCURRENCY }, worker));
    setSaving(null);
    if (failures.length) {
      showToast(`${forms.length - failures.length} of ${forms.length} monthly targets saved. Failed — ${failures.slice(0, 3).join('; ')}${failures.length > 3 ? '…' : ''}`);
      return;
    }
    showToast(status === 'active' ? 'Targets saved and activated' : 'Targets saved as draft', 'success');
    navigateToRecord(LIST_PATH);
  };

  const teamOptions = useMemo(
    () => [...users].sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [users],
  );

  const renderAssignTable = (readOnly) => (
    <div className="overflow-x-auto border border-zoho-border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="table-th">Team Member</th>
            <th className="table-th">Role</th>
            {metrics.map((m) => (
              <th key={m.key} className={`table-th text-center ${METRIC_STYLES[m.key]}`}>
                <span className="block">{m.label}{m.type === 'amount' ? ` (${unit.label})` : ''}</span>
                <span className="block text-[11px] font-normal opacity-80">{m.hint}</span>
              </th>
            ))}
            {!readOnly && <th className="table-th text-center">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.employee_id}>
              <td className="table-td">
                <span className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-red-50 text-red-600 text-xs font-semibold flex items-center justify-center shrink-0">{initials(row.name)}</span>
                  <span className="font-medium">{row.name}</span>
                </span>
              </td>
              <td className="table-td">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${ROLE_BADGE[row.role]}`}>{PLAN_ROLES[row.role]}</span>
              </td>
              {metrics.map((m) => (
                <td key={m.key} className="table-td text-center">
                  {readOnly ? (
                    m.type === 'amount' ? fixed(row[m.key]) : num(row[m.key])
                  ) : (
                    <input
                      id={`target-${row.employee_id}-${m.key}`}
                      className="input text-center min-w-[90px]"
                      type="number"
                      min="0"
                      step={m.type === 'amount' ? '0.01' : '1'}
                      value={row[m.key]}
                      onChange={(e) => updateRow(row.employee_id, m.key, e.target.value)}
                      aria-label={`${m.label} for ${row.name}`}
                    />
                  )}
                </td>
              ))}
              {!readOnly && (
                <td className="table-td">
                  <span className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => document.getElementById(`target-${row.employee_id}-${metrics[0]?.key}`)?.focus()}
                      className="text-zoho-muted hover:text-brand-600"
                    >
                      ✎
                    </button>
                    <button type="button" title="Remove from plan" onClick={() => removeMember(row.employee_id)} className="text-red-600 hover:text-red-700">
                      🗑
                    </button>
                  </span>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={metrics.length + 3} className="table-td text-center py-8 text-gray-400">No team members selected</td></tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="bg-red-50 font-semibold">
              <td className="table-td" colSpan={2}>{`Total (${rows.length} User${rows.length === 1 ? '' : 's'})`}</td>
              {metrics.map((m) => (
                <td key={m.key} className="table-td text-center">
                  {m.type === 'amount' ? (
                    <>
                      <span className="block">{`${fixed(totals[m.key])} ${unit.short}`}</span>
                      <span className="block text-xs font-normal">({formatIndianCompact(totals[m.key] * unit.multiplier, setup.currency)})</span>
                    </>
                  ) : num(totals[m.key])}
                </td>
              ))}
              {!readOnly && <td className="table-td" />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );

  const renderBreakdown = (size) => (
    <div className="overflow-x-auto border border-zoho-border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="table-th">Team Member</th>
            {breakdownRow(rows[0] || {}, months, size).map((g) => <th key={g.label} className="table-th text-center">{g.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.employee_id}>
              <td className="table-td font-medium">{row.name}</td>
              {breakdownRow(row, months, size).map((g) => (
                <td key={g.label} className="table-td text-center text-xs leading-5">
                  {model.metrics.includes('revenue') && <span className="block text-purple-700">{`Rev ${fixed(g.revenue)} ${unit.short}`}</span>}
                  {model.metrics.includes('pipeline') && <span className="block text-blue-700">{`Pipe ${fixed(g.pipeline)} ${unit.short}`}</span>}
                  {model.metrics.includes('meetings') && <span className="block text-green-700">{`Mtgs ${g.meetings}`}</span>}
                  {model.metrics.includes('proposals') && <span className="block text-amber-700">{`Props ${g.proposals}`}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const bdmWeekly = weeklyPerPerson(rows, 'sales_manager', weeks);
  const bdeWeekly = weeklyPerPerson(rows, 'sales_rep', weeks);

  const sidebar = (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Target Summary</h2>
        <dl className="text-sm space-y-2">
          {model.metrics.includes('revenue') && <div className="flex justify-between"><dt>Total Revenue Target</dt><dd className="font-semibold">{money(totals.revenue)}</dd></div>}
          {model.metrics.includes('pipeline') && <div className="flex justify-between"><dt>Total Pipeline Target</dt><dd className="font-semibold">{money(totals.pipeline)}</dd></div>}
          {model.metrics.includes('meetings') && <div className="flex justify-between"><dt>Total Qualified Meetings</dt><dd className="font-semibold">{num(totals.meetings)}</dd></div>}
          {model.metrics.includes('proposals') && <div className="flex justify-between"><dt>Total Proposals</dt><dd className="font-semibold">{num(totals.proposals)}</dd></div>}
        </dl>
        <h3 className="text-sm font-semibold pt-2 border-t border-zoho-border">Target Distribution (Revenue)</h3>
        <RevenueDonut totals={totals} currency={setup.currency} unit={unit} />
      </div>
      <div className="card p-4">
        <h2 className="text-sm font-semibold">Weekly Target (Per Person)</h2>
        <p className="text-xs text-zoho-muted mb-3">{`Approximate weekly targets based on ${months.length}-month plan`}</p>
        <div className="flex gap-4 flex-wrap">
          <WeeklyCard title="BDM (each)" weekly={bdmWeekly} unit={unit} tone="bg-purple-50 text-purple-700" />
          <WeeklyCard title="BDE (each)" weekly={bdeWeekly} unit={unit} tone="bg-blue-50 text-blue-700" />
        </div>
        {!bdmWeekly && !bdeWeekly && <p className="text-xs text-zoho-muted">Add team members to see weekly targets.</p>}
      </div>
    </div>
  );

  return (
    <CRMLayout>
      <div className="max-w-[1400px] mx-auto w-full p-4 md:p-6 space-y-4">
        <nav className="text-sm text-zoho-muted flex items-center gap-2 flex-wrap">
          <AppLink href="/settings" className="hover:underline">Settings</AppLink>
          <span>›</span>
          <AppLink href={LIST_PATH} className="hover:underline">Sales Targets</AppLink>
          <span>›</span>
          <span className="font-semibold text-zoho-text">Set New Targets</span>
        </nav>
        <div>
          <h1 className="text-xl font-semibold text-zoho-text">Set Sales Targets</h1>
          <p className="text-sm text-zoho-muted">Define pipeline, revenue and activity targets for your sales team with a structured and measurable plan.</p>
        </div>

        <StepHeader step={step} maxStep={maxStep} onSelect={goTo} />

        {step >= 3 && <SummaryStrip setup={setup} totals={totals} unit={unit} onEdit={() => goTo(1)} />}

        {step === 1 && (
          <div className="card p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Start Date" required name="start_date">
                <input className="input" type="date" value={setup.start_date} onChange={(e) => setSetup((s) => ({ ...s, start_date: e.target.value }))} />
              </FormField>
              <FormField label="End Date" required name="end_date">
                <input className="input" type="date" value={setup.end_date} onChange={(e) => setSetup((s) => ({ ...s, end_date: e.target.value }))} />
              </FormField>
              <FormField label="Currency" name="currency">
                <select className="input" value={setup.currency} onChange={(e) => setSetup((s) => ({ ...s, currency: e.target.value }))}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{`${c.code} — ${c.name}`}</option>)}
                </select>
              </FormField>
              <FormField label={`Team Revenue Target (${unit.label})`} name="team_revenue">
                <input className="input" type="number" min="0" step="0.01" value={setup.team_revenue} onChange={(e) => setSetup((s) => ({ ...s, team_revenue: e.target.value }))} placeholder="e.g. 600" />
              </FormField>
            </div>
            {months.length > 0 && <p className="text-xs text-zoho-muted">{`Plan period: ${periodSummary(setup.start_date, setup.end_date)}`}</p>}
            <div>
              <p className="label mb-2">{`Team Members (${setup.member_ids.length} selected)`}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {teamOptions.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm border border-zoho-border rounded-lg px-3 py-2 cursor-pointer hover:bg-brand-50">
                    <input type="checkbox" checked={setup.member_ids.includes(String(u.id))} onChange={() => toggleMember(String(u.id))} />
                    <span className="flex-1">{u.name}</span>
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${ROLE_BADGE[planRoleForUser(u)]}`}>{PLAN_ROLES[planRoleForUser(u)]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card p-5 space-y-5">
            <div>
              <p className="label mb-2">Metrics to track</p>
              <div className="flex flex-wrap gap-2">
                {PLAN_METRICS.map((m) => (
                  <label key={m.key} className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 cursor-pointer ${METRIC_STYLES[m.key]}`}>
                    <input type="checkbox" checked={model.metrics.includes(m.key)} onChange={() => toggleMetric(m.key)} />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Pipeline Coverage (× revenue)" name="coverage">
                <input className="input" type="number" min="0" step="0.1" value={model.coverage} onChange={(e) => setModel((m) => ({ ...m, coverage: e.target.value }))} />
              </FormField>
              <FormField label="Revenue share for BDMs (%) — BDEs get the rest" name="bdm_share">
                <input className="input" type="number" min="0" max="100" value={model.bdm_share} onChange={(e) => setModel((m) => ({ ...m, bdm_share: e.target.value }))} />
              </FormField>
              {Object.entries(PLAN_ROLES).map(([role, label]) => (
                <div key={role} className="grid grid-cols-2 gap-3">
                  <FormField label={`${label} meetings / month`} name={`meetings_${role}`}>
                    <input className="input" type="number" min="0" value={model.meetings_per_month[role]} onChange={(e) => setRoleRate('meetings_per_month', role, e.target.value)} />
                  </FormField>
                  <FormField label={`${label} proposals / month`} name={`proposals_${role}`}>
                    <input className="input" type="number" min="0" value={model.proposals_per_month[role]} onChange={(e) => setRoleRate('proposals_per_month', role, e.target.value)} />
                  </FormField>
                </div>
              ))}
            </div>
            <p className="text-xs text-zoho-muted">
              Allocation: the team revenue target is split between BDMs and BDEs by the share above, then equally within each role.
              You can change any number on the next step, or use Auto-Distribute again.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 items-start">
            <div className="card p-4 space-y-4 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Assign Individual Targets</h2>
                  <p className="text-xs text-zoho-muted">Set targets for pipeline, revenue and key sales activities for each team member.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={runAutoDistribute} className="btn-secondary text-xs">Auto-Distribute</button>
                  <button type="button" onClick={() => fileInput.current?.click()} className="btn-secondary text-xs">Import from Excel</button>
                  <button type="button" onClick={exportCsv} className="btn-secondary text-xs">Export</button>
                  <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
                </div>
              </div>
              <div className="inline-flex gap-1 border border-zoho-border rounded-lg p-1">
                {[['monthly', 'Monthly Targets'], ['quarterly', 'Quarterly View'], ['annual', 'Annual Summary']].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setView(key)}
                    className={`text-xs px-3 py-1.5 rounded-md ${view === key ? 'bg-red-600 text-white' : 'text-zoho-text hover:bg-gray-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {view === 'monthly' && renderAssignTable(false)}
              {view === 'quarterly' && renderBreakdown(3)}
              {view === 'annual' && renderBreakdown(12)}
              <p className="text-xs text-zoho-muted">
                {`Numbers are for the whole plan; each person's targets are saved as ${months.length} equal monthly targets. Import accepts the CSV from Export (save Excel sheets as CSV).`}
              </p>
            </div>
            {sidebar}
          </div>
        )}

        {step === 4 && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 items-start">
            <div className="card p-4 space-y-3 min-w-0">
              <h2 className="text-base font-semibold">Review Targets</h2>
              <p className="text-xs text-zoho-muted">
                {`Saving creates ${rows.length * months.length} monthly targets (${rows.length} people × ${months.length} months). Save Draft keeps them editable; Save & Activate makes them live on the dashboard.`}
              </p>
              {renderAssignTable(true)}
            </div>
            {sidebar}
          </div>
        )}

        <div className="flex gap-2 justify-end flex-wrap pb-6">
          {step > 1 ? (
            <button type="button" onClick={() => setStep(step - 1)} className="btn-secondary" disabled={!!saving}>← Back</button>
          ) : (
            <AppLink href={LIST_PATH} className="btn-secondary">Cancel</AppLink>
          )}
          {step >= 3 && canSave && (
            <button type="button" onClick={() => save('draft')} className="btn-secondary" disabled={!!saving}>Save Draft</button>
          )}
          {step < 4 && (
            <button type="button" onClick={next} className="btn-primary" disabled={!!saving}>
              {step === 3 ? 'Next: Review' : 'Next'}
            </button>
          )}
          {step === 4 && canSave && (
            <button type="button" onClick={() => save('active')} className="btn-primary" disabled={!!saving}>
              {saving ? `Saving ${saving.done}/${saving.total}…` : '✓ Save & Activate Targets'}
            </button>
          )}
        </div>
      </div>
    </CRMLayout>
  );
}
