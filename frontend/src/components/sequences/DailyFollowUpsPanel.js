'use client';
import { useCallback, useEffect, useState } from 'react';
import Modal from '../ui/Modal.js';
import FormField from '../forms/FormField.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import * as followupsApi from '../../lib/services/followups.js';
import { CALL_STATUSES } from '../../lib/sequenceHelpers.js';
import AppLink from '../ui/AppLink.js';
import { tableLinkClass } from '../../lib/tableStyles.js';

function FollowupSection({ title, tone, items, onComplete }) {
  if (!items.length) return null;
  const toneClass = tone === 'overdue' ? 'text-red-700 bg-red-50 border-red-200'
    : tone === 'today' ? 'text-amber-800 bg-amber-50 border-amber-200'
      : tone === 'completed' ? 'text-green-800 bg-green-50 border-green-200'
        : 'text-zoho-text bg-white border-zoho-border';

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
            <BadgeChannel channel={item.channel} />
            {item.member_name && item.member_id ? (
              <AppLink href={item.member_type === 'contact' ? `/contacts/${item.member_id}` : `/leads/${item.member_id}`} className={tableLinkClass}>
                {item.member_name}
              </AppLink>
            ) : (
              <span className="font-medium">{item.member_name || 'Prospect'}</span>
            )}
            <span className="text-xs text-zoho-muted">{item.action_label || item.action_type}</span>
            <span className="text-xs ml-auto">{formatDue(item.due_at || item.due_date)}</span>
            {onComplete && item.status !== 'completed' && (
              <button type="button" onClick={() => onComplete(item)} className="text-xs text-brand-600 hover:underline">
                Mark Completed
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BadgeChannel({ channel }) {
  const label = channel === 'call' ? 'Call' : channel === 'linkedin' ? 'LinkedIn' : channel || 'Task';
  return <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/80 border border-current">{label}</span>;
}

function formatDue(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

export default function DailyFollowUpsPanel({ compact = false }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completeItem, setCompleteItem] = useState(null);
  const [completeForm, setCompleteForm] = useState({
    completed_at: new Date().toISOString().slice(0, 10),
    notes: '',
    next_action: '',
    next_due_at: '',
    call_status: 'connected',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await followupsApi.listFollowups();
      setRows(data);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const buckets = followupsApi.bucketFollowups(rows);

  const submitComplete = async () => {
    if (!completeItem) return;
    try {
      await followupsApi.updateFollowup(completeItem.id, {
        status: 'completed',
        completed_at: completeForm.completed_at,
        notes: completeForm.notes,
      });
      if (completeForm.next_action && completeForm.next_due_at) {
        await followupsApi.createFollowup({
          member_type: completeItem.member_type,
          member_id: completeItem.member_id,
          member_name: completeItem.member_name,
          channel: completeItem.channel,
          action_type: completeForm.next_action,
          action_label: completeForm.next_action,
          due_at: completeForm.next_due_at,
          call_status: completeItem.channel === 'call' ? completeForm.call_status : undefined,
        });
      }
      showToast('Follow-up updated', 'success');
      setCompleteItem(null);
      load();
    } catch (err) {
      showToast(getApiError(err));
    }
  };

  if (loading) return <p className="text-sm text-zoho-muted">Loading follow-ups…</p>;

  if (compact && !rows.length) return null;

  return (
    <div className="space-y-4">
      {!compact && (
        <div>
          <h2 className="text-base font-semibold text-zoho-text">Today&apos;s Follow-ups</h2>
          <p className="text-xs text-zoho-muted mt-1">LinkedIn and call actions due for manual outreach.</p>
        </div>
      )}

      <FollowupSection title="Overdue" tone="overdue" items={buckets.overdue} onComplete={setCompleteItem} />
      <FollowupSection title="Due Today" tone="today" items={buckets.dueToday} onComplete={setCompleteItem} />
      <FollowupSection title="Upcoming" tone="upcoming" items={buckets.upcoming} />
      {!compact && <FollowupSection title="Completed" tone="completed" items={buckets.completed.slice(0, 5)} />}

      {!rows.length && (
        <p className="text-sm text-zoho-muted text-center py-6 border border-dashed border-zoho-border rounded-xl">
          No LinkedIn or call follow-ups scheduled.
        </p>
      )}

      {completeItem && (
        <Modal title="Complete Follow-up" onClose={() => setCompleteItem(null)}>
          <div className="space-y-3">
            <FormField label="Completed Date">
              <input className="input" type="date" value={completeForm.completed_at} onChange={(e) => setCompleteForm((f) => ({ ...f, completed_at: e.target.value }))} />
            </FormField>
            <FormField label="Notes">
              <textarea className="input min-h-[80px]" value={completeForm.notes} onChange={(e) => setCompleteForm((f) => ({ ...f, notes: e.target.value }))} />
            </FormField>
            {completeItem.channel === 'call' && (
              <FormField label="Call Status">
                <select className="input" value={completeForm.call_status} onChange={(e) => setCompleteForm((f) => ({ ...f, call_status: e.target.value }))}>
                  {CALL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </FormField>
            )}
            <FormField label="Next Action">
              <input className="input" placeholder="e.g. Send LinkedIn message" value={completeForm.next_action} onChange={(e) => setCompleteForm((f) => ({ ...f, next_action: e.target.value }))} />
            </FormField>
            <FormField label="Next Action Date">
              <input className="input" type="date" value={completeForm.next_due_at} onChange={(e) => setCompleteForm((f) => ({ ...f, next_due_at: e.target.value }))} />
            </FormField>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <button type="button" onClick={() => setCompleteItem(null)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={submitComplete} className="btn-primary">Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
