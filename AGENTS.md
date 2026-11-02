# Notes for coding agents

Read `README.md` and `docs/architecture.md` first. Per-app notes: `apps/web/AGENTS.md` (Next.js 16).
Mobile uses Expo SDK 57: check https://docs.expo.dev/versions/v57.0.0/ before using an Expo API and
add native packages with `npx expo install`. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:db`
before finishing. Money and contract state change only through SQL workflow functions (see CONTRIBUTING.md).
