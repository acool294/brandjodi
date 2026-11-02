import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatINR } from "@brandjodi/shared";
import { respondToOfferAction } from "@/actions/brand";
import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/app-shell";
import { Chat, type ChatMessage } from "@/components/chat";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { getBrandSession } from "@/server/session";
import { CounterForm, OfferForm } from "./offer-forms";

export const metadata: Metadata = { title: "Application" };

export default async function ApplicationPage({
  params,
}: PageProps<"/campaigns/[id]/applications/[applicationId]">) {
  const { id, applicationId } = await params;
  const { actor } = await getBrandSession();
  const db = actor.db;

  const { data: app } = await db
    .from("applications")
    .select(
      "*, campaigns(title, revisions_included), creator_profiles(username, display_name, bio, city, categories, instagram_handle, instagram_followers, youtube_handle, youtube_subscribers, rating_avg, rating_count, completed_count, metrics_verified)",
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) notFound();

  const [{ data: offers }, { data: conversation }, { data: contract }] = await Promise.all([
    db
      .from("offers")
      .select("*")
      .eq("application_id", applicationId)
      .order("version", { ascending: false }),
    db.from("conversations").select("id").eq("application_id", applicationId).maybeSingle(),
    db.from("contracts").select("id, status").eq("application_id", applicationId).maybeSingle(),
  ]);
  const { data: messages } = conversation
    ? await db
        .from("messages")
        .select("id, sender_id, sender_side, body, masked, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at")
    : { data: [] };

  const creator = app.creator_profiles as unknown as {
    username: string;
    display_name: string;
    bio: string | null;
    city: string | null;
    instagram_handle: string | null;
    instagram_followers: number | null;
    youtube_handle: string | null;
    youtube_subscribers: number | null;
    rating_avg: number | null;
    rating_count: number;
    completed_count: number;
    metrics_verified: boolean;
  };
  const campaign = app.campaigns as unknown as { title: string; revisions_included: number };
  const openOffer = offers?.find((o) => o.status === "sent");
  const canOffer = ["submitted", "shortlisted", "offered"].includes(app.status);

  return (
    <>
      <PageHeader
        title={creator.display_name}
        subtitle={`Applied to ${campaign.title} on ${formatDate(app.created_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={app.status} />
            <Link
              href={`/c/${creator.username}`}
              target="_blank"
              className={buttonClasses("outline", "sm")}
            >
              View media kit
            </Link>
            {contract && (
              <Link href={`/contracts/${contract.id}`} className={buttonClasses("primary", "sm")}>
                Open contract
              </Link>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card className="space-y-3">
            <CardTitle>Application</CardTitle>
            <p className="text-sm">
              Quoted <strong>{formatINR(app.quoted_price)}</strong>, delivery in {app.delivery_days}{" "}
              days
            </p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{app.pitch}</p>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <p>
                <span className="text-muted-foreground">Instagram: </span>
                {creator.instagram_handle ? `@${creator.instagram_handle}` : "—"}
                {creator.instagram_followers != null &&
                  ` (${creator.instagram_followers.toLocaleString("en-IN")})`}
              </p>
              <p>
                <span className="text-muted-foreground">Rating: </span>
                {creator.rating_avg
                  ? `${creator.rating_avg} ★ (${creator.rating_count})`
                  : "No reviews yet"}
              </p>
              <p>
                <span className="text-muted-foreground">Completed: </span>
                {creator.completed_count}
              </p>
            </div>
            {!creator.metrics_verified && (
              <p className="text-xs text-warning">
                Follower numbers are self-reported and not yet verified.
              </p>
            )}
          </Card>

          <Card className="space-y-4">
            <CardTitle>Offers</CardTitle>
            {offers?.length ? (
              <ul className="divide-y text-sm">
                {offers.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      v{o.version} · {o.created_by_side === "brand" ? "You" : creator.display_name}{" "}
                      offered <strong>{formatINR(o.price)}</strong> · {o.delivery_days} days ·{" "}
                      {o.revisions_included} revision(s)
                      {o.message && (
                        <span className="block text-muted-foreground">“{o.message}”</span>
                      )}
                    </span>
                    <StatusBadge status={o.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No offers yet.</p>
            )}

            {openOffer?.created_by_side === "creator" && (
              <div className="space-y-3 rounded-lg border border-primary/40 p-3">
                <p className="text-sm">
                  {creator.display_name} countered with{" "}
                  <strong>{formatINR(openOffer.price)}</strong>.
                </p>
                <div className="flex gap-2">
                  <ActionButton action={respondToOfferAction.bind(null, openOffer.id, "accept")}>
                    Accept and create contract
                  </ActionButton>
                  <ActionButton
                    variant="ghost"
                    action={respondToOfferAction.bind(null, openOffer.id, "decline")}
                  >
                    Decline
                  </ActionButton>
                </div>
                <CounterForm offerId={openOffer.id} />
              </div>
            )}

            {canOffer && openOffer?.created_by_side !== "creator" && (
              <OfferForm
                applicationId={applicationId}
                defaultPrice={(openOffer?.price ?? app.quoted_price) / 100}
                defaultDays={openOffer?.delivery_days ?? app.delivery_days}
                defaultRevisions={openOffer?.revisions_included ?? campaign.revisions_included}
                isRevision={Boolean(openOffer)}
              />
            )}
          </Card>
          <Link href={`/campaigns/${id}`} className="text-sm text-muted-foreground hover:underline">
            ← Back to campaign
          </Link>
        </div>

        {conversation && (
          <Chat
            conversationId={conversation.id}
            userId={actor.userId}
            initialMessages={(messages ?? []) as ChatMessage[]}
            counterpartName={creator.display_name}
          />
        )}
      </div>
    </>
  );
}
