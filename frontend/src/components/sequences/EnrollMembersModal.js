'use client';
import { useEffect, useState } from 'react';
import Modal from '../ui/Modal.js';
import FormField from '../forms/FormField.js';
import { useToast } from '../ui/Toast.js';
import { getApiError } from '../../lib/api.js';
import * as sequencesApi from '../../lib/services/sequences.js';
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

  const enroll = async () => {
    const targetId = fixedSequenceId || sequenceId;
    if (!targetId) {
      showToast('Select a sequence');
      return;
    }
    const payload = members.map((m) => {
      if (m.member_type && m.member_id) return m;
      const type = memberType || m.member_type;
      const id = m.id || m.member_id;
      return memberRefFromRecord({ id }, type);
    });
    if (!payload.length) {
      showToast('Select leads or contacts from their list, then use Add to Sequence');
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

  return (
    <Modal title="Add to Sequence" onClose={onClose}>
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
      <p className="text-xs text-zoho-muted mt-2">
        {members.length
          ? `${members.length} record(s) will be enrolled.${fixedSequenceId ? '' : ' Only active sequences are listed.'}`
          : 'Select leads or contacts from their list view, then use Add to Sequence from the bulk actions menu.'}
      </p>
      <div className="flex gap-2 justify-end pt-4">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button
          type="button"
          onClick={enroll}
          disabled={!(fixedSequenceId || sequenceId) || saving || !members.length}
          className="btn-primary"
        >
          {saving ? 'Enrolling…' : 'Enroll'}
        </button>
      </div>
    </Modal>
  );
}

export { SEQUENCE_MEMBER_TYPES };
