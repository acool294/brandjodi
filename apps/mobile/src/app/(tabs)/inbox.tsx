import { router } from "expo-router";
import { Pressable, RefreshControl, Text } from "react-native";
import { Body, Card, Empty, ErrorText, Screen } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@/lib/use-query";
import { colors } from "@/theme";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  data: { contract_id?: string; application_id?: string };
}

export default function InboxScreen() {
  const { data, error, loading, reload } = useQuery(async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, body, read_at, created_at, data")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data as Notification[];
  });

  async function open(n: Notification) {
    if (!n.read_at)
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", n.id);
    if (n.data.contract_id)
      router.push({ pathname: "/contract/[id]", params: { id: n.data.contract_id } });
    else if (n.data.application_id)
      router.push({ pathname: "/application/[id]", params: { id: n.data.application_id } });
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      <ErrorText message={error} />
      {data?.length === 0 && (
        <Empty title="All caught up" body="Offers, payments and approvals show up here." />
      )}
      {data?.map((n) => (
        <Pressable key={n.id} onPress={() => open(n)}>
          <Card style={!n.read_at ? { borderColor: colors.primary } : undefined}>
            <Text style={{ fontWeight: "600" }}>{n.title}</Text>
            {n.body && <Body muted>{n.body}</Body>}
            <Text style={{ fontSize: 11, color: colors.muted }}>
              {new Date(n.created_at).toLocaleString("en-IN")}
            </Text>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
