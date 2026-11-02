import { formatINR, labelFor } from "@brandjodi/shared";
import { router } from "expo-router";
import { RefreshControl, Share, Text } from "react-native";
import { Body, Button, Card, Row, Screen, StatusBadge, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";
import { colors } from "@/theme";

export default function ProfileScreen() {
  const { session, profile } = useAuth();
  const userId = session!.user.id;

  const { data, loading, reload } = useQuery(async () => {
    const [payouts, account] = await Promise.all([
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
    ]);
    return { payouts: payouts.data ?? [], account: account.data };
  }, [userId]);

  if (!profile) return null;
  const mediaKitUrl = `${env.apiUrl}/c/${profile.username}`;
  const earned = (data?.payouts ?? [])
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const pending = (data?.payouts ?? [])
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      <Card>
        <Title>{profile.display_name}</Title>
        <Body muted>
          @{profile.username}
          {profile.city ? ` · ${profile.city}` : ""}
        </Body>
        <Body muted style={{ fontSize: 13 }}>
          {profile.categories.map(labelFor).join(", ")}
        </Body>
        <Row style={{ gap: 16 }}>
          <Body>{profile.completed_count} jobs</Body>
          <Body>{profile.rating_avg ? `${profile.rating_avg} ★` : "No reviews yet"}</Body>
          <Body>
            {profile.instagram_followers?.toLocaleString("en-IN") ?? "—"} followers
            {profile.metrics_verified ? " ✓" : ""}
          </Body>
        </Row>
        <Row>
          <Button
            title="Share media kit"
            variant="outline"
            onPress={() => Share.share({ message: mediaKitUrl, url: mediaKitUrl })}
          />
          <Button title="Edit" variant="ghost" onPress={() => router.push("/edit-profile")} />
        </Row>
      </Card>

      <Card>
        <Text style={{ fontWeight: "600" }}>Earnings</Text>
        <Row style={{ gap: 24 }}>
          <Body>
            Paid{" "}
            <Text style={{ fontWeight: "700", color: colors.success }}>{formatINR(earned)}</Text>
          </Body>
          <Body>
            Pending{" "}
            <Text style={{ fontWeight: "700", color: colors.warning }}>{formatINR(pending)}</Text>
          </Body>
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
        <Text style={{ fontWeight: "600" }}>Payout details</Text>
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

      <Button title="Sign out" variant="ghost" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}
