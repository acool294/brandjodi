import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { colors, radius, spacing } from "@/theme";
import { Button, Card, ErrorText } from "./ui";

interface Message {
  id: string;
  sender_id: string;
  sender_side: "brand" | "creator" | "system";
  body: string;
  masked: boolean;
  created_at: string;
}

/** Realtime chat for one conversation. The database hides contact details until the contract is funded. */
export function Chat({ conversationId, userId }: { conversationId: string; userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("messages")
      .select("id, sender_id, sender_side, body, masked, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at")
      .then(({ data }) => active && setMessages((data as Message[]) ?? []));

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
        },
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBody("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: userId, body: text })
      .select("id, sender_id, sender_side, body, masked, created_at")
      .single();
    if (error) {
      setError(error.message);
      setBody(text);
      return;
    }
    setError(null);
    setMessages((list) => (list.some((x) => x.id === data.id) ? list : [...list, data as Message]));
  }

  return (
    <Card>
      <Text style={{ fontWeight: "600" }}>Chat with the brand</Text>
      {messages.length === 0 && <Text style={{ color: colors.muted }}>No messages yet.</Text>}
      {messages.map((m) =>
        m.sender_side === "system" ? (
          <Text key={m.id} style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
            {m.body}
          </Text>
        ) : (
          <View
            key={m.id}
            style={{
              alignSelf: m.sender_id === userId ? "flex-end" : "flex-start",
              backgroundColor: m.sender_id === userId ? colors.primary : colors.subtle,
              borderRadius: radius.lg,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              maxWidth: "80%",
            }}
          >
            <Text style={{ color: m.sender_id === userId ? colors.primaryText : colors.text }}>
              {m.body}
            </Text>
            {m.masked && (
              <Text
                style={{
                  fontSize: 11,
                  opacity: 0.75,
                  color: m.sender_id === userId ? colors.primaryText : colors.muted,
                }}
              >
                Contact details are hidden until the contract is funded.
              </Text>
            )}
          </View>
        ),
      )}
      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Message"
          placeholderTextColor={colors.muted}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            color: colors.text,
          }}
        />
        <Button title="Send" onPress={send} />
      </View>
      <ErrorText message={error} />
    </Card>
  );
}
