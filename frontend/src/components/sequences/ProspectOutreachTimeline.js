'use client';
import { useEffect, useMemo, useState } from 'react';
import { getLinkedInRequestSent, getEmailSentEvents } from '../../lib/outreachActivity.js';
import { formatContactLastCallLabel } from '../../lib/contactActivityEnrichment.js';
import * as cloudTalkApi from '../../lib/services/cloudTalkCalls.js';
import * as followupsApi from '../../lib/services/followups.js';

function sortByDateDesc(a, b) {
  return new Date(b.at) - new Date(a.at);
}

export default function ProspectOutreachTimeline({
  memberType,
  memberId,
  memberName,
  phones = [],
}) {
  const [calls, setCalls] = useState([]);
  const [followups, setFollowups] = useState([]);

  useEffect(() => {
    if (!memberId) return;
    followupsApi.listFollowups({ member_type: memberType, member_id: memberId })
      .then(setFollowups)
      .catch(() => setFollowups([]));
  }, [memberType, memberId]);

  useEffect(() => {
    cloudTalkApi.listCloudTalkCallsLastDays(30, {}, { limit: 50 }).then((res) => {
      setCalls(res.data || res || []);
    }).catch(() => setCalls([]));
  }, []);

  const events = useMemo(() => {
    const rows = [];
    const linkedIn = getLinkedInRequestSent(memberType === 'contact' ? memberId : null);
    if (linkedIn?.sent_at) {
      rows.push({ at: linkedIn.sent_at, type: 'linkedin', label: 'LinkedIn connection request sent' });
    }

    const emails = getEmailSentEvents(memberType === 'contact' ? memberId : null) || [];
    for (const e of emails) {
      rows.push({ at: e.sent_at, type: 'email', label: 'Email sent (manual)' });
    }

    for (const f of followups) {
      if (f.completed_at) {
        rows.push({
          at: f.completed_at,
          type: f.channel || 'task',
          label: `${f.action_label || f.action_type || 'Follow-up'} completed`,
          notes: f.notes,
        });
      } else if (f.due_at || f.due_date) {
        rows.push({
          at: f.due_at || f.due_date,
          type: f.channel || 'task',
          label: `${f.action_label || f.action_type || 'Follow-up'} due`,
          upcoming: true,
        });
      }
    }

    for (const log of calls) {
      if (log.source !== 'cloudtalk') continue;
      const phone = log.meta?.external_number || log.meta?.cdr?.public_external;
      if (!phone) continue;
      rows.push({
        at: log.created_at,
        type: 'call',
        label: log.summary || formatContactLastCallLabel({ created_at: log.created_at, status: 'answered', duration: log.meta?.duration }),
      });
    }

    return rows.sort(sortByDateDesc);
  }, [memberId, memberType, followups, calls]);

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-zoho-text mb-3">Outreach Activity</h3>
      {events.length === 0 ? (
        <p className="text-xs text-zoho-muted">No outreach activity recorded yet for {memberName || 'this prospect'}.</p>
      ) : (
        <ul className="space-y-3">
          {events.map((event, i) => (
            <li key={`${event.at}-${i}`} className="flex gap-3 text-sm">
              <span className="text-xs text-zoho-muted w-24 shrink-0 pt-0.5">
                {new Date(event.at).toLocaleDateString()}
              </span>
              <div>
                <p className={`font-medium ${event.upcoming ? 'text-amber-700' : 'text-zoho-text'}`}>
                  {iconFor(event.type)} {event.label}
                </p>
                {event.notes && <p className="text-xs text-zoho-muted mt-0.5">{event.notes}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function iconFor(type) {
  if (type === 'email') return '✉';
  if (type === 'linkedin') return 'in';
  if (type === 'call') return '☎';
  return '•';
}
