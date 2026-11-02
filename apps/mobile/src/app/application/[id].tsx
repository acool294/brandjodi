import { API_ROUTES, formatINR } from "@brandjodi/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Text } from "react-native";
import { Chat } from "@/components/chat";
import {
  Body,
  Button,
  Card,
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
import { useQuery } from "@/lib/use-query";

interface Offer {
  id: string;
  version: number;
  created_by_side: "brand" | "creator";
  price: number;
  delivery_days: number;
  revisions_included: number;
  message: string | null;
  status: string;
}

export default function ApplicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [counter, setCounter] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error, reload } = useQuery(async () => {
    const [app, offers, conversation, contract] = await Promise.all([
      supabase
        .from("applications")
        .select("*, campaigns(title, organisations(name))")
        .eq("id", id)
        .single(),
      supabase
        .from("offers")
        .select("*")
        .eq("application_id", id)
        .order("version", { ascending: false }),
      supabase.from("conversations").select("id").eq("application_id", id).maybeSingle(),
      supabase.from("contracts").select("id").eq("application_id", id).maybeSingle(),
    ]);
    if (app.error) throw app.error;
    return {
      app: app.data as unknown as {
        status: string;
        quoted_price: number;
        pitch: string;
        campaigns: { title: string; organisations: { name: string } | null } | null;
      },
      offers: (offers.data ?? []) as Offer[],
      conversationId: conversation.data?.id as string | undefined,
      contractId: contract.data?.id as string | undefined,
    };
  }, [id]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
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
  const open = data.offers.find((o) => o.status === "sent");
  const brandOfferOpen = open?.created_by_side === "brand";

  return (
    <Screen>
      <Title>{data.app.campaigns?.title}</Title>
      <Row>
        <Body muted>{data.app.campaigns?.organisations?.name}</Body>
        <StatusBadge status={data.app.status} />
      </Row>
      <Body muted>You quoted {formatINR(data.app.quoted_price)}</Body>

      {data.contractId && (
        <Button
          title="Open contract"
          onPress={() =>
            router.push({ pathname: "/contract/[id]", params: { id: data.contractId! } })
          }
        />
      )}

      {brandOfferOpen && open && (
        <Card>
          <Text style={{ fontWeight: "600" }}>Offer from the brand</Text>
          <Text style={{ fontSize: 22, fontWeight: "700" }}>{formatINR(open.price)}</Text>
          <Body muted>
            {open.delivery_days} days · {open.revisions_included} revision(s) included
          </Body>
          {open.message && <Body>“{open.message}”</Body>}
          <Body muted style={{ fontSize: 12 }}>
            Accepting creates a contract. The brand then pays BrandJodi, and you start once payment
            is secured.
          </Body>
          <Button
            title="Accept offer"
            loading={busy}
            onPress={() =>
              act(async () => {
                const contractId = await api<string | null>(API_ROUTES.offerRespond, {
                  offer_id: open.id,
                  action: "accept",
                });
                if (contractId)
                  router.replace({ pathname: "/contract/[id]", params: { id: contractId } });
              })
            }
          />
          <Input
            label="Or counter with a price (₹)"
            value={counter}
            onChangeText={setCounter}
            keyboardType="number-pad"
          />
          <Row>
            <Button
              title="Send counter"
              variant="outline"
              disabled={!counter || busy}
              onPress={() =>
                act(() =>
                  api(API_ROUTES.offerCounter, {
                    offer_id: open.id,
                    price: Math.round(Number(counter) * 100),
                  }),
                )
              }
            />
            <Button
              title="Decline"
              variant="ghost"
              disabled={busy}
              onPress={() =>
                act(() => api(API_ROUTES.offerRespond, { offer_id: open.id, action: "decline" }))
              }
            />
          </Row>
        </Card>
      )}
      {open && !brandOfferOpen && (
        <Card>
          <Body>You countered with {formatINR(open.price)}. Waiting for the brand.</Body>
        </Card>
      )}
      <ErrorText message={actionError} />

      {data.offers.length > 0 && (
        <Card>
          <Text style={{ fontWeight: "600" }}>Offer history</Text>
          {data.offers.map((o) => (
            <Row key={o.id} style={{ justifyContent: "space-between" }}>
              <Body style={{ fontSize: 13 }}>
                v{o.version} {o.created_by_side === "brand" ? "Brand" : "You"}: {formatINR(o.price)}
              </Body>
              <StatusBadge status={o.status} />
            </Row>
          ))}
        </Card>
      )}

      {data.conversationId && (
        <Chat conversationId={data.conversationId} userId={session!.user.id} />
      )}

      {["submitted", "shortlisted", "offered"].includes(data.app.status) && (
        <Button
          title="Withdraw application"
          variant="ghost"
          onPress={() =>
            Alert.alert("Withdraw?", "The brand will no longer see your application.", [
              { text: "Cancel", style: "cancel" },
              {
                text: "Withdraw",
                style: "destructive",
                onPress: () => act(() => api(API_ROUTES.withdrawApplication(id), {})),
              },
            ])
          }
        />
      )}
    </Screen>
  );
}
