import "server-only";
import {
  BUCKETS,
  payoutAccountSchema,
  reviewSchema,
  submissionReviewSchema,
  submissionSchema,
  type PayoutAccountInput,
  type ReviewInput,
  type SubmissionInput,
  type SubmissionReviewInput,
} from "@brandjodi/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Actor } from "../auth";
import { fromDbError } from "../errors";
import { callWorkflow } from "../rpc";

export function submitDeliverable(actor: Actor, input: SubmissionInput) {
  const s = submissionSchema.parse(input);
  return callWorkflow<string>("submit_deliverable", {
    p_deliverable: s.deliverable_id,
    p_user: actor.userId,
    p_media_paths: s.media_paths,
    p_caption: s.caption ?? null,
    p_live_url: s.live_url ?? null,
  });
}

export function reviewSubmission(actor: Actor, input: SubmissionReviewInput) {
  const r = submissionReviewSchema.parse(input);
  return callWorkflow("review_submission", {
    p_submission: r.submission_id,
    p_user: actor.userId,
    p_decision: r.decision,
    p_note: r.note ?? null,
  });
}

export function submitReview(actor: Actor, input: ReviewInput) {
  const r = reviewSchema.parse(input);
  return callWorkflow<string>("submit_review", {
    p_contract: r.contract_id,
    p_user: actor.userId,
    p_overall: r.overall,
    p_text: r.text ?? null,
  });
}

/** Short-lived links to private submission files. RLS on storage checks the caller is a contract party. */
export async function signedSubmissionUrls(
  actor: Actor,
  paths: string[],
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await actor.db.storage
    .from(BUCKETS.submissions)
    .createSignedUrls(paths, 60 * 60);
  if (error) throw fromDbError(error);
  const urls: Record<string, string> = {};
  for (const d of data) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl;
  return urls;
}

/**
 * Payout KYC. The POC stores only masked values. With Razorpay Route this creates a linked account
 * and the provider keeps the full PAN and bank details (plan B14).
 */
export async function savePayoutAccount(actor: Actor, input: PayoutAccountInput) {
  const p = payoutAccountSchema.parse(input);
  const { error } = await createAdminClient()
    .from("payout_accounts")
    .upsert({
      user_id: actor.userId,
      account_holder: p.account_holder,
      pan_last4: p.pan.slice(-4),
      bank_last4: p.bank_account.slice(-4),
      ifsc: p.ifsc,
      kyc_status: "submitted",
    });
  if (error) throw fromDbError(error);
  return callWorkflow<number>("release_pending_payouts", { p_user: actor.userId });
}
