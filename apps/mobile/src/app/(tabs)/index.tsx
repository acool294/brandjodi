import Ionicons from "@expo/vector-icons/Ionicons";
import { CATEGORIES, formatINR, labelFor } from "@brandjodi/shared";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { Body, Card, Chip, Empty, ErrorText, Hero, Row, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";
import { colors, radius, spacing } from "@/theme";

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
  const { profile } = useAuth();
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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
    const term = search.trim().replace(/[%,()]/g, "");
    if (term) q = q.ilike("title", `%${term}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data as unknown as FeedCampaign[];
  }, [category, search]);

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      <Hero
        eyebrow={`Hi ${profile?.display_name.split(" ")[0] ?? "there"}`}
        title={
          data
            ? `${data.length} campaign${data.length === 1 ? "" : "s"} for you`
            : "Campaigns for you"
        }
        subtitle="Payment is secured before you start. You keep 100% of your price."
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          backgroundColor: colors.card,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
        }}
      >
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search campaigns"
          placeholderTextColor={colors.muted}
          style={{ flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text }}
          returnKeyType="search"
        />
      </View>

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
        <Empty title="No campaigns match" body="Try another category, or pull to refresh." />
      )}
      {data?.map((c) => (
        <Link key={c.id} href={{ pathname: "/campaign/[id]", params: { id: c.id } }} asChild>
          <Pressable>
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <Row style={{ flex: 1 }}>
                  <Text
                    style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}
                    numberOfLines={1}
                  >
                    {c.organisations?.name}
                  </Text>
                  {c.organisations?.verification_status === "verified" && (
                    <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                  )}
                </Row>
                <View
                  style={{
                    backgroundColor: colors.soft,
                    borderRadius: radius.pill,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ color: colors.primary, fontWeight: "800" }}>
                    {formatINR(c.budget_per_creator)}
                  </Text>
                </View>
              </Row>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>{c.title}</Text>
              <Body muted style={{ fontSize: 13 }}>
                {c.campaign_deliverables
                  .map((d) => `${d.quantity}× ${labelFor(d.format)}`)
                  .join(" · ")}
              </Body>
              <Row style={{ flexWrap: "wrap", gap: 6 }}>
                <Tag icon="pricetag-outline" text={labelFor(c.category)} />
                <Tag
                  icon={c.is_remote ? "globe-outline" : "location-outline"}
                  text={c.is_remote ? "Remote" : (c.location ?? "On location")}
                />
                {c.compensation_type === "paid_plus_product" && (
                  <Tag icon="gift-outline" text="Free product" />
                )}
                {c.deadline && (
                  <Tag
                    icon="calendar-outline"
                    text={new Date(c.deadline).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  />
                )}
              </Row>
            </Card>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}

function Tag({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: colors.subtle,
        borderRadius: radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <Ionicons name={icon} size={12} color={colors.muted} />
      <Text style={{ fontSize: 12, color: colors.muted }}>{text}</Text>
    </View>
  );
}
