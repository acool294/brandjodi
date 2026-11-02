import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@brandjodi/shared";
import { env } from "@/lib/env";
import { serverEnv } from "@/server/env";

let client: ReturnType<typeof createClient<Database>> | undefined;

/**
 * Service-role client. Bypasses row-level security, so use it only inside `src/server/**` after
 * checking who the caller is. All money and contract state changes go through it.
 */
export function createAdminClient() {
  client ??= createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
