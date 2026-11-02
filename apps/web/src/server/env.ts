import "server-only";
import { z } from "zod";

const schema = z
  .object({
    SUPABASE_SECRET_KEY: z.string().min(20),
    PAYMENTS_PROVIDER: z.enum(["mock", "razorpay"]).default("mock"),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  })
  .refine(
    (e) => e.PAYMENTS_PROVIDER !== "razorpay" || (e.RAZORPAY_KEY_ID && e.RAZORPAY_KEY_SECRET),
    {
      message:
        "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required when PAYMENTS_PROVIDER=razorpay",
    },
  );

let cached: z.infer<typeof schema> | undefined;

/** Server-only env, validated on first use so `next build` works without secrets. */
export function serverEnv() {
  cached ??= schema.parse(process.env);
  return cached;
}
