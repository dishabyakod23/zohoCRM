'use client';
import { useCallback, useEffect, useState } from 'react';
import AppLink from '../ui/AppLink.js';
import Badge from '../ui/Badge.js';
import EnrollMembersModal from './EnrollMembersModal.js';
import { useToast } from '../ui/Toast.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { getApiError } from '../../lib/api.js';
import * as sequencesApi from '../../lib/services/sequences.js';
import { enrollmentStatusLabel } from '../../lib/sequenceHelpers.js';
import { tableLinkClass } from '../../lib/tableStyles.js';

export default function MemberSequencesPanel({ memberType, memberId, memberName }) {
  const { showToast } = useToast();
  const { can } = usePermissions();
  const canEnroll = can('sequences', 'enroll');
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const load = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      const rows = await sequencesApi.listMemberEnrollments({ member_type: memberType, member_id: memberId });
      setEnrollments(rows);
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, [memberType, memberId, showToast]);

  useEffect(() => { load(); }, [load]);

  const updateEnrollment = async (enrollmentId, payload) => {
    setUpdatingId(enrollmentId);
    try {
      await sequencesApi.updateEnrollment(enrollmentId, payload);
      showToast('Enrollment updated', 'success');
      load();
    } catch (err) {
      showToast(getApiError(err));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-zoho-text">Sequences</h3>
        {canEnroll && (
          <button type="button" onClick={() => setEnrollOpen(true)} className="btn-secondary-sm">
            Add to Sequence
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-zoho-muted">Loading…</p>
      ) : enrollments.length === 0 ? (
        <p className="text-xs text-zoho-muted">Not enrolled in any sequences.</p>
      ) : (
        <ul className="space-y-2">
          {enrollments.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm border border-zoho-border rounded-lg px-3 py-2">
              <AppLink href={`/sequences/${e.sequence_id}`} className={tableLinkClass}>
                {e.sequence_name || e.name || 'Sequence'}
              </AppLink>
              <Badge label={enrollmentStatusLabel(e.status)} />
              {e.current_step_order != null && (
                <span className="text-xs text-zoho-muted">Step {e.current_step_order}</span>
              )}
              <div className="ml-auto flex gap-1">
                {e.status === 'ACTIVE' && (
                  <button
                    type="button"
                    disabled={updatingId === e.id}
                    onClick={() => updateEnrollment(e.id, { status: 'PAUSED' })}
                    className="text-xs text-zoho-muted hover:text-brand-600"
                  >
                    Pause
                  </button>
                )}
                {e.status === 'PAUSED' && (
                  <button
                    type="button"
                    disabled={updatingId === e.id}
                    onClick={() => updateEnrollment(e.id, { status: 'ACTIVE' })}
                    className="text-xs text-zoho-muted hover:text-brand-600"
                  >
                    Resume
                  </button>
                )}
                {['ACTIVE', 'PAUSED'].includes(e.status) && (
                  <>
                    <button
                      type="button"
                      disabled={updatingId === e.id}
                      onClick={() => updateEnrollment(e.id, { mark_replied: true })}
                      className="text-xs text-zoho-muted hover:text-brand-600"
                    >
                      Mark Replied (override)
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === e.id}
                      onClick={() => updateEnrollment(e.id, { status: 'REMOVED' })}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <EnrollMembersModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        memberType={memberType}
        members={[{ member_type: memberType, member_id: memberId, name: memberName }]}
        onEnrolled={load}
      />
    </div>
  );
}
