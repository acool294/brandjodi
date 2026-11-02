"use server";

import { revalidatePath } from "next/cache";
import { requireWebActor } from "@/server/auth";
import {
  runScheduledJobsNow,
  setOrganisationVerification,
  updatePlatformSettings,
} from "@/server/services";
import { int, toActionError, type ActionState } from "./result";

export async function updateSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await updatePlatformSettings(await requireWebActor(), {
      brand_fee_bps: Math.round(Number(fd.get("brand_fee_pct")) * 100),
      creator_fee_bps: Math.round(Number(fd.get("creator_fee_pct")) * 100),
      gst_on_fee_bps: Math.round(Number(fd.get("gst_pct")) * 100),
      auto_approve_days: int(fd, "auto_approve_days"),
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/admin");
  return { ok: true, message: "Saved. New contracts use these numbers." };
}

export async function verifyOrganisationAction(orgId: string, status: "verified" | "rejected") {
  await setOrganisationVerification(await requireWebActor(), orgId, status);
  revalidatePath("/admin");
}

export async function runJobsAction(): Promise<ActionState> {
  try {
    const result = await runScheduledJobsNow(await requireWebActor());
    revalidatePath("/admin");
    return { ok: true, message: `Done: ${JSON.stringify(result)}` };
  } catch (e) {
    return toActionError(e);
  }
}
