# Contributing

- Branch from `main`, open a pull request, and keep CI green (`pnpm lint && pnpm typecheck && pnpm test && pnpm test:db`).
- **Database changes:** add a new file in `supabase/migrations` (`YYYYMMDDHHMMSS_description.sql`); never edit a
  migration that has been pushed. Enable RLS and write policies for every new table. Then run
  `pnpm test:db`, `pnpm db:push` and `pnpm db:types`.
- **Money or contract state:** add or change a workflow function in SQL and call it from
  `apps/web/src/server/services`. Do not give clients write grants on those tables.
- **Shared rules** (validation, enums, fees) go in `packages/shared` so web and mobile agree.
- **Mobile dependencies:** add with `npx expo install <pkg>` inside `apps/mobile` so versions match the Expo SDK.
- **Next.js:** this is Next 16 (`proxy.ts` instead of middleware; async `params`/`cookies`). Read
  `node_modules/next/dist/docs` before using an unfamiliar API.
- Money is always integer paise; format with `formatINR` from `@brandjodi/shared`.
- Never commit `.env`, `.env.local` or keys. Update the `.env.example` files when adding variables.
