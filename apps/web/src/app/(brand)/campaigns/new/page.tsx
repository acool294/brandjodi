import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell";
import { getBrandSession } from "@/server/session";
import { CampaignForm } from "./campaign-form";

export const metadata: Metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  const { actor } = await getBrandSession();
  const { data: settings } = await actor.db
    .from("platform_settings")
    .select("brand_fee_bps, creator_fee_bps, gst_on_fee_bps")
    .single();

  return (
    <>
      <PageHeader
        title="New campaign"
        subtitle="A clear brief means fewer revisions. Deliverables, usage rights and disclosure become part of the contract."
      />
      <CampaignForm
        fees={{
          brandFeeBps: settings?.brand_fee_bps ?? 1000,
          creatorFeeBps: settings?.creator_fee_bps ?? 0,
          gstOnFeeBps: settings?.gst_on_fee_bps ?? 1800,
        }}
      />
    </>
  );
}
