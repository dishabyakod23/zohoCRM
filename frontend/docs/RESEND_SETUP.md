# Resend + Sequences — backend handoff

The **Next.js CRM frontend is done**. It calls `salescrm-api` at `/api/v1/sequences/*`. Your backend dev implements the API, database, Resend sending, webhooks, and a scheduler worker.

Provider: **[Resend](https://resend.com/)** (not SendGrid).

---

## Environment (`salescrm-api`)

```env
RESEND_API_KEY=re_xxxx
RESEND_WEBHOOK_SECRET=whsec_xxxx
SEQUENCE_EMAIL_PROVIDER=resend
```

---

## Resend dashboard setup

1. **Domain** — Add domain, publish SPF/DKIM/DMARC DNS records, verify.
2. **Webhook** — `POST https://salescrm-api.duckdns.org/api/v1/webhooks/email/resend`
3. Subscribe: `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`
4. Copy signing secret → `RESEND_WEBHOOK_SECRET`

---

## Database tables (PostgreSQL)

| Table | Purpose |
|-------|---------|
| `sequences` | Name, status, owner, `sending_email`, `email_provider` (`resend`), timezone, send window, send_days bitmask, daily limit, stop rules |
| `sequence_steps` | Ordered steps: `AUTO_EMAIL`, `AB_EMAIL`, LinkedIn/call types; `scheduled_date`, `scheduled_time`, `timezone`, subject/html |
| `sequence_step_variants` | A/B rows: `variant_key` A/B, subject, html per step |
| `sequence_enrollments` | `member_type` (`lead`/`contact`), `member_id`, status, `current_step_id`, `next_action_at`, `variant_key`, stop_reason |
| `sequence_email_events` | `event_type`, `enrollment_id`, `step_id`, `variant_key`, `provider_message_id`, `occurred_at` |
| `sequence_email_send_log` | Outbound log: to, subject, Resend `email_id` |
| `sequence_daily_send_counts` | Per-sequence daily cap enforcement |

**Statuses:** sequence `DRAFT|ACTIVE|PAUSED|ARCHIVED`; enrollment `ACTIVE|PAUSED|COMPLETED|FAILED|REMOVED`

**Event types:** `SENT`, `DELIVERED`, `OPENED`, `CLICKED`, `REPLIED`, `BOUNCED`, `UNSUBSCRIBED`

---

## REST API (must match frontend)

Frontend client: `src/lib/services/sequences.js`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/sequences` | Paginated list; include `enrollment_count`, `active_enrollment_count` |
| POST | `/sequences` | Create (body below) |
| GET | `/sequences/{id}` | Detail |
| PATCH | `/sequences/{id}` | Partial update |
| DELETE | `/sequences/{id}` | |
| POST | `/sequences/{id}/activate` | Set ACTIVE |
| POST | `/sequences/{id}/pause` | Set PAUSED |
| GET | `/sequences/{id}/steps` | Ordered steps + `variants[]` |
| POST | `/sequences/{id}/steps` | Create step |
| PATCH | `/sequences/{id}/steps/{stepId}` | Update step |
| DELETE | `/sequences/{id}/steps/{stepId}` | |
| POST | `/sequences/{id}/enroll` | `{ members: [{ member_type, member_id }] }` |
| GET | `/sequences/{id}/enrollments` | Paginated; resolve `member_name` |
| PATCH | `/enrollments/{id}` | Pause/resume; `mark_replied: true` → REPLIED + optional stop; **`next_action_at` (ISO UTC) must be persisted and echoed in the response** when rescheduling |
| GET | `/sequences/enrollments/by-member` | `?member_type=&member_id=` |
| POST | `/sequences/{id}/preview` | Render merge fields |
| POST | `/sequences/{id}/send-test` | `{ to_email, step_id?, subject?, html_body? }` |
| GET | `/sequences/{id}/stats` | Analytics (shape below) |
| GET | `/sequences/{id}/steps/{stepId}/stats` | Per-step funnel |
| GET | `/email-templates` | Optional template picker |

**Create sequence body:** `name`, `description`, `sending_email`, `timezone`, `send_window_start/end`, `send_days` (bitmask Mon=1…Sun=64, default 62), `daily_send_limit`, `stop_on_reply/click/unsubscribe/bounce`, `allow_re_enrollment`, `owner_id`

**Step body:** `step_order`, `type`, `scheduled_date`, `scheduled_time`, `timezone`, `scheduled_at` (UTC ISO — frontend sends this from date/time/timezone), `subject`, `html_body`, `text_body`, `task_title`, `task_description`, `active`, `variants[]`

When enrolling or scheduling, prefer `scheduled_at` over treating `scheduled_time` as UTC.

---

## Stats response (`GET /sequences/{id}/stats`)

Frontend reads flexible keys; return at least:

```json
{
  "enrolled": 120,
  "eligible": 95,
  "pending": 12,
  "completed": 8,
  "sent": 400,
  "delivered": 390,
  "opened": 180,
  "clicked": 42,
  "replied": 15,
  "bounced": 5,
  "unsubscribed": 2,
  "reply_rate": 12.5,
  "step_funnel": [
    {
      "step_id": "uuid",
      "step_order": 1,
      "type": "AUTO_EMAIL",
      "eligible": 95,
      "sent": 95,
      "delivered": 93,
      "opened": 40,
      "clicked": 10,
      "replied": 5,
      "bounced": 2,
      "pending": 0
    }
  ],
  "ab_variants": [
    { "variant_key": "A", "sent": 50, "delivered": 49, "opened": 22, "clicked": 6, "replied": 3, "bounced": 1 },
    { "variant_key": "B", "sent": 45, "delivered": 44, "opened": 18, "clicked": 4, "replied": 2, "bounced": 1 }
  ]
}
```

---

## Resend send (worker)

When `next_action_at <= now` and enrollment is ACTIVE:

1. Load lead/contact email + merge fields (`{{first_name}}`, `{{company}}`, etc.)
2. For `AB_EMAIL`, pick variant A/B deterministically per enrollment (hash enrollment id)
3. `POST https://api.resend.com/emails`:

```json
{
  "from": "<sequence.sending_email>",
  "to": ["prospect@example.com"],
  "subject": "...",
  "html": "...",
  "tags": [
    { "name": "enrollment_id", "value": "..." },
    { "name": "step_id", "value": "..." },
    { "name": "sequence_id", "value": "..." },
    { "name": "variant_key", "value": "A" }
  ]
}
```

4. Store Resend `id` in `sequence_email_send_log` + `provider_message_id`
5. Insert `SENT` event; advance to next step / set `next_action_at` from step schedule
6. Enforce `daily_send_limit`, send window, `send_days` bitmask

---

## Webhook handler

`POST /api/v1/webhooks/email/resend` — verify signature with `RESEND_WEBHOOK_SECRET`.

| Resend `type` | CRM event | Stop rule |
|---------------|-----------|-----------|
| `email.sent` | `SENT` | — |
| `email.delivered` | `DELIVERED` | — |
| `email.opened` | `OPENED` | — |
| `email.clicked` | `CLICKED` | `stop_on_click` |
| `email.bounced` | `BOUNCED` | `stop_on_bounce` |
| `email.complained` | `UNSUBSCRIBED` | `stop_on_unsubscribe` |

Parse tags from payload to find `enrollment_id` / `step_id`. Deduplicate events by Resend email id + event type.

**Replies:** Resend webhooks do not include `REPLIED`. Options: Resend Inbound, or honor frontend `PATCH /enrollments/{id}` with `mark_replied: true`.

---

## Background worker

Cron/Celery every ~1 min:

- Find ACTIVE enrollments where `next_action_at <= now()`
- Skip if sequence PAUSED or daily limit hit
- Execute step (email via Resend, or create task for LinkedIn/call steps)
- On sequence complete → enrollment `COMPLETED`

---

## Frontend already wired

- List/create/detail sequences, step builder, enroll modal, analytics panel, test email button
- Permissions: `sequences` module with `view`, `create`, `edit`, `delete`, `enroll`
- Sending email hint points here (`docs/RESEND_SETUP.md`)

No Resend keys in the frontend — all secrets stay on `salescrm-api`.

---

## References

- [Resend](https://resend.com/)
- [Resend API — Send Email](https://resend.com/docs/api-reference/emails/send-email)
- [Resend Webhooks](https://resend.com/docs/webhooks/introduction)
