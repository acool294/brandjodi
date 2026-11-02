/** Errors raised by the domain layer. `code` matches the exception names raised by the SQL workflows. */
export class DomainError extends Error {
  constructor(
    public code: string,
    message?: string,
    public status = 400,
  ) {
    super(message ?? MESSAGES[code] ?? code);
  }
}

const MESSAGES: Record<string, string> = {
  not_signed_in: "Please sign in.",
  not_allowed: "You don't have access to do that.",
  not_found: "Not found.",
  invalid_state: "That action isn't available any more. Refresh and try again.",
  invalid_status: "Unknown status.",
  offer_expired: "This offer has expired.",
  cannot_counter_own_offer: "You can't counter your own offer.",
  cannot_respond_to_own_offer: "Waiting for the other side to respond.",
  payment_not_found: "Payment not found.",
  amount_mismatch: "Payment amount does not match.",
  already_submitted: "This deliverable is already submitted and waiting for review.",
  empty_submission: "Upload at least one file or add the live post link.",
  live_url_required: "Influencer posts need the link to the live post.",
  invalid_media_path: "Upload failed. Please try again.",
  no_revisions_left: "All included revisions are used. Approve, or agree extra revisions in chat.",
  already_reviewed: "You have already reviewed this contract.",
  no_org: "Create your brand profile first.",
  invalid_signature: "Payment could not be verified.",
};

/** Turns a PostgREST / Postgres error into a DomainError, keeping known workflow codes. */
export function fromDbError(error: { message: string; code?: string }): DomainError {
  const code = error.message.trim();
  if (MESSAGES[code]) return new DomainError(code, undefined, code === "not_allowed" ? 403 : 400);
  if (error.code === "23505") return new DomainError("duplicate", "That already exists.");
  if (error.code === "42501") return new DomainError("not_allowed", MESSAGES.not_allowed, 403);
  console.error("[db]", error);
  return new DomainError("internal", "Something went wrong. Please try again.", 500);
}
