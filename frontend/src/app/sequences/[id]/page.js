'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecordId } from '../../../hooks/useRecordId.js';
import { useRecordIdGuard } from '../../../hooks/useRecordIdGuard.js';
import CRMLayout from '../../../components/layout/CRMLayout.js';
import AppLink from '../../../components/ui/AppLink.js';
import Badge from '../../../components/ui/Badge.js';
import RecordDetailSkeleton from '../../../components/records/RecordDetailSkeleton.js';
import SequenceBuilder from '../../../components/sequences/SequenceBuilder.js';
import SequenceAnalyticsPanel from '../../../components/sequences/SequenceAnalyticsPanel.js';
import EnrollMembersModal from '../../../components/sequences/EnrollMembersModal.js';
import EnrollmentNextActionCell from '../../../components/sequences/EnrollmentNextActionCell.js';
import FormField, { inputClass } from '../../../components/forms/FormField.js';
import TimezoneSelect from '../../../components/forms/TimezoneSelect.js';
import { useToast } from '../../../components/ui/Toast.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue.js';
import { getApiError } from '../../../lib/api.js';
import * as sequencesApi from '../../../lib/services/sequences.js';
import { formatSendDays, sequenceStatusLabel, enrollmentStatusLabel, formatDateTimeInTimezone, SEND_DAYS, formatTimezoneLabel, enrollmentProgressByStep, isSequenceSettingsDirty } from '../../../lib/sequenceHelpers.js';
import { tokenizeSearchQuery } from '../../../lib/listSearchHelpers.js';
import { fetchUsers } from '../../../lib/services/lookups.js';

const TABS = ['Steps', 'Enrollments', 'Analytics', 'Settings'];

export default function SequenceDetailPage() {
  const id = useRecordId();
  const ready = useRecordIdGuard(id, { fallbackPath: '/sequences', message: 'Sequence not found' });
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canEdit = can('sequences', 'edit');
  const canEnroll = can('sequences', 'enroll');
  const [sequence, setSequence] = useState(null);
  const [steps, setSteps] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [enrollmentsLoaded, setEnrollmentsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Steps');
  const [saving, setSaving] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollmentSearch, setEnrollmentSearch] = useState('');
  const debouncedEnrollmentSearch = useDebouncedValue(enrollmentSearch, 250);
  const [settings, setSettings] = useState(null);
  const [settingsErrors, setSettingsErrors] = useState({});
  const [users, setUsers] = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!ready || !id) return;
    setLoading(true);
    try {
      // Load sequence + steps first — enrollments are heavy and only needed on that tab.
      const [seq, stepRows] = await Promise.all([
        sequencesApi.getSequence(id),
        sequencesApi.listSequenceSteps(id),
      ]);
      setSequence(seq);
      setSteps(stepRows);
      setEnrollmentsLoaded(false);
      setEnrollments([]);
      // Warm the slow /stats endpoint while user is still on Steps.
      sequencesApi.prefetchSequenceStats(id).catch(() => {});
      setSettings({
        name: seq.name,
        description: seq.description || '',
        sending_email: seq.sending_email || '',
        timezone: seq.timezone || 'UTC',
        send_window_start: (seq.send_window_start || '09:00').slice(0, 5),
        send_window_end: (seq.send_window_end || '18:00').slice(0, 5),
        send_days: seq.send_days ?? 62,
        daily_send_limit: seq.daily_send_limit ?? 100,
        hourly_send_limit: seq.hourly_send_limit ?? '',
        use_contact_timezone: seq.use_contact_timezone ?? false,
        stop_on_reply: seq.stop_on_reply !== false,
        stop_on_click: seq.stop_on_click ?? false,
        owner_id: seq.owner_id || '',
      });
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [id, ready, showToast]);

  const loadEnrollments = useCallback(async ({ force = false } = {}) => {
    if (!id) return;
    if (enrollmentsLoaded && !force) return;
    setEnrollmentsLoading(true);
    try {
      // First page fast (API page_size max is typically 100).
      const first = await sequencesApi.listEnrollments(id, { page: 1, page_size: 100 });
      let all = first.data || [];
      setEnrollments(all);
      setEnrollmentsLoaded(true);
      setEnrollmentsLoading(false);

      const total = first.total ?? all.length;
      if (all.length >= total) return;

      // Fill remaining pages in the background without blocking the tab.
      let page = 2;
      while (all.length < total && page <= 20) {
        const next = await sequencesApi.listEnrollments(id, { page, page_size: 100 });
        const batch = next.data || [];
        if (!batch.length) break;
        all = all.concat(batch);
        setEnrollments(all);
        page += 1;
      }
    } catch (err) {
      showToast(getApiError(err));
      setEnrollmentsLoading(false);
    }
  }, [id, enrollmentsLoaded, showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // Steps tab needs enrollments to show which step is currently executing.
    if (tab === 'Enrollments' || tab === 'Steps') loadEnrollments();
  }, [tab, loadEnrollments]);

  const stepProgress = useMemo(
    () => enrollmentProgressByStep(enrollments),
    [enrollments],
  );

  const settingsDirty = useMemo(
    () => isSequenceSettingsDirty(settings, sequence),
    [settings, sequence],
  );

  useEffect(() => {
    if (tab !== 'Settings' || usersLoaded) return;
    fetchUsers()
      .then((list) => {
        setUsers(list);
        setUsersLoaded(true);
      })
      .catch(() => setUsers([]));
  }, [tab, usersLoaded]);

  const filteredEnrollments = useMemo(() => {
    const tokens = tokenizeSearchQuery(debouncedEnrollmentSearch);
    if (!tokens.length) return enrollments;
    return enrollments.filter((e) => {
      const haystack = [
        e.member_name,
        e.member_email,
        e.email,
        e.first_name,
        e.last_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [enrollments, debouncedEnrollmentSearch]);

  const setStatus = async (action) => {
    setSaving(true);
    try {
      const updated = action === 'activate'
        ? await sequencesApi.activateSequence(id)
        : await sequencesApi.pauseSequence(id);
      setSequence(updated);
      showToast(`Sequence ${action === 'activate' ? 'activated' : 'paused'}`, 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    const name = String(settings?.name || '').trim();
    if (!name) {
      setSettingsErrors({ name: 'Sequence Name is required.' });
      showToast('Fill all the required fields.');
      return;
    }
    const uniqueErr = await sequencesApi.validateSequenceNameUnique(name, { excludeId: id });
    if (uniqueErr) {
      setSettingsErrors({ name: uniqueErr });
      showToast(uniqueErr);
      return;
    }
    setSettingsErrors({});
    setSaving(true);
    try {
      const previous = sequence;
      const updated = await sequencesApi.updateSequence(id, settings);
      setSequence(updated);
      showToast('Settings saved', 'success');
      const scheduleSettingsChanged = (previous?.send_window_start || '').slice(0, 5) !== String(settings.send_window_start || '').slice(0, 5)
        || (previous?.send_window_end || '').slice(0, 5) !== String(settings.send_window_end || '').slice(0, 5)
        || previous?.timezone !== settings.timezone
        || Number(previous?.send_days) !== Number(settings.send_days);
      if (scheduleSettingsChanged && steps.length) {
        const result = await sequencesApi.syncEnrollmentSchedulesFromSteps({
          sequenceId: id,
          steps,
          sequence: updated,
        });
        if (result.updated > 0) {
          showToast(
            `Updated Next Action for ${result.updated} enrollment${result.updated === 1 ? '' : 's'}`,
            'success',
          );
        }
        await loadEnrollments({ force: true });
      }
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!ready || loading || !sequence) {
    return <CRMLayout><RecordDetailSkeleton /></CRMLayout>;
  }

  // Allow adding/editing steps while active or paused (not draft-only).
  const stepsEditable = canEdit && ['DRAFT', 'ACTIVE', 'PAUSED'].includes(sequence.status);
  const canActivate = canEdit && (sequence.status === 'DRAFT' || sequence.status === 'PAUSED');
  const canPause = canEdit && sequence.status === 'ACTIVE';

  return (
    <CRMLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <AppLink href="/sequences" className="text-xs text-brand-600 hover:underline">← Sequences</AppLink>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-zoho-text">{sequence.name}</h1>
              <Badge label={sequenceStatusLabel(sequence.status)} />
            </div>
            <p className="text-sm text-zoho-muted mt-1">
              {sequence.sending_email} · {formatSendDays(sequence.send_days)}
              {(sequence.owner_name && sequence.owner_name !== '—') && (
                <span> · Owner: {sequence.owner_name}</span>
              )}
              {sequence.email_provider === 'resend' && (
                <span className="ml-2 text-xs text-brand-600">· Resend</span>
              )}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {canEnroll && (
              <button type="button" onClick={() => setEnrollOpen(true)} className="btn-secondary-sm">
                Enroll Members
              </button>
            )}
            {canActivate && (
              <button type="button" disabled={saving} onClick={() => setStatus('activate')} className="btn-primary-sm">
                Activate
              </button>
            )}
            {canPause && (
              <button type="button" disabled={saving} onClick={() => setStatus('pause')} className="btn-secondary-sm">
                Pause
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-b border-zoho-border">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm border-b-2 -mb-px ${tab === t ? 'border-brand-600 text-brand-700 font-medium' : 'border-transparent text-zoho-muted'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'Steps' && (
          <SequenceBuilder
            sequenceId={id}
            steps={steps}
            sequenceTimezone={sequence.timezone || 'UTC'}
            sequence={sequence}
            readOnly={!stepsEditable}
            stepProgress={stepProgress}
            onStepsChange={setSteps}
            onScheduleSynced={() => loadEnrollments({ force: true })}
          />
        )}

        {tab === 'Enrollments' && (
          <div className="rounded-xl border border-zoho-border overflow-hidden">
            <div className="px-4 py-3 border-b border-zoho-border bg-gray-50">
              <div className="relative max-w-md">
                <input
                  type="search"
                  className="w-full py-2 pl-9 pr-3 text-sm border border-zoho-border rounded-xl bg-white focus:outline-none focus:ring-4 focus:ring-brand-100 focus:border-brand-400"
                  placeholder="Search by email, first name, or full name…"
                  aria-label="Search enrollments by email or name"
                  value={enrollmentSearch}
                  onChange={(e) => setEnrollmentSearch(e.target.value)}
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zoho-muted pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            {enrollmentsLoading && !enrollments.length ? (
              <p className="text-sm text-zoho-muted py-8 text-center">Loading enrollments…</p>
            ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zoho-border bg-gray-50">
                  <th className="table-th text-left">Prospect</th>
                  <th className="table-th text-left">Type</th>
                  <th className="table-th text-left">Status</th>
                  <th className="table-th text-left">Current Step</th>
                  <th className="table-th text-left">Next Action</th>
                  <th className="table-th text-left">Last Activity</th>
                  <th className="table-th text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEnrollments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-td text-center text-zoho-muted py-8">
                      {debouncedEnrollmentSearch.trim() ? 'No matching enrollments found.' : 'No enrollments yet'}
                    </td>
                  </tr>
                ) : filteredEnrollments.map((e) => (
                  <tr key={e.id} className="border-b border-zoho-border last:border-0">
                    <td className="table-td">{e.member_name}</td>
                    <td className="table-td capitalize">{e.member_type}</td>
                    <td className="table-td"><Badge label={enrollmentStatusLabel(e.status)} /></td>
                    <td className="table-td">{e.current_step_order != null ? `Step ${e.current_step_order}` : '—'}</td>
                    <td className="table-td">
                      <EnrollmentNextActionCell
                        enrollment={e}
                        sequenceTimezone={sequence.timezone}
                        canEdit={canEdit}
                        onUpdated={(updated) => {
                          setEnrollments((rows) => rows.map((row) => (
                            row.id === e.id
                              ? {
                                ...row,
                                ...updated,
                                id: row.id,
                                next_action_at: updated.next_action_at ?? row.next_action_at,
                              }
                              : row
                          )));
                        }}
                      />
                    </td>
                    <td className="table-td text-xs">{e.last_action_at ? formatDateTimeInTimezone(e.last_action_at, sequence.timezone) : '—'}</td>
                    <td className="table-td">
                      {canEdit && String(e.status || '').toUpperCase() === 'ACTIVE' && (
                        <button
                          type="button"
                          className="text-xs text-brand-600 hover:underline"
                          onClick={async () => {
                            try {
                              const updated = await sequencesApi.updateEnrollment(e.id, { mark_replied: true });
                              setEnrollments((rows) => rows.map((row) => (
                                row.id === e.id ? { ...row, ...updated, id: row.id } : row
                              )));
                              showToast('Marked as replied', 'success');
                            } catch (err) {
                              showToast(getApiError(err));
                            }
                          }}
                        >
                          Mark replied
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        )}

        {tab === 'Analytics' && (
          <SequenceAnalyticsPanel
            sequenceId={id}
            sequence={sequence}
            sequenceTimezone={sequence.timezone || 'UTC'}
            sendingEmail={sequence.sending_email || settings?.sending_email || ''}
          />
        )}

        {tab === 'Settings' && settings && (
          <div className="space-y-4 max-w-2xl">
            <FormField label="Name" error={settingsErrors.name}>
              <input
                className={inputClass(settingsErrors.name)}
                value={settings.name}
                disabled={!canEdit}
                onChange={(e) => {
                  setSettings((s) => ({ ...s, name: e.target.value }));
                  setSettingsErrors((er) => (er.name ? { ...er, name: null } : er));
                }}
              />
            </FormField>
            <FormField label="Description">
              <textarea className="input min-h-[80px]" value={settings.description} disabled={!canEdit} onChange={(e) => setSettings((s) => ({ ...s, description: e.target.value }))} />
            </FormField>
            <FormField label="Sending email">
              <input className="input" type="email" value={settings.sending_email} disabled={!canEdit} onChange={(e) => setSettings((s) => ({ ...s, sending_email: e.target.value }))} />
            </FormField>
            <FormField label="Owner">
              <select
                className="input"
                value={settings.owner_id || ''}
                disabled={!canEdit}
                onChange={(e) => setSettings((s) => ({ ...s, owner_id: e.target.value }))}
              >
                <option value="">Select owner</option>
                {users.map((u) => (
                  <option key={u.id || u.value} value={u.id || u.value}>
                    {u.name || u.label || u.email}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Campaign timezone">
              <TimezoneSelect
                value={settings.timezone}
                disabled={!canEdit}
                onChange={(timezone) => setSettings((s) => ({ ...s, timezone }))}
              />
              <p className="text-xs text-zoho-muted mt-1.5">
                Active timezone: {formatTimezoneLabel(settings.timezone)}. Send window times below are in this zone unless contact timezone is on.
              </p>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Send window start">
                <input className="input" type="time" value={settings.send_window_start} disabled={!canEdit} onChange={(e) => setSettings((s) => ({ ...s, send_window_start: e.target.value }))} />
              </FormField>
              <FormField label="Send window end">
                <input className="input" type="time" value={settings.send_window_end} disabled={!canEdit} onChange={(e) => setSettings((s) => ({ ...s, send_window_end: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="Send days">
              <div className="flex flex-wrap gap-2">
                {SEND_DAYS.map((d) => (
                  <label key={d.bit} className="inline-flex items-center gap-1 text-xs border border-zoho-border rounded-lg px-2 py-1">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={Boolean(settings.send_days & d.bit)}
                      onChange={() => setSettings((s) => ({
                        ...s,
                        send_days: s.send_days & d.bit ? s.send_days & ~d.bit : s.send_days | d.bit,
                      }))}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Daily limit">
                <input className="input" type="number" value={settings.daily_send_limit} disabled={!canEdit} onChange={(e) => setSettings((s) => ({ ...s, daily_send_limit: e.target.value }))} />
              </FormField>
              <FormField label="Hourly limit">
                <input className="input" type="number" placeholder="Optional" value={settings.hourly_send_limit} disabled={!canEdit} onChange={(e) => setSettings((s) => ({ ...s, hourly_send_limit: e.target.value }))} />
              </FormField>
            </div>
            <p className="text-xs text-zoho-muted">
              Emails due at the same time are throttled by daily/hourly limits (not blasted all at once). Window: {formatSendDays(settings.send_days)}.
            </p>
            <div className="space-y-3 text-sm">
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-0.5" disabled={!canEdit} checked={settings.use_contact_timezone} onChange={(e) => setSettings((s) => ({ ...s, use_contact_timezone: e.target.checked }))} />
                <span>
                  <span className="font-medium">Use contact timezone</span>
                  <span className="block text-xs text-zoho-muted mt-0.5">
                    Off: honor campaign timezone + send window. On: shift each send into the contact/lead timezone when that field is set.
                  </span>
                </span>
              </label>
              {[
                ['stop_on_reply', 'Stop on reply'],
                ['stop_on_click', 'Stop on click'],
              ].map(([key, label]) => (
                <label key={key} className="inline-flex items-center gap-2">
                  <input type="checkbox" disabled={!canEdit} checked={settings[key]} onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
            {canEdit && settingsDirty && (
              <button type="button" onClick={saveSettings} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            )}
          </div>
        )}
      </div>

      <EnrollMembersModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        onEnrolled={() => {
          load();
          loadEnrollments({ force: true });
        }}
        sequenceId={id}
        members={[]}
      />
    </CRMLayout>
  );
}
