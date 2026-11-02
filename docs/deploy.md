# Deploying the web app (Vercel + GitHub)

Repo: https://github.com/acool294/brandjodi. Every push to `main` deploys to production; every pull
request gets a preview URL.

## Vercel project settings

- Import the GitHub repo, **Root Directory = `apps/web`** (framework: Next.js, detected).
- Install/build commands: leave the defaults. Vercel installs from the repo root because it detects the
  pnpm workspace.
- Function region: Mumbai (`bom1`), next to the Supabase project.

## Environment variables (Production and Preview)

| Name | Value |
| --- | --- |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` (makes Vercel use pnpm 11 from `packageManager` in the root `package.json`) |
| `NEXT_PUBLIC_APP_URL` | the Vercel URL, e.g. `https://brandjodi.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | from `apps/web/.env.local` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | from `apps/web/.env.local` |
| `SUPABASE_SECRET_KEY` | from `apps/web/.env.local` (Vercel only, never commit) |
| `PAYMENTS_PROVIDER` | `mock` until Razorpay test keys are added |
| `NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN` | `true` while the demo accounts are used |

`NEXT_PUBLIC_*` values are baked in at build time: redeploy after changing them.

## Supabase

Authentication → URL Configuration: Site URL = the Vercel URL, and add
`https://<vercel-domain>/auth/callback` to the redirect URLs.

## Mobile app

Point `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` at the Vercel URL so the app uses the deployed API.
