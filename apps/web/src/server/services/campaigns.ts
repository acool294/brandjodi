import "server-only";
import { campaignSchema, type CampaignInput, type CampaignStatus } from "@brandjodi/shared";
import type { Actor } from "../auth";
import { fromDbError } from "../errors";
import { requireMyOrganisation } from "./organisations";

export async function createCampaign(
  actor: Actor,
  input: CampaignInput,
  publish: boolean,
): Promise<string> {
  const { deliverables, ...campaign } = campaignSchema.parse(input);
  const org = await requireMyOrganisation(actor);

  const { data, error } = await actor.db
    .from("campaigns")
    .insert({
      ...campaign,
      org_id: org.id,
      created_by: actor.userId,
      status: publish ? "published" : "draft",
    })
    .select("id")
    .single();
  if (error) throw fromDbError(error);

  const { error: dErr } = await actor.db
    .from("campaign_deliverables")
    .insert(deliverables.map((d, i) => ({ ...d, campaign_id: data.id, sort_order: i })));
  if (dErr) throw fromDbError(dErr);

  return data.id as string;
}

export async function setCampaignStatus(actor: Actor, campaignId: string, status: CampaignStatus) {
  const { error } = await actor.db.from("campaigns").update({ status }).eq("id", campaignId);
  if (error) throw fromDbError(error);
}
