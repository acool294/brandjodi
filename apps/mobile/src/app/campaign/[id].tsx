import { API_ROUTES, applicationSchema, formatINR, labelFor } from "@brandjodi/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { Body, Button, Card, ErrorText, Input, Screen, Title } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";

interface CampaignDetail {
  id: string;
  title: string;
  brief: string;
  category: string;
  budget_per_creator: number;
  compensation_type: string;
  product_info: string | null;
  deadline: string | null;
  revisions_included: number;
  usage_rights: { channels: string[]; duration_days: number };
  exclusivity_days: number;
  disclosure_required: boolean;
  organisations: { name: string; verification_status: string; about: string | null } | null;
  campaign_deliverables: {
    id: string;
    kind: string;
    platform: string;
    format: string;
    quantity: number;
    specs: string | null;
  }[];
}

export default function CampaignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("7");
  const [pitch, setPitch] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, error } = useQuery(async () => {
    const [campaign, existing] = await Promise.all([
      supabase
        .from("campaigns")
        .select("*, organisations(name, verification_status, about), campaign_deliverables(*)")
        .eq("id", id)
        .single(),
      supabase
        .from("applications")
        .select("id")
        .eq("campaign_id", id)
        .eq("creator_id", session!.user.id)
        .maybeSingle(),
    ]);
    if (campaign.error) throw campaign.error;
    return {
      campaign: campaign.data as unknown as CampaignDetail,
      applicationId: existing.data?.id as string | undefined,
    };
  }, [id]);

  async function apply() {
    const parsed = applicationSchema.safeParse({
      campaign_id: id,
      quoted_price: Math.round(Number(price || data?.campaign.budget_per_creator! / 100) * 100),
      delivery_days: Number(days),
      pitch,
    });
    if (!parsed.success) return setFormError(parsed.error.issues[0]?.message ?? "Check the form");
    setBusy(true);
    setFormError(null);
    try {
      const applicationId = await api<string>(API_ROUTES.applications, parsed.data);
      router.replace({ pathname: "/application/[id]", params: { id: applicationId } });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (error)
    return (
      <Screen>
        <ErrorText message={error} />
      </Screen>
    );
  if (!data) return <Screen />;
  const c = data.campaign;

  return (
    <Screen>
      <Body muted>
        {c.organisations?.name}
        {c.organisations?.verification_status === "verified" ? " ✓ verified brand" : ""}
      </Body>
      <Title>{c.title}</Title>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>
        {formatINR(c.budget_per_creator)}{" "}
        {c.compensation_type === "paid_plus_product" ? "+ product" : ""}
      </Text>

      <Card>
        <Text style={{ fontWeight: "600" }}>Brief</Text>
        <Body>{c.brief}</Body>
        {c.product_info && <Body muted>Product: {c.product_info}</Body>}
      </Card>

      <Card>
        <Text style={{ fontWeight: "600" }}>Deliverables</Text>
        {c.campaign_deliverables.map((d) => (
          <Body key={d.id}>
            • {d.quantity} × {labelFor(d.format)}{" "}
            {d.kind === "influencer_post"
              ? `posted on your ${d.platform}`
              : "(UGC, files to brand)"}
            {d.specs ? `: ${d.specs}` : ""}
          </Body>
        ))}
        <Body muted style={{ fontSize: 13 }}>
          Usage: {c.usage_rights.channels.map(labelFor).join(", ")} for{" "}
          {c.usage_rights.duration_days} days · {c.revisions_included} revision(s) included
          {c.exclusivity_days ? ` · ${c.exclusivity_days} days exclusivity` : ""}
        </Body>
        {c.disclosure_required && (
          <Body muted style={{ fontSize: 13 }}>
            Posts must show #ad or the paid partnership label.
          </Body>
        )}
      </Card>

      {data.applicationId ? (
        <Button
          title="View your application"
          variant="outline"
          onPress={() =>
            router.push({ pathname: "/application/[id]", params: { id: data.applicationId! } })
          }
        />
      ) : (
        <Card>
          <Text style={{ fontWeight: "600" }}>Apply</Text>
          <Input
            label="Your price (₹)"
            placeholder={String(c.budget_per_creator / 100)}
            value={price}
            onChangeText={setPrice}
            keyboardType="number-pad"
            hint="You keep the full amount. BrandJodi charges the brand, not you."
          />
          <Input
            label="Delivery time (days)"
            value={days}
            onChangeText={setDays}
            keyboardType="number-pad"
          />
          <Input label="Why you're a good fit" value={pitch} onChangeText={setPitch} multiline />
          <ErrorText message={formError} />
          <Button title="Send application" onPress={apply} loading={busy} />
        </Card>
      )}
    </Screen>
  );
}
