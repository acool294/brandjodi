import { z } from "zod";

/** Trims whitespace and surrounding quotes, which often sneak in when pasting into a dashboard. */
const clean = (v: unknown) =>
  typeof v === "string" ? v.trim().replace(/^["']|["']$/g, "") || undefined : v;

const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.preprocess(clean, z.url().default("http://localhost:3000")),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(clean, z.url()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.preprocess(clean, z.string().min(20)),
  // Off until Google is enabled in Supabase -> Authentication -> Sign In / Providers.
  NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN: z
    .preprocess(clean, z.string().optional())
    .transform((v) => ["true", "1", "yes"].includes((v ?? "").toLowerCase())),
  NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN: z
    .preprocess(clean, z.string().optional())
    .transform((v) => !["false", "0", "no"].includes((v ?? "true").toLowerCase())),
});

/** Public env vars are inlined at build time, so each must be referenced literally. */
const result = schema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  // ANON_KEY is the name the Supabase Vercel integration and older docs use.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN: process.env.NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN,
  NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN: process.env.NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN,
});

export const envProblems = result.success
  ? []
  : result.error.issues.map((i) => `${i.path.join(".")} (${i.message})`);

const message =
  `Missing or invalid environment variables: ${envProblems.join(", ")}. ` +
  "Set them in apps/web/.env.local, or in Vercel -> Settings -> Environment Variables and redeploy.";

// Don't fail `next build` (the deployment would never go live); warn loudly instead and fail on use.
// /api/health reports the problem on the deployed site.
if (!result.success) {
  if (process.env.NEXT_PHASE === "phase-production-build") console.warn(`\n⚠ ${message}\n`);
  else console.error(message);
}

export const env = result.success
  ? result.data
  : {
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "https://missing-env.invalid",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "missing",
      NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN: true,
      NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN: false,
    };
