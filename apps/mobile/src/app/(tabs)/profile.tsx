import Ionicons from "@expo/vector-icons/Ionicons";
import { formatINR, labelFor } from "@brandjodi/shared";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, RefreshControl, Share, Text, View } from "react-native";
import {
  Avatar,
  Body,
  Button,
  Card,
  ErrorText,
  Hero,
  Row,
  Screen,
  StatusBadge,
} from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  addPortfolioImage,
  portfolioImageUrl,
  removePortfolioItem,
  type PortfolioItem,
} from "@/lib/portfolio";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";
import { colors, radius, spacing } from "@/theme";

export default function ProfileScreen() {
  const { session, profile } = useAuth();
  const userId = session!.user.id;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useQuery(async () => {
    const [payouts, account, portfolio] = await Promise.all([
      supabase
        .from("payouts")
        .select("id, amount, status, paid_at, created_at")
        .eq("creator_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("payout_accounts")
        .select("account_holder, bank_last4, ifsc, kyc_status")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("portfolio_items")
        .select("id, title, brand_name, media_path")
        .eq("creator_id", userId)
        .order("sort_order"),
    ]);
    return {
      payouts: payouts.data ?? [],
      account: account.data,
      portfolio: (portfolio.data ?? []) as PortfolioItem[],
    };
  }, [userId]);

  if (!profile) return null;
  const mediaKitUrl = `${env.apiUrl}/c/${profile.username}`;
  const earned = (data?.payouts ?? [])
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const pending = (data?.payouts ?? [])
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + p.amount, 0);

  async function addWork() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled) return;
    setUploading(true);
    setError(null);
    try {
      await addPortfolioImage(userId, result.assets[0], "Portfolio");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function confirmRemove(item: PortfolioItem) {
    Alert.alert("Remove from portfolio?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => removePortfolioItem(item).then(reload),
      },
    ]);
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      <Hero
        eyebrow="Your media kit"
        title={profile.display_name}
        subtitle={`@${profile.username}${profile.city ? ` · ${profile.city}` : ""}`}
      >
        <Row style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Pressable
            onPress={() =>
              Share.share({ message: `My BrandJodi media kit: ${mediaKitUrl}`, url: mediaKitUrl })
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: "#fff",
              borderRadius: radius.pill,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Ionicons name="share-social-outline" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "700" }}>Share media kit</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/edit-profile")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: "rgba(255,255,255,0.2)",
              borderRadius: radius.pill,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Ionicons name="create-outline" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700" }}>Edit</Text>
          </Pressable>
        </Row>
      </Hero>

      <Row style={{ gap: spacing.sm }}>
        <StatTile label="Jobs done" value={String(profile.completed_count)} />
        <StatTile
          label="Rating"
          value={profile.rating_avg ? `${Number(profile.rating_avg).toFixed(1)} ★` : "New"}
        />
        <StatTile
          label="Followers"
          value={profile.instagram_followers ? compact(profile.instagram_followers) : "—"}
        />
      </Row>

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Text style={{ fontWeight: "700", fontSize: 16 }}>Earnings</Text>
          <Ionicons name="wallet-outline" size={20} color={colors.primary} />
        </Row>
        <Row style={{ gap: spacing.xl }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.success }}>
              {formatINR(earned)}
            </Text>
            <Body muted style={{ fontSize: 12 }}>
              Paid to you
            </Body>
          </View>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.warning }}>
              {formatINR(pending)}
            </Text>
            <Body muted style={{ fontSize: 12 }}>
              On its way
            </Body>
          </View>
        </Row>
        {data?.payouts.map((p) => (
          <Row key={p.id} style={{ justifyContent: "space-between" }}>
            <Body muted style={{ fontSize: 13 }}>
              {new Date(p.created_at).toLocaleDateString("en-IN")}
            </Body>
            <Body>{formatINR(p.amount)}</Body>
            <StatusBadge status={p.status} />
          </Row>
        ))}
      </Card>

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Text style={{ fontWeight: "700", fontSize: 16 }}>Portfolio</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Shown on your media kit</Text>
        </Row>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {data?.portfolio.map((item) =>
            item.media_path ? (
              <Pressable key={item.id} onLongPress={() => confirmRemove(item)}>
                <Image
                  source={{ uri: portfolioImageUrl(item.media_path) }}
                  style={{ width: 96, height: 96, borderRadius: radius.sm }}
                  contentFit="cover"
                />
              </Pressable>
            ) : null,
          )}
          <Pressable
            onPress={addWork}
            disabled={uploading}
            style={{
              width: 96,
              height: 96,
              borderRadius: radius.sm,
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.soft,
            }}
          >
            <Ionicons
              name={uploading ? "hourglass-outline" : "add"}
              size={26}
              color={colors.primary}
            />
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>
              {uploading ? "Uploading" : "Add work"}
            </Text>
          </Pressable>
        </View>
        <Body muted style={{ fontSize: 11 }}>
          Long-press a photo to remove it.
        </Body>
        <ErrorText message={error} />
      </Card>

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Text style={{ fontWeight: "700", fontSize: 16 }}>Payout details</Text>
          <Ionicons name="card-outline" size={20} color={colors.primary} />
        </Row>
        {data?.account ? (
          <Body muted>
            {data.account.account_holder} · bank ••••{data.account.bank_last4} · {data.account.ifsc}
          </Body>
        ) : (
          <Body muted>Add your PAN and bank account to receive payments.</Body>
        )}
        <Button
          title={data?.account ? "Update payout details" : "Add payout details"}
          variant="outline"
          onPress={() => router.push("/payout")}
        />
      </Card>

      <Row style={{ flexWrap: "wrap", gap: 6 }}>
        {profile.categories.map((c) => (
          <Text
            key={c}
            style={{
              backgroundColor: colors.subtle,
              color: colors.muted,
              borderRadius: radius.pill,
              paddingHorizontal: 10,
              paddingVertical: 4,
              fontSize: 12,
            }}
          >
            {labelFor(c)}
          </Text>
        ))}
      </Row>

      <Row style={{ justifyContent: "center", gap: spacing.sm }}>
        <Avatar name={profile.display_name} size={28} />
        <Button title="Sign out" variant="ghost" onPress={() => supabase.auth.signOut()} />
      </Row>
    </Screen>
  );
}

const compactFormat = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const compact = (n: number) => compactFormat.format(n);

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, alignItems: "center", padding: spacing.md, gap: 2 }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
    </Card>
  );
}
