# Accounts and keys for the POC (all free)

## Supabase

**Current project:** `brandjodi` (ref `sljbmhxnrlklfldxxwgq`, Mumbai, free plan), created 29 Oct 2026 with
all migrations applied. Steps below are for a fresh project.

1. Create a project at supabase.com (free plan), region **South Asia (Mumbai)**.
2. Project Settings → API: copy the **Project URL**, the **publishable (anon) key** and the
   **secret (service_role) key**.
   - Web: `apps/web/.env.local` → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
   - Mobile: `apps/mobile/.env` → `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - The secret key goes **only** in the web server env (and Vercel). Never in the mobile app.
3. Apply the schema: `pnpm exec supabase link --project-ref <ref>` then `pnpm db:push`.
4. Authentication → URL Configuration:
   - Site URL: your web URL (e.g. `http://localhost:3000`, later the Vercel URL)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://<vercel-domain>/auth/callback`,
     `brandjodi://auth-callback`, `exp://**` (Expo Go during development)
5. Authentication → Emails: in **Magic link** and **Confirm signup**, replace the body with
   `supabase/templates/otp.html` so emails contain the 6-digit `{{ .Token }}` code.
6. **Email sending limit:** the built-in Supabase mailer only sends a few emails per hour and only to
   members of your Supabase org. For testers outside the team, add custom SMTP with a free
   **Resend** account (Authentication → SMTP settings). Until then, use the demo password accounts
   from `pnpm --filter @brandjodi/web seed:demo`.
7. **POC: email + password sign-up.** Authentication → Sign In / Providers → Email: switch **off**
   "Confirm email" so new accounts can sign in straight away without an email round-trip.
8. Free projects pause after a week without use; open the dashboard to resume.

## Google sign-in

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → **Web application**.
2. Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Sign In / Providers → Google: paste the client ID and secret.
4. The OAuth consent screen can stay in "Testing" mode with your testers added as test users.

## Razorpay (test mode)

1. Sign up at razorpay.com; stay in **Test mode** (toggle in the dashboard). No KYC needed for test mode.
2. Account & Settings → API Keys → Generate test key. Put them in `apps/web/.env.local`:
   `PAYMENTS_PROVIDER=razorpay`, `RAZORPAY_KEY_ID=rzp_test_…`, `RAZORPAY_KEY_SECRET=…`
3. Webhooks (optional locally, needed when deployed): URL `https://<web-domain>/api/webhooks/razorpay`,
   events `payment.captured` and `order.paid`, and a secret you also set as `RAZORPAY_WEBHOOK_SECRET`.
4. Test payments: use Razorpay's published test cards or the test UPI ID `success@razorpay`.
5. Before real money: apply for **Route** activation, which the payout step will use (see architecture.md).

## Expo

- Development: install **Expo Go** on your phone and run `pnpm dev:mobile`.
- Push notifications and installable Android builds need a free Expo account:
  `npx eas-cli@latest login`, then `npx eas-cli@latest init` inside `apps/mobile` (adds the project id),
  then `npx eas-cli@latest build -p android --profile preview` for an internal APK.

## Vercel (web hosting)

Import the GitHub repo, set **Root Directory** to `apps/web`, add the env vars from
`apps/web/.env.example`, and choose the Mumbai (`bom1`) function region.
