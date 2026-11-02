import { CATEGORIES, formatINR, labelFor } from "@brandjodi/shared";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Body, Card, Chip, Empty, ErrorText, Row, Screen } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";
import { colors, spacing } from "@/theme";

interface FeedCampaign {
  id: string;
  title: string;
  category: string;
  budget_per_creator: number;
  compensation_type: string;
  deadline: string | null;
  is_remote: boolean;
  location: string | null;
  organisations: { name: string; verification_status: string } | null;
  campaign_deliverables: { format: string; quantity: number }[];
}

export default function FeedScreen() {
  const [category, setCategory] = useState<string | null>(null);
  const { data, error, loading, reload } = useQuery(async () => {
    let q = supabase
      .from("campaigns")
      .select(
        "id, title, category, budget_per_creator, compensation_type, deadline, is_remote, location, organisations(name, verification_status), campaign_deliverables(format, quantity)",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(50);
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) throw error;
    return data as unknown as FeedCampaign[];
  }, [category]);

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        <Chip label="All" selected={!category} onPress={() => setCategory(null)} />
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={labelFor(c)}
            selected={category === c}
            onPress={() => setCategory(c)}
          />
        ))}
      </ScrollView>
      <ErrorText message={error} />
      {data && data.length === 0 && (
        <Empty title="No live campaigns" body="Pull to refresh. New briefs appear here first." />
      )}
      {data?.map((c) => (
        <Link key={c.id} href={{ pathname: "/campaign/[id]", params: { id: c.id } }} asChild>
          <Pressable>
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  {c.organisations?.name}
                  {c.organisations?.verification_status === "verified" ? " ✓" : ""}
                </Text>
                <Text style={{ color: colors.primary, fontWeight: "700" }}>
                  {formatINR(c.budget_per_creator)}
                </Text>
              </Row>
              <Text style={{ fontSize: 17, fontWeight: "600", color: colors.text }}>{c.title}</Text>
              <Body muted style={{ fontSize: 13 }}>
                {c.campaign_deliverables
                  .map((d) => `${d.quantity}× ${labelFor(d.format)}`)
                  .join(" · ")}
              </Body>
              <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
                <Text style={{ fontSize: 12, color: colors.muted }}>{labelFor(c.category)}</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {c.is_remote ? "Remote" : c.location}
                </Text>
                {c.compensation_type === "paid_plus_product" && (
                  <Text style={{ fontSize: 12, color: colors.muted }}>+ free product</Text>
                )}
              </View>
            </Card>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}
