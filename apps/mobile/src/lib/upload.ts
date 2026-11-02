import { BUCKETS, MAX_UPLOAD_BYTES } from "@brandjodi/shared";
import type { ImagePickerAsset } from "expo-image-picker";
import { supabase } from "./supabase";

/**
 * Uploads a picked photo or video to submissions/<contract_id>/<user_id>/<file>. Storage policies
 * only allow the contract's creator to write there. Returns the storage path.
 */
export async function uploadSubmissionFile(
  contractId: string,
  userId: string,
  asset: ImagePickerAsset,
) {
  if (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES) {
    throw new Error("Files must be under 50 MB in this test version.");
  }
  const ext = (
    asset.fileName?.split(".").pop() ?? (asset.type === "video" ? "mp4" : "jpg")
  ).toLowerCase();
  const path = `${contractId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const body = await (await fetch(asset.uri)).arrayBuffer();
  const { error } = await supabase.storage.from(BUCKETS.submissions).upload(path, body, {
    contentType: asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg"),
    upsert: false,
  });
  if (error) throw error;
  return path;
}
