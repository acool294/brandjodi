import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@brandjodi/shared";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { DomainError } from "./errors";

export interface Actor {
  userId: string;
  email: string | undefined;
  /** Client scoped to this user: reads and simple writes go through row-level security. */
  db: SupabaseClient<Database>;
  ip: string | undefined;
}

/** The signed-in user on the web (session cookie). */
export async function getWebActor(): Promise<Actor | null> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  return { userId: user.id, email: user.email, db, ip: undefined };
}

export async function requireWebActor(): Promise<Actor> {
  const actor = await getWebActor();
  if (!actor) throw new DomainError("not_signed_in", undefined, 401);
  return actor;
}

/** The signed-in user calling /api/v1 from the mobile app (Authorization: Bearer <supabase access token>). */
export async function requireApiActor(request: Request): Promise<Actor> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  if (!token) {
    // Fall back to cookies so the same routes work from the browser.
    const actor = await requireWebActor();
    return { ...actor, ip };
  }

  const db = createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const {
    data: { user },
    error,
  } = await db.auth.getUser(token);
  if (error || !user) throw new DomainError("not_signed_in", undefined, 401);
  return { userId: user.id, email: user.email, db, ip };
}
