import "server-only";
import {
  applicationSchema,
  counterOfferSchema,
  offerResponseSchema,
  offerSchema,
  type ApplicationInput,
  type CounterOfferInput,
  type OfferInput,
} from "@brandjodi/shared";
import type { Actor } from "../auth";
import { fromDbError } from "../errors";
import { callWorkflow } from "../rpc";

/** Creators apply directly through RLS (the policy checks the campaign is live). */
export async function applyToCampaign(actor: Actor, input: ApplicationInput): Promise<string> {
  const parsed = applicationSchema.parse(input);
  const { data, error } = await actor.db
    .from("applications")
    .insert({ ...parsed, creator_id: actor.userId })
    .select("id")
    .single();
  if (error) throw fromDbError(error);
  return data.id as string;
}

export function setApplicationStatus(
  actor: Actor,
  applicationId: string,
  status: "shortlisted" | "rejected" | "submitted" | "withdrawn",
) {
  return callWorkflow("set_application_status", {
    p_application: applicationId,
    p_user: actor.userId,
    p_status: status,
  });
}

export function sendOffer(actor: Actor, input: OfferInput) {
  const o = offerSchema.parse(input);
  return callWorkflow<string>("send_offer", {
    p_application: o.application_id,
    p_user: actor.userId,
    p_price: o.price,
    p_delivery_days: o.delivery_days,
    p_revisions: o.revisions_included,
    p_message: o.message ?? null,
  });
}

export function counterOffer(actor: Actor, input: CounterOfferInput) {
  const o = counterOfferSchema.parse(input);
  return callWorkflow<string>("counter_offer", {
    p_offer: o.offer_id,
    p_user: actor.userId,
    p_price: o.price,
    p_message: o.message ?? null,
  });
}

/** Returns the new contract id when accepted, null when declined. */
export function respondToOffer(
  actor: Actor,
  input: { offer_id: string; action: "accept" | "decline" },
) {
  const o = offerResponseSchema.parse(input);
  return callWorkflow<string | null>("respond_to_offer", {
    p_offer: o.offer_id,
    p_user: actor.userId,
    p_action: o.action,
    p_ip: actor.ip ?? null,
  });
}

export function cancelUnfundedContract(actor: Actor, contractId: string) {
  return callWorkflow("cancel_unfunded_contract", { p_contract: contractId, p_user: actor.userId });
}
