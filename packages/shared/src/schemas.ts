import { z } from "zod";
import {
  CATEGORIES,
  COMPENSATION_TYPES,
  CREATOR_TYPES,
  DELIVERABLE_FORMATS,
  DELIVERABLE_KINDS,
  PLATFORMS,
  USAGE_RIGHTS_CHANNELS,
} from "./constants";

/** Zod schemas shared by forms (web and mobile) and by the API routes that validate input. */

const paise = z.number().int().nonnegative();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,30}$/, "3–30 characters: letters, numbers, dot or underscore");

export const creatorProfileSchema = z.object({
  username: usernameSchema,
  display_name: z.string().trim().min(2).max(80),
  bio: optionalText(600),
  city: z.string().trim().min(2).max(60),
  languages: z.array(z.string()).max(10).default([]),
  categories: z.array(z.enum(CATEGORIES)).min(1, "Pick at least one category"),
  creator_types: z.array(z.enum(CREATOR_TYPES)).min(1, "Pick at least one type"),
  instagram_handle: optionalText(60),
  instagram_followers: z.number().int().nonnegative().optional(),
  youtube_handle: optionalText(60),
  youtube_subscribers: z.number().int().nonnegative().optional(),
  starting_price: paise.optional(),
  is_adult: z.literal(true, { message: "You must be 18 or older to use BrandJodi" }),
});
export type CreatorProfileInput = z.infer<typeof creatorProfileSchema>;

export const organisationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  website: z
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  industry: z.string().trim().max(60).optional(),
  city: z.string().trim().max(60).optional(),
  about: optionalText(1000),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9]{2}[A-Z0-9]{13}$/, "GSTIN is 15 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type OrganisationInput = z.infer<typeof organisationSchema>;

export const usageRightsSchema = z.object({
  channels: z.array(z.enum(USAGE_RIGHTS_CHANNELS)).default(["organic_social"]),
  duration_days: z.number().int().min(0).max(3650).default(90),
  territory: z.string().default("India"),
});
export type UsageRights = z.infer<typeof usageRightsSchema>;

export const deliverableSchema = z.object({
  kind: z.enum(DELIVERABLE_KINDS),
  platform: z.enum(PLATFORMS),
  format: z.enum(DELIVERABLE_FORMATS),
  quantity: z.number().int().min(1).max(20).default(1),
  specs: optionalText(500),
});
export type DeliverableInput = z.infer<typeof deliverableSchema>;

export const campaignSchema = z.object({
  title: z.string().trim().min(5).max(120),
  brief: z.string().trim().min(20).max(5000),
  category: z.enum(CATEGORIES),
  compensation_type: z.enum(COMPENSATION_TYPES).default("paid"),
  budget_per_creator: paise.min(500_00, "Minimum budget is ₹500"),
  creators_needed: z.number().int().min(1).max(100).default(1),
  deadline: z.iso.date().optional(),
  is_remote: z.boolean().default(true),
  location: optionalText(100),
  revisions_included: z.number().int().min(0).max(5).default(1),
  usage_rights: usageRightsSchema,
  exclusivity_days: z.number().int().min(0).max(365).default(0),
  disclosure_required: z.boolean().default(true),
  product_info: optionalText(1000),
  deliverables: z.array(deliverableSchema).min(1, "Add at least one deliverable"),
});
export type CampaignInput = z.infer<typeof campaignSchema>;

export const applicationSchema = z.object({
  campaign_id: z.uuid(),
  quoted_price: paise.min(100_00),
  delivery_days: z.number().int().min(1).max(90),
  pitch: z
    .string()
    .trim()
    .min(20, "Tell the brand why you are a good fit (20+ characters)")
    .max(2000),
});
export type ApplicationInput = z.infer<typeof applicationSchema>;

export const offerSchema = z.object({
  application_id: z.uuid(),
  price: paise.min(100_00),
  delivery_days: z.number().int().min(1).max(90),
  revisions_included: z.number().int().min(0).max(5),
  message: optionalText(1000),
});
export type OfferInput = z.infer<typeof offerSchema>;

export const counterOfferSchema = z.object({
  offer_id: z.uuid(),
  price: paise.min(100_00),
  message: optionalText(1000),
});
export type CounterOfferInput = z.infer<typeof counterOfferSchema>;

export const offerResponseSchema = z.object({
  offer_id: z.uuid(),
  action: z.enum(["accept", "decline"]),
});

export const submissionSchema = z
  .object({
    deliverable_id: z.uuid(),
    media_paths: z.array(z.string().min(1)).max(10).default([]),
    caption: optionalText(2200),
    live_url: z
      .url()
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine((s) => s.media_paths.length > 0 || s.live_url, {
    message: "Upload at least one file or add the live post link",
  });
export type SubmissionInput = z.infer<typeof submissionSchema>;

export const submissionReviewSchema = z.object({
  submission_id: z.uuid(),
  decision: z.enum(["approve", "request_changes"]),
  note: optionalText(1000),
});
export type SubmissionReviewInput = z.infer<typeof submissionReviewSchema>;

export const reviewSchema = z.object({
  contract_id: z.uuid(),
  overall: z.number().int().min(1).max(5),
  text: optionalText(1000),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

export const payoutAccountSchema = z.object({
  account_holder: z.string().trim().min(2).max(100),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN looks like ABCDE1234F"),
  bank_account: z
    .string()
    .trim()
    .regex(/^[0-9]{9,18}$/, "9–18 digits"),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC looks like HDFC0001234"),
});
export type PayoutAccountInput = z.infer<typeof payoutAccountSchema>;

export const pushTokenSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(["ios", "android", "web"]),
});
