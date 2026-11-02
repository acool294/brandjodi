import {
  API_ROUTES,
  CREATOR_CAN_SUBMIT,
  REVIEWABLE,
  formatINR,
  labelFor,
  type ContractStatus,
} from "@brandjodi/shared";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { Chat } from "@/components/chat";
import {
  Body,
  Button,
  Card,
  Chip,
  ErrorText,
  Input,
  Row,
  Screen,
  StatusBadge,
  Title,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { uploadSubmissionFile } from "@/lib/upload";
import { useQuery } from "@/lib/use-query";
import { colors } from "@/theme";

interface Deliverable {
  id: string;
  kind: "ugc_asset" | "influencer_post";
  platform: string;
  format: string;
  quantity: number;
  specs: string | null;
  status: string;
  revisions_used: number;
}
interface Submission {
  id: string;
  contract_deliverable_id: string;
  version: number;
  status: string;
  caption: string | null;
  live_url: string | null;
  media_paths: string[];
  reviewer_note: string | null;
  auto_approve_at: string;
}

export default function ContractScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session!.user.id;

  const { data, error, reload } = useQuery(async () => {
    const contract = await supabase
      .from("contracts")
      .select("*, organisations(name)")
      .eq("id", id)
      .single();
    if (contract.error) throw contract.error;
    const [deliverables, submissions, payout, reviews, conversation, account] = await Promise.all([
      supabase.from("contract_deliverables").select("*").eq("contract_id", id).order("sort_order"),
      supabase
        .from("submissions")
        .select("*")
        .eq("contract_id", id)
        .order("version", { ascending: false }),
      supabase.from("payouts").select("status, amount").eq("contract_id", id).maybeSingle(),
      supabase.from("reviews").select("author_side, overall, text").eq("contract_id", id),
      supabase
        .from("conversations")
        .select("id")
        .eq("application_id", contract.data.application_id)
        .maybeSingle(),
      supabase.from("payout_accounts").select("kyc_status").eq("user_id", userId).maybeSingle(),
    ]);
    return {
      contract: contract.data as unknown as {
        status: ContractStatus;
        creator_payout: number;
        due_at: string;
        revisions_included: number;
        terms_snapshot: {
          campaign: { title: string; brief: string; disclosure_required: boolean };
        };
        organisations: { name: string } | null;
      },
      deliverables: (deliverables.data ?? []) as Deliverable[],
      submissions: (submissions.data ?? []) as Submission[],
      payout: payout.data,
      reviews: reviews.data ?? [],
      conversationId: conversation.data?.id as string | undefined,
      hasPayoutAccount: Boolean(account.data),
    };
  }, [id, userId]);

  if (error)
    return (
      <Screen>
        <ErrorText message={error} />
      </Screen>
    );
  if (!data) return <Screen />;
  const { contract } = data;
  const canSubmit = CREATOR_CAN_SUBMIT.includes(contract.status);
  const myReview = data.reviews.find((r) => r.author_side === "creator");

  return (
    <Screen>
      <Title>{contract.terms_snapshot.campaign.title}</Title>
      <Row>
        <Body muted>{contract.organisations?.name}</Body>
        <StatusBadge status={contract.status} />
      </Row>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Body>You receive</Body>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.primary }}>
            {formatINR(contract.creator_payout)}
          </Text>
        </Row>
        <Body muted style={{ fontSize: 13 }}>
          {contract.status === "awaiting_funding"
            ? "Waiting for the brand to pay. Don't start work until payment is secured."
            : data.payout
              ? `Payout: ${labelFor(data.payout.status)}`
              : `Payment is secured. Due ${new Date(contract.due_at).toLocaleDateString("en-IN")}.`}
        </Body>
        {data.payout?.status === "pending_kyc" && (
          <Button title="Add payout details to get paid" onPress={() => router.push("/payout")} />
        )}
      </Card>

      <Card>
        <Text style={{ fontWeight: "600" }}>Brief</Text>
        <Body>{contract.terms_snapshot.campaign.brief}</Body>
        {contract.terms_snapshot.campaign.disclosure_required && (
          <Body muted style={{ fontSize: 13 }}>
            Remember the #ad or paid partnership label on posts.
          </Body>
        )}
      </Card>

      {data.deliverables.map((d) => (
        <DeliverableCard
          key={d.id}
          contractId={id}
          userId={userId}
          deliverable={d}
          submissions={data.submissions.filter((s) => s.contract_deliverable_id === d.id)}
          canSubmit={canSubmit}
          revisionsLeft={contract.revisions_included - d.revisions_used}
          onDone={reload}
        />
      ))}

      {REVIEWABLE.includes(contract.status) &&
        (myReview ? (
          <Card>
            <Body>You rated the brand {myReview.overall} ★</Body>
          </Card>
        ) : (
          <ReviewCard contractId={id} onDone={reload} />
        ))}

      {data.conversationId && <Chat conversationId={data.conversationId} userId={userId} />}
    </Screen>
  );
}

function DeliverableCard({
  contractId,
  userId,
  deliverable: d,
  submissions,
  canSubmit,
  revisionsLeft,
  onDone,
}: {
  contractId: string;
  userId: string;
  deliverable: Deliverable;
  submissions: Submission[];
  canSubmit: boolean;
  revisionsLeft: number;
  onDone: () => void;
}) {
  const [assets, setAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [caption, setCaption] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = canSubmit && (d.status === "pending" || d.status === "changes_requested");

  async function pick() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: 10,
    });
    if (!result.canceled) setAssets(result.assets);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const media_paths: string[] = [];
      for (const a of assets) media_paths.push(await uploadSubmissionFile(contractId, userId, a));
      await api(API_ROUTES.submissions, {
        deliverable_id: d.id,
        media_paths,
        caption: caption || undefined,
        live_url: liveUrl || undefined,
      });
      setAssets([]);
      setCaption("");
      setLiveUrl("");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Row style={{ justifyContent: "space-between" }}>
        <Text style={{ fontWeight: "600", flex: 1 }}>
          {d.quantity} × {labelFor(d.format)}{" "}
          {d.kind === "influencer_post" ? `(post on ${d.platform})` : "(UGC)"}
        </Text>
        <StatusBadge status={d.status} />
      </Row>
      {d.specs && (
        <Body muted style={{ fontSize: 13 }}>
          {d.specs}
        </Body>
      )}

      {submissions.map((s) => (
        <Body key={s.id} muted style={{ fontSize: 13 }}>
          v{s.version}: {labelFor(s.status)}
          {s.media_paths.length ? ` · ${s.media_paths.length} file(s)` : ""}
          {s.reviewer_note ? ` · “${s.reviewer_note}”` : ""}
          {s.status === "submitted"
            ? ` · auto-approves ${new Date(s.auto_approve_at).toLocaleDateString("en-IN")}`
            : ""}
        </Body>
      ))}

      {open && (
        <>
          {d.status === "changes_requested" && (
            <Body style={{ color: colors.warning }}>
              The brand asked for changes. {revisionsLeft} revision(s) left after this.
            </Body>
          )}
          {d.kind === "ugc_asset" ? (
            <>
              <Button
                title={
                  assets.length ? `${assets.length} file(s) selected` : "Choose photos or videos"
                }
                variant="outline"
                onPress={pick}
              />
              <Body muted style={{ fontSize: 12 }}>
                Max 50 MB per file in this test version.
              </Body>
            </>
          ) : (
            <Input
              label="Link to your live post"
              hint="Publish with the #ad / paid partnership label, then paste the link."
              value={liveUrl}
              onChangeText={setLiveUrl}
              autoCapitalize="none"
              keyboardType="url"
            />
          )}
          <Input
            label="Caption or note (optional)"
            value={caption}
            onChangeText={setCaption}
            multiline
          />
          <ErrorText message={error} />
          <Button
            title="Submit for approval"
            onPress={submit}
            loading={busy}
            disabled={d.kind === "ugc_asset" ? assets.length === 0 : !liveUrl}
          />
        </>
      )}
    </Card>
  );
}

function ReviewCard({ contractId, onDone }: { contractId: string; onDone: () => void }) {
  const [overall, setOverall] = useState(5);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <Text style={{ fontWeight: "600" }}>Rate this brand</Text>
      <Row>
        {[1, 2, 3, 4, 5].map((n) => (
          <Chip key={n} label={`${n} ★`} selected={overall === n} onPress={() => setOverall(n)} />
        ))}
      </Row>
      <Input label="Comments (optional)" value={text} onChangeText={setText} multiline />
      <Body muted style={{ fontSize: 12 }}>
        Reviews are hidden until both sides submit, or for 14 days.
      </Body>
      <ErrorText message={error} />
      <Button
        title="Submit review"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await api(API_ROUTES.reviews, {
              contract_id: contractId,
              overall,
              text: text || undefined,
            });
            onDone();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}
