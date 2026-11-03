import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatINR, labelFor } from "@brandjodi/shared";
import { setApplicationStatusAction, setCampaignStatusAction } from "@/actions/brand";
import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/app-shell";
import { Pill, StatusBadge } from "@/components/ui/badge";
import { Avatar, Card, CardTitle } from "@/components/ui/card";
import { CreatorQuickView } from "@/components/creator-quick-view";
import { formatDate } from "@/lib/utils";
import { getBrandSession } from "@/server/session";

export const metadata: Metadata = { title: "Campaign" };

const COLUMNS = [
  { key: "new", title: "New", statuses: ["submitted"] },
  { key: "shortlisted", title: "Shortlisted", statuses: ["shortlisted"] },
  { key: "offered", title: "Offered", statuses: ["offered"] },
  { key: "hired", title: "Hired", statuses: ["hired"] },
] as const;

export default async function CampaignPage({ params }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const { actor } = await getBrandSession();

  const { data: campaign } = await actor.db
    .from("campaigns")
    .select("*, campaign_deliverables(*)")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) notFound();

  const { data: applications } = await actor.db
    .from("applications")
    .select(
      "id, status, quoted_price, delivery_days, pitch, created_at, creator_profiles(username, display_name, city, instagram_followers, rating_avg, metrics_verified)",
    )
    .eq("campaign_id", id)
    .order("created_at", { ascending: false });

  const rejected = (applications ?? []).filter((a) => ["rejected", "withdrawn"].includes(a.status));
  const usage = campaign.usage_rights as { channels: string[]; duration_days: number };

  return (
    <>
      <PageHeader
        title={campaign.title}
        subtitle={`${labelFor(campaign.category)} · ${formatINR(campaign.budget_per_creator)} per creator · ${campaign.creators_needed} needed`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={campaign.status} />
            {campaign.status !== "published" && campaign.status !== "closed" && (
              <ActionButton size="sm" action={setCampaignStatusAction.bind(null, id, "published")}>
                Publish
              </ActionButton>
            )}
            {campaign.status === "published" && (
              <ActionButton
                size="sm"
                variant="outline"
                action={setCampaignStatusAction.bind(null, id, "paused")}
              >
                Pause
              </ActionButton>
            )}
            {campaign.status !== "closed" && (
              <ActionButton
                size="sm"
                variant="ghost"
                confirm="Close this campaign? Creators can no longer apply."
                action={setCampaignStatusAction.bind(null, id, "closed")}
              >
                Close
              </ActionButton>
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = (applications ?? []).filter((a) =>
            (col.statuses as readonly string[]).includes(a.status),
          );
          return (
            <div key={col.key} className="rounded-2xl bg-brand-soft p-3">
              <p className="mb-3 text-sm font-semibold">
                {col.title} <span className="text-muted-foreground">({items.length})</span>
              </p>
              <div className="space-y-3">
                {items.map((a) => {
                  const cp = a.creator_profiles as unknown as {
                    username: string;
                    display_name: string;
                    city: string | null;
                    instagram_followers: number | null;
                    rating_avg: number | null;
                    metrics_verified: boolean;
                  };
                  return (
                    <Card key={a.id} className="space-y-2 p-3">
                      <CreatorQuickView username={cp.username}>
                        <span className="flex items-center gap-2">
                          <Avatar name={cp.display_name} className="size-8 text-xs" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold hover:text-primary">
                              {cp.display_name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              @{cp.username}
                              {cp.instagram_followers != null &&
                                ` · ${cp.instagram_followers.toLocaleString("en-IN")}${cp.metrics_verified ? "" : "*"}`}
                            </span>
                          </span>
                        </span>
                      </CreatorQuickView>
                      <p className="text-sm">
                        {formatINR(a.quoted_price)} · {a.delivery_days} days
                      </p>
                      <p className="line-clamp-3 text-xs text-muted-foreground">{a.pitch}</p>
                      <Link
                        href={`/campaigns/${id}/applications/${a.id}`}
                        className="block text-xs font-semibold text-primary hover:underline"
                      >
                        Open application, offer and chat →
                      </Link>
                      {a.status === "submitted" && (
                        <div className="flex gap-2">
                          <ActionButton
                            size="sm"
                            variant="outline"
                            action={setApplicationStatusAction.bind(null, a.id, "shortlisted")}
                          >
                            Shortlist
                          </ActionButton>
                          <ActionButton
                            size="sm"
                            variant="ghost"
                            action={setApplicationStatusAction.bind(null, a.id, "rejected")}
                          >
                            Decline
                          </ActionButton>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {rejected.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          {rejected.length} declined or withdrawn application(s) hidden.
        </p>
      )}

      <Card className="mt-6 space-y-4">
        <CardTitle>Brief</CardTitle>
        <p className="whitespace-pre-wrap text-sm">{campaign.brief}</p>
        <div className="flex flex-wrap gap-2">
          {(
            campaign.campaign_deliverables as {
              id: string;
              quantity: number;
              format: string;
              platform: string;
              kind: string;
            }[]
          ).map((d) => (
            <Pill key={d.id}>
              {d.quantity} × {labelFor(d.format)} (
              {d.kind === "influencer_post" ? `post on ${d.platform}` : "UGC"})
            </Pill>
          ))}
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Usage rights</dt>
            <dd>
              {usage.channels.map(labelFor).join(", ")} for {usage.duration_days} days
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Revisions included</dt>
            <dd>{campaign.revisions_included}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Deadline</dt>
            <dd>{formatDate(campaign.deadline)}</dd>
          </div>
        </dl>
      </Card>
    </>
  );
}
