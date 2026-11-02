import "server-only";
import type { Database } from "@brandjodi/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { fromDbError } from "./errors";

type WorkflowName = keyof Database["public"]["Functions"];

/**
 * Calls a workflow function in Postgres with the service role. The functions check the acting user
 * (p_user) and the current state themselves, and run in a single transaction.
 */
export async function callWorkflow<T = unknown>(
  fn: WorkflowName,
  args: Record<string, unknown>,
): Promise<T> {
  // Inputs are validated with Zod in the services before they get here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await createAdminClient().rpc(fn, args as any);
  if (error) throw fromDbError(error);
  return data as T;
}
