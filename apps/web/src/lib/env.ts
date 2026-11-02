import { z } from "zod";

/** Public env vars are inlined at build time, so each must be referenced literally. */
const publicEnv = z
  .object({
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
    NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  })
  .parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN: process.env.NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN,
  });

export const env = publicEnv;
