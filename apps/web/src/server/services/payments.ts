import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Actor } from "../auth";
import { DomainError, fromDbError } from "../errors";
import { paymentProvider, verifyRazorpayWebhook, type CreatedOrder } from "../payments/provider";
import { callWorkflow } from "../rpc";

/** Brand starts paying for a contract: creates a provider order for the contract's brand_total. */
export async function createFundingOrder(actor: Actor, contractId: string): Promise<CreatedOrder> {
  // Read through RLS first: proves the caller can see the contract.
  const { data: contract, error } = await actor.db
    .from("contracts")
    .select("id, org_id, status, brand_total")
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!contract) throw new DomainError("not_found", undefined, 404);

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("organisation_members")
    .select("user_id")
    .eq("org_id", contract.org_id)
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (!member) throw new DomainError("not_allowed", undefined, 403);
  if (contract.status !== "awaiting_funding") throw new DomainError("invalid_state");

  const provider = paymentProvider();
  const order = await provider.createOrder({
    amount: contract.brand_total,
    receipt: contract.id.slice(0, 40),
    notes: { contract_id: contract.id },
  });

  const { error: insErr } = await admin.from("payments").insert({
    contract_id: contract.id,
    provider: order.provider,
    provider_order_id: order.orderId,
    amount: order.amount,
  });
  if (insErr) throw fromDbError(insErr);
  return order;
}

/** Called by the browser after Razorpay Checkout succeeds (or the mock checkout is confirmed). */
export async function confirmPayment(
  actor: Actor,
  input: { orderId: string; paymentId: string; signature: string },
): Promise<string> {
  const provider = paymentProvider();
  if (!provider.verifyCheckoutSignature(input)) throw new DomainError("invalid_signature");

  const admin = createAdminClient();
  const { data: payment, error } = await admin
    .from("payments")
    .select("amount, contract_id, provider")
    .eq("provider_order_id", input.orderId)
    .single();
  if (error) throw fromDbError(error);
  if (payment.provider !== provider.name) throw new DomainError("invalid_signature");

  return callWorkflow<string>("record_payment_captured", {
    p_order_id: input.orderId,
    p_payment_id: input.paymentId,
    p_amount: payment.amount,
    p_raw: { source: "checkout", actor: actor.userId },
  });
}

/**
 * Razorpay webhook. Idempotent: each event id is stored once, and record_payment_captured() is a
 * no-op for an order that is already captured (the checkout callback usually gets there first).
 */
export async function handleRazorpayWebhook(
  rawBody: string,
  signature: string | null,
  eventId: string | null,
) {
  if (!verifyRazorpayWebhook(rawBody, signature))
    throw new DomainError("invalid_signature", undefined, 401);

  const event = JSON.parse(rawBody) as {
    event: string;
    payload?: { payment?: { entity?: { id: string; order_id: string; amount: number } } };
  };
  const admin = createAdminClient();
  const id =
    eventId ?? `${event.event}:${event.payload?.payment?.entity?.id ?? crypto.randomUUID()}`;

  const { error: dupErr } = await admin
    .from("webhook_events")
    .insert({ provider: "razorpay", event_id: id, event_type: event.event, payload: event });
  if (dupErr?.code === "23505") return { duplicate: true };
  if (dupErr) throw fromDbError(dupErr);

  try {
    const entity = event.payload?.payment?.entity;
    if ((event.event === "payment.captured" || event.event === "order.paid") && entity) {
      await callWorkflow("record_payment_captured", {
        p_order_id: entity.order_id,
        p_payment_id: entity.id,
        p_amount: entity.amount,
        p_raw: event,
      });
    }
    await admin
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("event_id", id);
  } catch (e) {
    await admin
      .from("webhook_events")
      .update({ error: e instanceof Error ? e.message : String(e) })
      .eq("event_id", id);
    throw e;
  }
  return { duplicate: false };
}
