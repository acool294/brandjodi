import { BUCKETS } from "@brandjodi/shared";
import type { ImagePickerAsset } from "expo-image-picker";
import { env } from "./env";
import { supabase } from "./supabase";

export interface PortfolioItem {
  id: string;
  title: string;
  brand_name: string | null;
  media_path: string | null;
}

export const portfolioImageUrl = (path: string) =>
  `${env.supabaseUrl}/storage/v1/object/public/${BUCKETS.portfolio}/${path}`;

/** Uploads to portfolio/<user_id>/... (public bucket) and adds it to the media kit. */
export async function addPortfolioImage(userId: string, asset: ImagePickerAsset, title: string) {
  const ext = (asset.fileName?.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;
  const body = await (await fetch(asset.uri)).arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKETS.portfolio)
    .upload(path, body, { contentType: asset.mimeType ?? "image/jpeg" });
  if (error) throw error;
  const { error: insErr } = await supabase
    .from("portfolio_items")
    .insert({ creator_id: userId, title, media_path: path, sort_order: Date.now() % 100000 });
  if (insErr) throw insErr;
}

export async function removePortfolioItem(item: PortfolioItem) {
  if (item.media_path) await supabase.storage.from(BUCKETS.portfolio).remove([item.media_path]);
  const { error } = await supabase.from("portfolio_items").delete().eq("id", item.id);
  if (error) throw error;
}
