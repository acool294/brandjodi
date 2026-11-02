# BrandJodi

A marketplace where Indian D2C fashion and beauty brands hire creators for UGC and influencer content.
Brands use the **web dashboard**; creators use the **mobile app**. The platform holds the brand's
payment, freezes the terms into a contract, carries the content through approval, and pays the creator.

This repository is the **proof of concept** described in `../Creator_Marketplace_Plan_v2.md`
(section B5a). It runs at ₹0: Supabase free plan, Vercel Hobby, Expo Go, Razorpay test mode.

```
Brief → Apply → Offer / counter → Contract → Fund (Razorpay) → Submit → Revise / approve
      → (auto-approve after 5 days) → Payout KYC → Payout → Double-blind reviews
```

## Repository layout

```
apps/
  web/        Next.js 16 (App Router): brand dashboard, admin, public media kit pages, and /api/v1 for mobile
  mobile/     Expo SDK 57 (React Native, Expo Router): creator app
packages/
  shared/     Zod schemas, constants, fee rules, contract state machine, DB types (used by both apps)
supabase/
  migrations/ SQL schema, row-level security, workflow functions, storage, cron, push
  tests/      Workflow + RLS test that runs on in-memory Postgres (no Docker)
  config.toml Local Supabase stack config (auth, email code template, Google)
docs/         Architecture, account setup, decisions
```

## Quick start

Requirements: Node 22+ and pnpm 11 (`npm i -g pnpm@11`).

```bash
pnpm install
pnpm test          # unit tests (fee maths)
pnpm test:db       # applies all migrations to in-memory Postgres and runs the full money loop
pnpm lint && pnpm typecheck
```

### 1. Database (Supabase)

1. Create a free Supabase project (region **Mumbai, ap-south-1**). See [docs/setup-accounts.md](docs/setup-accounts.md).
2. Link and push the migrations:
   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <your-project-ref>
   pnpm db:push           # applies supabase/migrations
   pnpm db:types          # regenerates packages/shared/src/database.types.ts
   ```
3. In the Supabase dashboard set the email templates to send a 6-digit code (copy
   `supabase/templates/otp.html`) and add the redirect URLs listed in docs/setup-accounts.md.

Local alternative (needs Docker): `pnpm exec supabase start` then `pnpm db:reset`.

### 2. Web app (brands, admin, API)

```bash
cp apps/web/.env.example apps/web/.env.local   # fill in Supabase URL and keys
pnpm --filter @brandjodi/web seed:demo         # optional: demo brand, creator, admin, live campaign
pnpm dev:web                                   # http://localhost:3000
```

`PAYMENTS_PROVIDER=mock` (default) runs the whole loop with a fake checkout. Set it to `razorpay` with
test keys to use real Razorpay Checkout in test mode.

To make yourself an admin: `update profiles set is_admin = true where email = 'you@example.com';`
in the Supabase SQL editor, then open `/admin`.

### 3. Mobile app (creators)

```bash
cp apps/mobile/.env.example apps/mobile/.env   # same Supabase URL + publishable key; API URL = your machine's LAN IP:3000
pnpm dev:mobile                                # scan the QR code with Expo Go
```

## How the pieces fit

- **Reads** go straight from the apps to Supabase and are filtered by row-level security.
- **Simple writes** (own profile, campaigns of your brand, applications, chat messages) also go straight to Supabase under RLS.
- **Anything involving offers, contracts, money or reviews** goes through the Next.js server
  (`apps/web/src/server`), which calls a Postgres workflow function with the service role. Each function
  checks who is acting and the current state, and runs in one transaction. The mobile app reaches the
  same code through `/api/v1/*` with its Supabase access token.
- Money is integer **paise**. Every movement is a balanced **double-entry ledger** transaction.
- Fees and timers live in the `platform_settings` row and can be changed from `/admin` without a deploy.

More in [docs/architecture.md](docs/architecture.md).

## Scripts

| Command                                      | What it does                                             |
| -------------------------------------------- | -------------------------------------------------------- |
| `pnpm dev:web` / `pnpm dev:mobile`           | Run one app                                              |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Across all workspaces (Turborepo)                        |
| `pnpm test:db`                               | Migrations + workflow/RLS test on in-memory Postgres     |
| `pnpm db:push` / `pnpm db:types`             | Push migrations to the linked project / regenerate types |
| `pnpm format`                                | Prettier                                                 |

## What the POC does not do yet

See [docs/decisions.md](docs/decisions.md) for the full list. The main gaps: Razorpay **Route**
(split payment with hold and release) is not wired (payouts are simulated and recorded in the ledger);
phone OTP login (planned with Firebase or an SMS provider); Instagram/YouTube verified metrics;
video transcoding and watermarked previews; disputes; WhatsApp notifications; invitations and
shortlists; GST invoices.
