import { formatINR } from "@brandjodi/shared";
import { Link } from "expo-router";
import { Pressable, RefreshControl, Text } from "react-native";
import { Body, Card, Empty, ErrorText, Row, Screen, StatusBadge, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";
import { colors } from "@/theme";

export default function WorkScreen() {
  const { session } = useAuth();
  const userId = session!.user.id;

  const { data, error, loading, reload } = useQuery(async () => {
    const [apps, contracts] = await Promise.all([
      supabase
        .from("applications")
        .select("id, status, quoted_price, created_at, campaigns(title, organisations(name))")
        .eq("creator_id", userId)
        .not("status", "in", "(hired)")
        .order("created_at", { ascending: false }),
      supabase
        .from("contracts")
        .select("id, status, creator_payout, due_at, campaigns(title), organisations(name)")
        .eq("creator_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    if (apps.error) throw apps.error;
    if (contracts.error) throw contracts.error;
    return {
      apps: apps.data as unknown as AppRow[],
      contracts: contracts.data as unknown as ContractRow[],
    };
  }, [userId]);

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      <ErrorText message={error} />
      <Title style={{ fontSize: 18 }}>Contracts</Title>
      {data?.contracts.length === 0 && (
        <Empty title="No contracts yet" body="Accept an offer to start a contract." />
      )}
      {data?.contracts.map((c) => (
        <Link key={c.id} href={{ pathname: "/contract/[id]", params: { id: c.id } }} asChild>
          <Pressable>
            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "600", flex: 1 }}>{c.campaigns?.title}</Text>
                <Text style={{ color: colors.primary, fontWeight: "700" }}>
                  {formatINR(c.creator_payout)}
                </Text>
              </Row>
              <Body muted style={{ fontSize: 13 }}>
                {c.organisations?.name}
              </Body>
              <StatusBadge status={c.status} />
            </Card>
          </Pressable>
        </Link>
      ))}

      <Title style={{ fontSize: 18, marginTop: 8 }}>Applications</Title>
      {data?.apps.length === 0 && (
        <Empty title="No applications" body="Find a campaign and apply." />
      )}
      {data?.apps.map((a) => (
        <Link key={a.id} href={{ pathname: "/application/[id]", params: { id: a.id } }} asChild>
          <Pressable>
            <Card>
              <Text style={{ fontWeight: "600" }}>{a.campaigns?.title}</Text>
              <Body muted style={{ fontSize: 13 }}>
                {a.campaigns?.organisations?.name} · you quoted {formatINR(a.quoted_price)}
              </Body>
              <StatusBadge status={a.status} />
            </Card>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}

interface AppRow {
  id: string;
  status: string;
  quoted_price: number;
  campaigns: { title: string; organisations: { name: string } | null } | null;
}
interface ContractRow {
  id: string;
  status: string;
  creator_payout: number;
  campaigns: { title: string } | null;
  organisations: { name: string } | null;
}
