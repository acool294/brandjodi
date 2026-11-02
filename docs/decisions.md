# Decisions and known gaps

## Decided (29 Oct 2026)

| Topic           | Decision                                                                                                         | Notes                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Name            | BrandJodi                                                                                                        |                                                               |
| Stack           | Next.js 16 + Supabase + Expo SDK 57, TypeScript, pnpm + Turborepo                                                | Stable majors that have been out for months                   |
| Platforms       | Creators on mobile, brands on web, admin on web                                                                  | Same API for both                                             |
| Fees            | Brand pays +10% (+18% GST on the fee), creator pays 0%                                                           | Stored in `platform_settings`; editable in `/admin`           |
| Payments        | Razorpay, test mode                                                                                              | `PAYMENTS_PROVIDER=mock` for keyless demos                    |
| Login           | Email 6-digit code + Google                                                                                      | Phone OTP later (below)                                       |
| Data access     | Supabase client + RLS for reads and simple writes; workflow SQL functions via the server for money and contracts | Keeps business rules transactional without a separate backend |
| DB types        | Generated with `supabase gen types` into `packages/shared`                                                       | Placeholder `any` types until a project is linked             |
| Migrations      | Plain SQL in `supabase/migrations`                                                                               | No ORM in the POC                                             |
| Creator metrics | Self-reported, labelled "unverified"                                                                             |                                                               |
| Payouts         | Simulated, recorded in the ledger                                                                                |                                                               |

## Later (in rough order)

1. **Razorpay Route** for split payments with hold and release, linked accounts for creators, real
   payouts and transfer webhooks. Check hold-period limits with Razorpay.
2. **Phone OTP login.** Options: Supabase phone auth with MSG91/Twilio, or Firebase Phone Auth with
   Supabase's third-party auth (`[auth.third_party.firebase]` in `config.toml`). Costs about
   ₹0.15–0.25 per OTP.
3. Instagram and YouTube OAuth for verified metrics and live-post checks (start Meta app review early).
4. Video transcoding, watermarked previews and originals locked until approval (Mux or Cloudflare Stream).
5. Disputes (open, freeze, admin release/refund/split), refunds after funding.
6. Invitations, shortlists, saved searches.
7. GST invoices for the platform fee; TDS/TCS handling after the CA review.
8. WhatsApp notifications (approved templates via a BSP), email notifications (Resend).
9. Submission reminders on day 2 and day 4 before auto-approval.
10. Report/block UI (tables exist), account deletion in-app (app store requirement).
11. Influencer posts: separate "draft approval" step before the live link (POC requires the live link).
12. Rate limiting on OTP, messages and applications; Sentry and PostHog.

## Known POC limitations

- A brand user belongs to one organisation in the UI (the data model supports many).
- Payout KYC keeps only the last 4 digits of PAN and bank account.
- The campaign builder has no AI brief assistant.
- Expo push needs an EAS project id; without it notifications are in-app only.
