'use client';
import { useCallback, useEffect, useState } from 'react';
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
import FormField from '../../../components/forms/FormField.js';
import { useToast } from '../../../components/ui/Toast.js';
import { usePermissions } from '../../../hooks/usePermissions.js';
import { getApiError } from '../../../lib/api.js';
import * as sequencesApi from '../../../lib/services/sequences.js';
import { formatSendDays, sequenceStatusLabel, enrollmentStatusLabel, formatDateTimeInTimezone } from '../../../lib/sequenceHelpers.js';

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
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Steps');
  const [saving, setSaving] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [settings, setSettings] = useState(null);

  const load = useCallback(async () => {
    if (!ready || !id) return;
    setLoading(true);
    try {
      const [seq, stepRows, enrollRows] = await Promise.all([
        sequencesApi.getSequence(id),
        sequencesApi.listSequenceSteps(id),
        sequencesApi.listEnrollments(id, { page_size: 50 }),
      ]);
      setSequence(seq);
      setSteps(stepRows);
      setEnrollments(enrollRows.data || []);
      setSettings({
        name: seq.name,
        description: seq.description || '',
        sending_email: seq.sending_email || '',
        daily_send_limit: seq.daily_send_limit ?? 100,
        hourly_send_limit: seq.hourly_send_limit ?? '',
        use_contact_timezone: seq.use_contact_timezone ?? false,
        stop_on_reply: seq.stop_on_reply !== false,
        stop_on_click: seq.stop_on_click ?? false,
      });
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [id, ready, showToast]);

  useEffect(() => { load(); }, [load]);

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
    setSaving(true);
    try {
      const updated = await sequencesApi.updateSequence(id, settings);
      setSequence(updated);
      showToast('Settings saved', 'success');
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!ready || loading || !sequence) {
    return <CRMLayout><RecordDetailSkeleton /></CRMLayout>;
  }

  const stepsEditable = canEdit && sequence.status === 'DRAFT';
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
            readOnly={!stepsEditable}
            onStepsChange={setSteps}
          />
        )}

        {tab === 'Enrollments' && (
          <div className="rounded-xl border border-zoho-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zoho-border bg-gray-50">
                  <th className="table-th text-left">Prospect</th>
                  <th className="table-th text-left">Type</th>
                  <th className="table-th text-left">Status</th>
                  <th className="table-th text-left">Current Step</th>
                  <th className="table-th text-left">Next Action</th>
                  <th className="table-th text-left">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.length === 0 ? (
                  <tr><td colSpan={6} className="table-td text-center text-zoho-muted py-8">No enrollments yet</td></tr>
                ) : enrollments.map((e) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Analytics' && <SequenceAnalyticsPanel sequenceId={id} steps={steps} />}

        {tab === 'Settings' && settings && (
          <div className="space-y-4 max-w-2xl">
            <FormField label="Name">
              <input className="input" value={settings.name} disabled={!canEdit} onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value }))} />
            </FormField>
            <FormField label="Description">
              <textarea className="input min-h-[80px]" value={settings.description} disabled={!canEdit} onChange={(e) => setSettings((s) => ({ ...s, description: e.target.value }))} />
            </FormField>
            <FormField label="Sending email">
              <input className="input" type="email" value={settings.sending_email} disabled={!canEdit} onChange={(e) => setSettings((s) => ({ ...s, sending_email: e.target.value }))} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Daily limit">
                <input className="input" type="number" value={settings.daily_send_limit} disabled={!canEdit} onChange={(e) => setSettings((s) => ({ ...s, daily_send_limit: e.target.value }))} />
              </FormField>
              <FormField label="Hourly limit">
                <input className="input" type="number" placeholder="Optional" value={settings.hourly_send_limit} disabled={!canEdit} onChange={(e) => setSettings((s) => ({ ...s, hourly_send_limit: e.target.value }))} />
              </FormField>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['use_contact_timezone', 'Use contact timezone'],
                ['stop_on_reply', 'Stop on reply'],
                ['stop_on_click', 'Stop on click'],
              ].map(([key, label]) => (
                <label key={key} className="inline-flex items-center gap-2 mr-4">
                  <input type="checkbox" disabled={!canEdit} checked={settings[key]} onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
            {canEdit && (
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
        onEnrolled={load}
        sequenceId={id}
        members={[]}
      />
    </CRMLayout>
  );
}
