# Lead salutation — backend handoff

## Problem

CRM Lead detail / create forms send `salutation` (and `prefix`), but **`salescrm-api` Lead schemas omit the field**. Contact schemas already include `salutation`.

Verified on `https://test-crm.origami.dev/openapi.json`:

| Schema | Has `salutation`? |
|--------|-------------------|
| `LeadCreate` / `LeadUpdate` / `LeadOut` | **No** |
| `ContactCreate` / `ContactUpdate` / `ContactOut` | **Yes** |

`PATCH /leads/{id}` with `{ "salutation": "Ms." }` returns **200** but the value is **silently dropped**. `GET /leads/{id}` never returns `salutation`.

Frontend already sends the field; Warm Lead UI shows `—` after reload because nothing is stored.

## Required backend change

1. Add nullable `salutation` (string, e.g. `Mr.` / `Mrs.` / `Ms.` / `Dr.` / `Prof.`) to the **leads** table.
2. Add `salutation` to **`LeadCreate`**, **`LeadUpdate`**, and **`LeadOut`**.
3. Persist on `POST /leads` and `PATCH /leads/{id}`; return on `GET /leads` and `GET /leads/{id}`.
4. (Optional) Accept legacy `prefix` as an alias that maps to `salutation`.

## Frontend behavior until backend ships

- Continues to send `salutation` + `prefix` on create/update.
- If the API drops the value, the detail page keeps it in **session UI state** and shows an error toast explaining the backend gap.
- After a full page reload, salutation will still be blank until the API supports it.

## How to verify

```http
PATCH /api/v1/leads/{id}
{ "salutation": "Ms." }

GET /api/v1/leads/{id}
→ "salutation": "Ms."
```
