'use client';
import { useEffect, useState } from 'react';
import Modal from '../ui/Modal.js';
import FormField from '../forms/FormField.js';
import { useToast } from '../ui/Toast.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { getApiError } from '../../lib/api.js';
import * as sequencesApi from '../../lib/services/sequences.js';
import * as contactsApi from '../../lib/services/contacts.js';
import * as leadsApi from '../../lib/services/leads.js';
import { memberRefFromRecord } from '../../lib/sequenceHelpers.js';

const SEQUENCE_MEMBER_TYPES = {
  leads: 'lead',
  'raw-leads': 'lead',
  'qualified-leads': 'lead',
  proposals: 'lead',
  contacts: 'contact',
};

export default function EnrollMembersModal({
  open,
  onClose,
  members = [],
  memberType,
  sequenceId: fixedSequenceId,
  onEnrolled,
}) {
  const { showToast } = useToast();
  const [sequences, setSequences] = useState([]);
  const [sequenceId, setSequenceId] = useState(fixedSequenceId || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [pool, setPool] = useState([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [picked, setPicked] = useState(() => new Map());

  const needsPicker = open && !!fixedSequenceId && !(members?.length);

  useEffect(() => {
    if (!open) return;
    if (fixedSequenceId) {
      setSequenceId(fixedSequenceId);
      return;
    }
    setLoading(true);
    sequencesApi.listSequences({ status: 'ACTIVE', page_size: 100 })
      .then((res) => setSequences(res.data || []))
      .catch((err) => showToast(getApiError(err)))
      .finally(() => setLoading(false));
  }, [open, fixedSequenceId, showToast]);

  useEffect(() => {
    if (!needsPicker) return;
    let cancelled = false;
    setPoolLoading(true);
    const q = debouncedSearch.trim() || undefined;
    Promise.all([
      contactsApi.listContacts({ page: 1, page_size: 25, search: q }),
      leadsApi.listLeads({ page: 1, page_size: 25, search: q }),
    ])
      .then(([contacts, leads]) => {
        if (cancelled) return;
        const rows = [
          ...(contacts.data || []).filter((c) => c.email).map((c) => ({
            key: `contact:${c.id}`,
            member_type: 'contact',
            member_id: c.id,
            name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email,
            email: c.email,
            module: 'Contact',
          })),
          ...(leads.data || []).filter((l) => l.email).map((l) => ({
            key: `lead:${l.id}`,
            member_type: 'lead',
            member_id: l.id,
            name: `${l.first_name || ''} ${l.last_name || ''}`.trim() || l.company || l.email,
            email: l.email,
            module: 'Lead',
          })),
        ];
        setPool(rows);
      })
      .catch(() => { if (!cancelled) setPool([]); })
      .finally(() => { if (!cancelled) setPoolLoading(false); });
    return () => { cancelled = true; };
  }, [needsPicker, debouncedSearch]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setPicked(new Map());
      setPool([]);
    }
  }, [open]);

  const togglePick = (row) => {
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(row.key)) next.delete(row.key);
      else next.set(row.key, row);
      return next;
    });
  };

  const enroll = async () => {
    const targetId = fixedSequenceId || sequenceId;
    if (!targetId) {
      showToast('Select a sequence');
      return;
    }
    let payload = members.map((m) => {
      if (m.member_type && m.member_id) return m;
      const type = memberType || m.member_type;
      const id = m.id || m.member_id;
      return memberRefFromRecord({ id }, type);
    }).filter((m) => m?.member_type && m?.member_id);

    if (!payload.length && picked.size) {
      payload = Array.from(picked.values()).map((r) => ({
        member_type: r.member_type,
        member_id: r.member_id,
      }));
    }

    if (!payload.length) {
      showToast(needsPicker
        ? 'Select at least one contact or lead to enroll'
        : 'Select leads or contacts from their list, then use Add to Sequence');
      return;
    }
    setSaving(true);
    try {
      await sequencesApi.enrollMembers(targetId, payload);
      showToast(`Enrolled ${payload.length} member(s)`, 'success');
      onEnrolled?.();
      onClose();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const canSubmit = !!(fixedSequenceId || sequenceId)
    && !saving
    && (members.length > 0 || picked.size > 0);

  return (
    <Modal title="Add to Sequence" onClose={onClose} wide={needsPicker}>
      {!fixedSequenceId && (
        <FormField label="Sequence">
          <select
            className="input"
            value={sequenceId}
            onChange={(e) => setSequenceId(e.target.value)}
            disabled={loading}
          >
            <option value="">{loading ? 'Loading…' : 'Select sequence'}</option>
            {sequences.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </FormField>
      )}

      {needsPicker ? (
        <div className="mt-3 space-y-3">
          <input
            className="input"
            placeholder="Search contacts and leads by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <p className="text-xs text-zoho-muted">
            {picked.size} selected · search and check rows to enroll into this sequence.
          </p>
          <div className="border border-zoho-border rounded-lg max-h-72 overflow-y-auto divide-y divide-zoho-border">
            {poolLoading ? (
              <p className="text-sm text-zoho-muted px-3 py-6 text-center">Loading…</p>
            ) : pool.length === 0 ? (
              <p className="text-sm text-zoho-muted px-3 py-6 text-center">No matching people with email.</p>
            ) : pool.map((row) => (
              <label key={row.key} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  checked={picked.has(row.key)}
                  onChange={() => togglePick(row)}
                />
                <span className="text-sm text-zoho-text min-w-0 truncate">{row.name}</span>
                <span className="text-xs text-zoho-muted ml-auto shrink-0">{row.email}</span>
                <span className="text-[10px] uppercase tracking-wide text-brand-600 bg-brand-50 rounded px-1.5 py-0.5 shrink-0">
                  {row.module}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-zoho-muted mt-2">
          {members.length
            ? `${members.length} record(s) will be enrolled.${fixedSequenceId ? '' : ' Only active sequences are listed.'}`
            : 'Select leads or contacts from their list view, then use Add to Sequence from the bulk actions menu.'}
        </p>
      )}

      <div className="flex gap-2 justify-end pt-4">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button
          type="button"
          onClick={enroll}
          disabled={!canSubmit}
          className="btn-primary"
        >
          {saving ? 'Enrolling…' : 'Enroll'}
        </button>
      </div>
    </Modal>
  );
}

export { SEQUENCE_MEMBER_TYPES };
