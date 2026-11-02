# Architecture

## Overview

```
 Creator (Expo app) ──┐                         ┌── Supabase Auth (email code, Google)
                      ├── reads + simple writes ─┤── Postgres (RLS on every table)
 Brand (Next.js web) ─┘        (supabase-js)     ├── Storage (avatars, portfolio, submissions)
        │                                        ├── Realtime (chat, notifications)
        │ server actions                         └── pg_cron (auto-approval) + pg_net (Expo push)
        ▼                                                 ▲
 Next.js server  ── src/server/services ── service role ──┘  calls workflow functions
        ▲
        │ /api/v1/* (Bearer <supabase access token>)
 Creator (Expo app)
        │
 Razorpay ── /api/webhooks/razorpay (signature checked, idempotent)
```

## Where code lives

| Concern                                             | Location                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| Validation schemas, enums, fee maths, state machine | `packages/shared/src`                                               |
| Tables, RLS, grants                                 | `supabase/migrations/…01_core_schema.sql`, `…02_access_and_rls.sql` |
| State changes (offers, contracts, money, reviews)   | `supabase/migrations/…03_workflows.sql`                             |
| Storage buckets and policies                        | `…04_storage.sql`                                                   |
| Scheduled jobs, push notifications                  | `…05_cron_and_push.sql`                                             |
| Server domain layer (auth, services, payments)      | `apps/web/src/server`                                               |
| Web server actions (forms)                          | `apps/web/src/actions`                                              |
| Mobile API routes                                   | `apps/web/src/app/api/v1`                                           |
| Web pages                                           | `apps/web/src/app` (`(brand)` route group = signed-in brand area)   |
| Mobile screens                                      | `apps/mobile/src/app` (Expo Router; `(tabs)` = main tabs)           |

## Rules that keep money safe

1. Clients have **no INSERT/UPDATE grants** on offers, contracts, deliverables, submissions, payments,
   payouts, ledger or reviews. Those rows change only through workflow functions, which only the
   service role (and pg_cron) can execute.
2. Each workflow function takes the acting user (`p_user`), checks membership/ownership and the
   current status, locks the rows it changes (`for update`) and does everything in one transaction.
   Failures raise a short code (`not_allowed`, `invalid_state`, `no_revisions_left` …) which
   `apps/web/src/server/errors.ts` maps to a message.
3. Accepting an offer freezes the terms (campaign brief, deliverables, usage rights, fees) into
   `contracts.terms_snapshot` with a SHA-256 hash. Fees are computed from `platform_settings` at that
   moment, so changing fees never alters existing contracts.
4. `ledger_entries` is append-only (trigger). Funding writes:
   `escrow_hold Dr brand_total` / `creator_payable Cr` / `platform_revenue Cr` / `gst_payable Cr`.
   Payout writes `creator_payable Dr` / `escrow_hold Cr`. `/admin` shows whether debits equal credits.
5. Payment confirmation is idempotent: `record_payment_captured()` does nothing for an order that is
   already captured, and webhook event ids are unique in `webhook_events`.

## Contract lifecycle

```
awaiting_funding ──pay──▶ active ──submit──▶ in_review ──approve all──▶ approved ──payout──▶ paid_out
        │                                   │    ▲
     cancel                    request changes    │ resubmit
        ▼                                   ▼    │
    cancelled                       revision_requested
```

- Auto-approval: `run_scheduled_jobs()` (every 15 minutes) approves submissions older than
  `platform_settings.auto_approve_days`. Admins can run it by hand from `/admin`.
- Payout: if the creator has no payout details yet, the payout waits in `pending_kyc` and is released
  when they add them (`release_pending_payouts`). In the POC the transfer is simulated
  (`payouts.provider = 'simulated'`).

## Chat and contact masking

One conversation per application, continuing into the contract. A `before insert` trigger on
`messages` hides emails, UPI IDs, Indian phone numbers and WhatsApp/payment links until the contract
is funded (plan B4). System messages record offers, acceptance and funding in the thread.

## Notifications

Workflow functions insert rows into `notifications` (shown in-app via Realtime and in the web
dashboard). An `after insert` trigger posts each one to the Expo push API through `pg_net` for every
registered device token. Push needs an EAS project id (`npx eas-cli init`) and a physical device.

## Moving beyond the POC

- **Razorpay Route:** create a linked account at payout KYC, create the transfer `on_hold` at
  funding, release it on approval, and call `settle_payout()` from the transfer webhook.
  Changes are limited to `apps/web/src/server/payments`, `savePayoutAccount()` and `settle_payout()`.
- **Bigger backend:** `apps/web/src/server` has no Next.js dependencies apart from cookies in
  `auth.ts`, so it can move into a standalone service on the same database.
