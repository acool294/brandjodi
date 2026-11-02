"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@brandjodi/shared";
import { env } from "@/lib/env";

/** Supabase client for Client Components. Reads go through row-level security as the signed-in user. */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
