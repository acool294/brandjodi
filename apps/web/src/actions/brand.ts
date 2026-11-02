"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CampaignInput, CampaignStatus } from "@brandjodi/shared";
import { requireWebActor } from "@/server/auth";
import {
  cancelUnfundedContract,
  confirmPayment,
  counterOffer,
  createCampaign,
  createFundingOrder,
  createOrganisation,
  respondToOffer,
  reviewSubmission,
  sendOffer,
  setApplicationStatus,
  setCampaignStatus,
  submitReview,
} from "@/server/services";
import { int, rupees, str, toActionError, type ActionState } from "./result";

export async function createOrganisationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requireWebActor();
    await createOrganisation(actor, {
      name: str(fd, "name"),
      website: str(fd, "website"),
      industry: str(fd, "industry") || undefined,
      city: str(fd, "city") || undefined,
      about: str(fd, "about"),
      gstin: str(fd, "gstin"),
    });
  } catch (e) {
    return toActionError(e);
  }
  redirect("/dashboard");
}

/** The campaign form posts JSON (it has a repeating deliverables list). */
export async function createCampaignAction(
  input: CampaignInput,
  publish: boolean,
): Promise<ActionState> {
  let id: string;
  try {
    id = await createCampaign(await requireWebActor(), input, publish);
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/campaigns/${id}`);
}

export async function setCampaignStatusAction(campaignId: string, status: CampaignStatus) {
  await setCampaignStatus(await requireWebActor(), campaignId, status);
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function setApplicationStatusAction(
  applicationId: string,
  status: "shortlisted" | "rejected" | "submitted",
) {
  await setApplicationStatus(await requireWebActor(), applicationId, status);
  revalidatePath("/campaigns", "layout");
}

export async function sendOfferAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await sendOffer(await requireWebActor(), {
      application_id: str(fd, "application_id"),
      price: rupees(fd, "price"),
      delivery_days: int(fd, "delivery_days"),
      revisions_included: int(fd, "revisions_included"),
      message: str(fd, "message"),
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/campaigns", "layout");
  return { ok: true, message: "Offer sent." };
}

export async function counterOfferAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await counterOffer(await requireWebActor(), {
      offer_id: str(fd, "offer_id"),
      price: rupees(fd, "price"),
      message: str(fd, "message"),
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/campaigns", "layout");
  return { ok: true, message: "Counter sent." };
}

export async function respondToOfferAction(
  offerId: string,
  action: "accept" | "decline",
): Promise<ActionState> {
  let contractId: string | null;
  try {
    contractId = await respondToOffer(await requireWebActor(), { offer_id: offerId, action });
  } catch (e) {
    return toActionError(e);
  }
  if (contractId) redirect(`/contracts/${contractId}`);
  revalidatePath("/campaigns", "layout");
  return { ok: true };
}

export async function cancelContractAction(contractId: string) {
  await cancelUnfundedContract(await requireWebActor(), contractId);
  revalidatePath(`/contracts/${contractId}`);
}

export async function createFundingOrderAction(contractId: string) {
  try {
    const order = await createFundingOrder(await requireWebActor(), contractId);
    return { ok: true as const, order };
  } catch (e) {
    return toActionError(e);
  }
}

export async function confirmPaymentAction(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  try {
    const contractId = await confirmPayment(await requireWebActor(), input);
    revalidatePath(`/contracts/${contractId}`);
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

export async function reviewSubmissionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await reviewSubmission(await requireWebActor(), {
      submission_id: str(fd, "submission_id"),
      decision: str(fd, "decision") as "approve" | "request_changes",
      note: str(fd, "note"),
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/contracts", "layout");
  return { ok: true };
}

export async function submitReviewAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await submitReview(await requireWebActor(), {
      contract_id: str(fd, "contract_id"),
      overall: int(fd, "overall"),
      text: str(fd, "text"),
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/contracts", "layout");
  return {
    ok: true,
    message: "Thanks! Your review is shown once the creator reviews too, or after 14 days.",
  };
}
