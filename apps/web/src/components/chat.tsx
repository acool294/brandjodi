"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_side: "brand" | "creator" | "system";
  body: string;
  masked: boolean;
  created_at: string;
}

/** Realtime chat for one conversation. Contact details are masked by the database until funding. */
export function Chat({
  conversationId,
  userId,
  initialMessages,
  counterpartName,
}: {
  conversationId: string;
  userId: string;
  initialMessages: ChatMessage[];
  counterpartName: string;
}) {
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
          const m = payload.new as ChatMessage;
          setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBody("");
    setError(null);
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
    setMessages((list) =>
      list.some((x) => x.id === data.id) ? list : [...list, data as ChatMessage],
    );
  }

  return (
    <div className="flex h-[480px] flex-col rounded-xl border bg-card">
      <div className="border-b px-4 py-3 text-sm font-medium">Chat with {counterpartName}</div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">No messages yet.</p>
        )}
        {messages.map((m) =>
          m.sender_side === "system" ? (
            <p key={m.id} className="text-center text-xs text-muted-foreground">
              {m.body}
            </p>
          ) : (
            <div
              key={m.id}
              className={cn("flex", m.sender_id === userId ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                  m.sender_id === userId ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                {m.masked && (
                  <p className="mt-1 text-[11px] opacity-75">
                    Contact details are hidden until the contract is funded.
                  </p>
                )}
              </div>
            </div>
          ),
        )}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t p-3">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          maxLength={4000}
        />
        <Button type="submit">Send</Button>
      </form>
      {error && <p className="px-3 pb-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
