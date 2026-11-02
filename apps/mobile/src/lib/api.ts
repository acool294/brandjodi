import type { ApiResult } from "@brandjodi/shared";
import { env } from "./env";
import { supabase } from "./supabase";

/**
 * Calls the Next.js API (/api/v1/*) with the user's Supabase access token. All state changes for
 * offers, contracts, submissions and payouts go through these routes, never straight to the database.
 */
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch(`${env.apiUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as ApiResult<T> | null;
  if (!json) throw new Error(`Server error (${res.status})`);
  if (!json.ok) throw new Error(json.error);
  return json.data;
}
