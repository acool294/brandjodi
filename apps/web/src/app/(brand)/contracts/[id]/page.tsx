import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { REVIEWABLE, formatINR, labelFor, type ContractStatus } from "@brandjodi/shared";
import { cancelContractAction } from "@/actions/brand";
import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/app-shell";
import { Chat, type ChatMessage } from "@/components/chat";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { signedSubmissionUrls } from "@/server/services";
import { getBrandSession } from "@/server/session";
import { FundButton } from "./fund-button";
import { ReviewForm, SubmissionDecision } from "./workroom-forms";

export const metadata: Metadata = { title: "Contract" };

interface Terms {
  campaign: {
    title: string;
    brief: string;
    usage_rights: { channels: string[]; duration_days: number };
    exclusivity_days: number;
  };
  delivery_days: number;
}

export default async function ContractPage({ params }: PageProps<"/contracts/[id]">) {
  const { id } = await params;
  const { actor } = await getBrandSession();
  const db = actor.db;

  const { data: contract } = await db
    .from("contracts")
    .select("*, creator_profiles(username, display_name)")
    .eq("id", id)
    .maybeSingle();
  if (!contract) notFound();

  const [
    { data: deliverables },
    { data: submissions },
    { data: payout },
    { data: reviews },
    { data: conversation },
  ] = await Promise.all([
    db.from("contract_deliverables").select("*").eq("contract_id", id).order("sort_order"),
    db.from("submissions").select("*").eq("contract_id", id).order("version", { ascending: false }),
    db.from("payouts").select("status, amount, paid_at").eq("contract_id", id).maybeSingle(),
    db.from("reviews").select("author_side, overall, text, visible_at").eq("contract_id", id),
    db
      .from("conversations")
      .select("id")
      .eq("application_id", contract.application_id)
      .maybeSingle(),
  ]);
  const { data: messages } = conversation
    ? await db
        .from("messages")
        .select("id, sender_id, sender_side, body, masked, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at")
    : { data: [] };

  const urls = await signedSubmissionUrls(
    actor,
    (submissions ?? []).flatMap((s) => s.media_paths as string[]),
  );
  const creator = contract.creator_profiles as unknown as {
    username: string;
    display_name: string;
  };
  const terms = contract.terms_snapshot as unknown as Terms;
  const status = contract.status as ContractStatus;
  const myReview = reviews?.find((r) => r.author_side === "brand");
  const theirReview = reviews?.find((r) => r.author_side === "creator");

  return (
    <>
      <PageHeader
        title={terms.campaign.title}
        subtitle={`Contract with ${creator.display_name} · due ${formatDate(contract.due_at)}`}
        actions={<StatusBadge status={status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          {status === "awaiting_funding" && (
            <Card className="space-y-3 border-primary">
              <CardTitle>Fund this contract to start work</CardTitle>
              <p className="text-sm text-muted-foreground">
                Your payment is held safely and released to the creator only when you approve the
                work (or after 5 days without a response). Full refund if cancelled before work
                starts.
              </p>
              <div className="flex flex-wrap gap-2">
                <FundButton contractId={id} amountLabel={formatINR(contract.brand_total)} />
                <ActionButton
                  variant="ghost"
                  confirm="Cancel this contract?"
                  action={cancelContractAction.bind(null, id)}
                >
                  Cancel contract
                </ActionButton>
              </div>
            </Card>
          )}

          <Card className="space-y-4">
            <CardTitle>Deliverables</CardTitle>
            {(deliverables ?? []).map((d) => {
              const subs = (submissions ?? []).filter((s) => s.contract_deliverable_id === d.id);
              return (
                <div key={d.id} className="space-y-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {d.quantity} × {labelFor(d.format)}{" "}
                      <span className="text-sm text-muted-foreground">
                        ({d.kind === "influencer_post" ? `live post on ${d.platform}` : "UGC files"}
                        )
                      </span>
                    </p>
                    <StatusBadge status={d.status} />
                  </div>
                  {d.specs && <p className="text-sm text-muted-foreground">{d.specs}</p>}
                  {subs.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>
                  )}
                  {subs.map((s) => (
                    <div key={s.id} className="space-y-2 rounded-lg bg-muted p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Version {s.version}</span>
                        <StatusBadge status={s.status} />
                      </div>
                      {s.caption && <p className="whitespace-pre-wrap">{s.caption}</p>}
                      {s.live_url && (
                        <a
                          href={s.live_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline"
                        >
                          View live post
                        </a>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {(s.media_paths as string[]).map((p) =>
                          urls[p] ? (
                            /\.(mp4|mov)$/i.test(p) ? (
                              <video key={p} src={urls[p]} controls className="h-48 rounded-lg" />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={p}
                                src={urls[p]}
                                alt="Submission"
                                className="h-48 rounded-lg object-cover"
                              />
                            )
                          ) : null,
                        )}
                      </div>
                      {s.reviewer_note && (
                        <p className="text-muted-foreground">Note: {s.reviewer_note}</p>
                      )}
                      {s.status === "submitted" && (
                        <>
                          <p className="text-xs text-warning">
                            Auto-approves on {formatDate(s.auto_approve_at)}.
                          </p>
                          <SubmissionDecision
                            submissionId={s.id}
                            revisionsLeft={contract.revisions_included - d.revisions_used}
                          />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </Card>

          {REVIEWABLE.includes(status) && (
            <Card className="space-y-3">
              <CardTitle>Review</CardTitle>
              {myReview ? (
                <p className="text-sm">
                  You rated {myReview.overall} ★. {myReview.text}
                </p>
              ) : (
                <ReviewForm contractId={id} />
              )}
              {theirReview ? (
                <p className="text-sm text-muted-foreground">
                  {creator.display_name} rated you {theirReview.overall} ★. {theirReview.text}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Reviews are revealed when both sides submit, or after 14 days.
                </p>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="space-y-2 text-sm">
            <CardTitle>Payment</CardTitle>
            <div className="flex justify-between">
              <span>Creator price</span>
              <span>{formatINR(contract.price)}</span>
            </div>
            <div className="flex justify-between">
              <span>Platform fee</span>
              <span>{formatINR(contract.brand_fee)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST on fee</span>
              <span>{formatINR(contract.gst_on_fee)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>{formatINR(contract.brand_total)}</span>
            </div>
            <p className="text-muted-foreground">
              {contract.funded_at ? `Paid on ${formatDate(contract.funded_at)}.` : "Not paid yet."}
              {payout && ` Creator payout: ${labelFor(payout.status)}.`}
            </p>
          </Card>

          <Card className="space-y-2 text-sm">
            <CardTitle>Terms</CardTitle>
            <p>
              Usage: {terms.campaign.usage_rights.channels.map(labelFor).join(", ")} for{" "}
              {terms.campaign.usage_rights.duration_days} days
            </p>
            <p>Revisions included: {contract.revisions_included}</p>
            <p>Exclusivity: {terms.campaign.exclusivity_days} days</p>
            <p className="break-all text-xs text-muted-foreground">
              Terms fingerprint: {contract.terms_hash.slice(0, 16)}…
            </p>
          </Card>

          {conversation && (
            <Chat
              conversationId={conversation.id}
              userId={actor.userId}
              initialMessages={(messages ?? []) as ChatMessage[]}
              counterpartName={creator.display_name}
            />
          )}
          <Link href="/contracts" className="text-sm text-muted-foreground hover:underline">
            ← All contracts
          </Link>
        </div>
      </div>
    </>
  );
}
