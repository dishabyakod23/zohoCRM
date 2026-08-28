# SendGrid setup for CRM sequences

This guide maps [Twilio SendGrid domain authentication](https://www.twilio.com/docs/sendgrid/ui/account-and-settings/how-to-set-up-domain-authentication) to the CRM multi-touch outreach plan. **SendGrid runs on `salescrm-api` (backend), not in the Next.js frontend.**

## What SendGrid provides for sequences

| CRM need | SendGrid feature |
|----------|------------------|
| Send sequence emails | [Mail Send API v3](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send) |
| Remove `via sendgrid.net` | Domain authentication (SPF, DKIM, DMARC) |
| Open / click tracking | [Event Webhook](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event) + link branding CNAMEs |
| Bounce / block / spam report | Event Webhook (`bounce`, `dropped`, `spamreport`) |
| Unsubscribe | Event Webhook (`unsubscribe`, `group_unsubscribe`) |
| Reply detection | Inbound Parse or third-party reply webhook (configure separately) |
| Delivered | Event Webhook (`delivered`) |

## Step 1 — SendGrid account & API key

1. Create a SendGrid account (Twilio).
2. **Settings → API Keys** → create key with **Mail Send** (and **Event Webhook** read if needed).
3. Store on `salescrm-api`:

```env
SENDGRID_API_KEY=SG.xxxx
SEQUENCE_EMAIL_FROM_DEFAULT=outreach@yourdomain.com
```

The CRM sequence **Sending Email** field must use an address on the **authenticated domain** (e.g. `outreach@origami.com` if you authenticated `origami.com`).

## Step 2 — Domain authentication (DNS)

Follow Twilio: **Settings → [Sender Authentication](https://app.sendgrid.com/settings/sender_auth) → Domain Authentication → Get Started**.

### Prerequisites

- Know your DNS provider (GoDaddy, Route 53, Cloudflare, etc.).
- Have permission to add DNS records.
- Enter the **root domain** only (e.g. `example.com`, not `www.example.com`).

### Recommended settings

- **Use automated security**: ON (default) — SendGrid manages SPF/DKIM via CNAMEs.
- **Brand links**: ON — required for open/click tracking on your domain (link branding CNAMEs).
- **Use custom return path**: optional — controls bounce/unsubscribe routing subdomain.

### DNS records (automated security ON)

Add these at your DNS host (values come from SendGrid **Install DNS Records** page):

| Type | Host (example) | Purpose |
|------|----------------|---------|
| CNAME | `em1234.yourdomain.com` | Mail + SPF/DKIM |
| CNAME | `s1._domainkey.yourdomain.com` | DKIM |
| CNAME | `s2._domainkey.yourdomain.com` | DKIM |
| TXT | `_dmarc.yourdomain.com` | DMARC policy |

**GoDaddy / auto-append hosts:** if your provider appends the domain twice, enter only the hostname SendGrid shows (e.g. `em1234`, not `em1234.yourdomain.com.yourdomain.com`).

Click **Verify** in SendGrid. DNS can take up to **48 hours**.

## Step 3 — Link branding (opens & clicks)

If you enabled link branding during domain auth, tracking links use your domain instead of `sendgrid.net`. Without this, open/click stats still work but links may look less trusted.

## Step 4 — Send mail with CRM metadata

When the sequence worker sends email, include **custom arguments** so webhooks can update the right enrollment:

```json
{
  "personalizations": [{
    "to": [{"email": "lead@example.com"}],
    "custom_args": {
      "enrollment_id": "uuid",
      "step_id": "uuid",
      "sequence_id": "uuid",
      "variant_key": "A"
    }
  }],
  "from": {"email": "outreach@yourdomain.com", "name": "Origami Sales"},
  "subject": "...",
  "content": [{"type": "text/html", "value": "..."}],
  "tracking_settings": {
    "click_tracking": {"enable": true},
    "open_tracking": {"enable": true}
  }
}
```

Store SendGrid’s `X-Message-Id` as `provider_message_id` on send.

## Step 5 — Event Webhook (tracking → CRM)

1. SendGrid: **Settings → Mail Settings → Event Webhook**.
2. HTTP POST URL:

```text
https://salescrm-api.duckdns.org/api/v1/webhooks/email/sendgrid
```

3. Enable events:

| SendGrid event | CRM `event_type` | Action |
|----------------|------------------|--------|
| `processed` | (optional) | Log only |
| `delivered` | `DELIVERED` | Stats |
| `open` | `OPENED` | Stats |
| `click` | `CLICKED` | Stats; stop if `stop_on_click` |
| `bounce` | `BOUNCED` | Stop enrollment if `stop_on_bounce` |
| `dropped` | `BOUNCED` | Treat as failed send |
| `spamreport` | `UNSUBSCRIBED` | Stop if `stop_on_unsubscribe` |
| `unsubscribe` | `UNSUBSCRIBED` | Stop enrollment |
| `group_unsubscribe` | `UNSUBSCRIBED` | Stop enrollment |

4. Enable **Signed Event Webhook**; set verification key on API:

```env
SENDGRID_EVENT_WEBHOOK_VERIFICATION_KEY=...
```

Backend verifies signature, reads `custom_args.enrollment_id`, inserts `sequence_email_events`, updates eligibility.

## Step 6 — Reply detection (P1)

SendGrid does not emit a native “replied” event on standard Event Webhook. Options:

1. **Inbound Parse** — MX subdomain receives replies; match `In-Reply-To` to original `Message-ID`.
2. **Third-party** (e.g. Nylas, custom mailbox parser).

Map confirmed replies to `REPLIED` and stop the enrollment when `stop_on_reply` is true.

## Step 7 — CRM frontend alignment

- Sequence **Sending Email** must match authenticated domain.
- Analytics tab reads `GET /sequences/{id}/stats` (aggregated from events above).
- Manual **Mark Replied (override)** remains for edge cases only.

## Checklist before go-live

- [ ] Domain authentication verified in SendGrid
- [ ] Link branding verified (if using open/click tracking)
- [ ] API key on `salescrm-api`
- [ ] Event Webhook URL live and signed
- [ ] Test send with custom_args; confirm events in DB
- [ ] Bounce test → enrollment stops before next step
- [ ] Sequence activated with 250 CSV-enrolled leads

## References

- [Configure domain authentication](https://www.twilio.com/docs/sendgrid/ui/account-and-settings/how-to-set-up-domain-authentication)
- [Event Webhook reference](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event)
- [Mail Send API](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send)
- [Troubleshooting sender authentication](https://www.twilio.com/docs/sendgrid/ui/account-and-settings/troubleshooting-sender-authentication)
