import { z } from "zod";

/** Trims whitespace and surrounding quotes, which often sneak in when pasting into a dashboard. */
const clean = (v: unknown) =>
  typeof v === "string" ? v.trim().replace(/^["']|["']$/g, "") || undefined : v;

const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.preprocess(clean, z.url().default("http://localhost:3000")),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(clean, z.url()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.preprocess(clean, z.string().min(20)),
  NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN: z
    .preprocess(clean, z.string().optional())
    .transform((v) => ["true", "1", "yes"].includes((v ?? "").toLowerCase())),
});

/** Public env vars are inlined at build time, so each must be referenced literally. */
const result = schema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN: process.env.NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN,
});

if (!result.success) {
  const problems = result.error.issues.map((i) => `${i.path.join(".")} (${i.message})`).join(", ");
  throw new Error(
    `Missing or invalid environment variables: ${problems}. ` +
      "Set them in apps/web/.env.local, or in Vercel -> Settings -> Environment Variables and redeploy.",
  );
}

export const env = result.data;
