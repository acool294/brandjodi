import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Actor } from "../auth";
import { DomainError, fromDbError } from "../errors";

export async function requireAdmin(actor: Actor) {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("is_admin")
    .eq("id", actor.userId)
    .single();
  if (!data?.is_admin) throw new DomainError("not_allowed", undefined, 403);
}

export const settingsSchema = z.object({
  brand_fee_bps: z.number().int().min(0).max(5000),
  creator_fee_bps: z.number().int().min(0).max(5000),
  gst_on_fee_bps: z.number().int().min(0).max(5000),
  auto_approve_days: z.number().int().min(1).max(30),
});

export async function updatePlatformSettings(actor: Actor, input: z.infer<typeof settingsSchema>) {
  await requireAdmin(actor);
  const parsed = settingsSchema.parse(input);
  const admin = createAdminClient();
  const { error } = await admin.from("platform_settings").update(parsed).eq("id", 1);
  if (error) throw fromDbError(error);
  await admin.rpc("audit", {
    p_actor: actor.userId,
    p_action: "settings.updated",
    p_target_type: "platform_settings",
    p_target_id: "1",
    p_details: parsed,
  });
}

export async function setOrganisationVerification(
  actor: Actor,
  orgId: string,
  status: "verified" | "rejected",
) {
  await requireAdmin(actor);
  const admin = createAdminClient();
  const { error } = await admin
    .from("organisations")
    .update({
      verification_status: status,
      verified_at: status === "verified" ? new Date().toISOString() : null,
    })
    .eq("id", orgId);
  if (error) throw fromDbError(error);
  await admin.rpc("audit", {
    p_actor: actor.userId,
    p_action: `organisation.${status}`,
    p_target_type: "organisation",
    p_target_id: orgId,
    p_details: {},
  });
}

/** Admin can trigger the scheduled job by hand (useful for demoing auto-approval). */
export async function runScheduledJobsNow(actor: Actor) {
  await requireAdmin(actor);
  const { data, error } = await createAdminClient().rpc("run_scheduled_jobs");
  if (error) throw fromDbError(error);
  return data;
}
