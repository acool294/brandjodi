/** Enumerations shared by the database, web and mobile. Keep in sync with supabase/migrations. */

export const CATEGORIES = [
  "fashion",
  "beauty",
  "skincare",
  "haircare",
  "jewellery",
  "footwear",
  "fitness",
  "lifestyle",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CREATOR_TYPES = ["influencer", "ugc", "model", "photographer"] as const;
export type CreatorType = (typeof CREATOR_TYPES)[number];

export const LANGUAGES = [
  "english",
  "hindi",
  "marathi",
  "tamil",
  "telugu",
  "kannada",
  "bengali",
  "gujarati",
  "malayalam",
  "punjabi",
] as const;

export const PLATFORMS = ["instagram", "youtube", "none"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** UGC assets are handed to the brand; influencer posts go live on the creator's account. */
export const DELIVERABLE_KINDS = ["ugc_asset", "influencer_post"] as const;
export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

export const DELIVERABLE_FORMATS = [
  "reel",
  "story",
  "post",
  "video",
  "photo_set",
  "yt_integration",
] as const;
export type DeliverableFormat = (typeof DELIVERABLE_FORMATS)[number];

export const COMPENSATION_TYPES = ["paid", "paid_plus_product"] as const;
export type CompensationType = (typeof COMPENSATION_TYPES)[number];

export const CAMPAIGN_STATUSES = ["draft", "published", "paused", "closed"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const APPLICATION_STATUSES = [
  "submitted",
  "shortlisted",
  "rejected",
  "offered",
  "hired",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const OFFER_STATUSES = ["sent", "countered", "accepted", "declined", "withdrawn"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const CONTRACT_STATUSES = [
  "awaiting_funding",
  "active",
  "in_review",
  "revision_requested",
  "approved",
  "paid_out",
  "closed",
  "cancelled",
  "disputed",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const DELIVERABLE_STATUSES = [
  "pending",
  "submitted",
  "changes_requested",
  "approved",
] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];

export const SUBMISSION_STATUSES = [
  "submitted",
  "changes_requested",
  "approved",
  "auto_approved",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const PAYOUT_STATUSES = [
  "pending_kyc",
  "scheduled",
  "processing",
  "paid",
  "failed",
] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const USAGE_RIGHTS_CHANNELS = [
  "organic_social",
  "paid_ads",
  "website",
  "marketplaces",
  "offline",
] as const;
export type UsageRightsChannel = (typeof USAGE_RIGHTS_CHANNELS)[number];

/** Storage buckets created by the migrations. */
export const BUCKETS = {
  avatars: "avatars",
  portfolio: "portfolio",
  submissions: "submissions",
} as const;

/** Supabase free plan caps a single upload at 50 MB. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Live",
  paused: "Paused",
  closed: "Closed",
  submitted: "Submitted",
  shortlisted: "Shortlisted",
  rejected: "Not selected",
  offered: "Offer sent",
  hired: "Hired",
  withdrawn: "Withdrawn",
  sent: "Awaiting reply",
  countered: "Countered",
  accepted: "Accepted",
  declined: "Declined",
  awaiting_funding: "Awaiting payment",
  active: "In progress",
  in_review: "In review",
  revision_requested: "Revision requested",
  approved: "Approved",
  paid_out: "Paid out",
  cancelled: "Cancelled",
  disputed: "Disputed",
  pending: "Not started",
  changes_requested: "Changes requested",
  auto_approved: "Auto-approved",
  pending_kyc: "Waiting for payout details",
  scheduled: "Scheduled",
  processing: "Processing",
  paid: "Paid",
  failed: "Failed",
};

export function labelFor(value: string): string {
  return STATUS_LABELS[value] ?? value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
