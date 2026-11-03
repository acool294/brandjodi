import "server-only";
import { BUCKETS } from "@brandjodi/shared";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Actor } from "../auth";
import { DomainError, fromDbError } from "../errors";

export interface CreatorDetails {
  username: string;
  display_name: string;
  bio: string | null;
  city: string | null;
  languages: string[];
  categories: string[];
  creator_types: string[];
  instagram_handle: string | null;
  instagram_followers: number | null;
  youtube_handle: string | null;
  youtube_subscribers: number | null;
  starting_price: number | null;
  rating_avg: number | null;
  rating_count: number;
  completed_count: number;
  metrics_verified: boolean;
  portfolio: {
    id: string;
    title: string;
    brand_name: string | null;
    link: string | null;
    image_url: string | null;
  }[];
  reviews: { overall: number; text: string | null; brand: string; created_at: string }[];
}

/** Everything a brand sees in the creator pop-up. Only public profile data and revealed reviews. */
export async function getCreatorDetails(actor: Actor, username: string): Promise<CreatorDetails> {
  const { data: c, error } = await actor.db
    .from("creator_profiles")
    .select(
      "user_id, username, display_name, bio, city, languages, categories, creator_types, instagram_handle, instagram_followers, youtube_handle, youtube_subscribers, starting_price, rating_avg, rating_count, completed_count, metrics_verified",
    )
    .eq("username", username)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!c) throw new DomainError("not_found", undefined, 404);

  const [portfolio, reviews] = await Promise.all([
    actor.db
      .from("portfolio_items")
      .select("id, title, brand_name, link, media_path")
      .eq("creator_id", c.user_id)
      .order("sort_order")
      .limit(9),
    // Reviews are public once revealed; the admin client is used only to join the contract's brand.
    createAdminClient()
      .from("reviews")
      .select("overall, text, created_at, contracts!inner(creator_id, organisations(name))")
      .eq("contracts.creator_id", c.user_id)
      .eq("author_side", "brand")
      .lte("visible_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user_id, ...profile } = c;
  return {
    ...profile,
    rating_avg: c.rating_avg === null ? null : Number(c.rating_avg),
    portfolio: (portfolio.data ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      brand_name: p.brand_name,
      link: p.link,
      image_url: p.media_path
        ? `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKETS.portfolio}/${p.media_path}`
        : null,
    })),
    reviews: (reviews.data ?? []).map((r) => ({
      overall: r.overall,
      text: r.text,
      created_at: r.created_at,
      brand:
        (r.contracts as unknown as { organisations: { name: string } | null }).organisations
          ?.name ?? "A brand",
    })),
  };
}
