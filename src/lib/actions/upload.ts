"use server";
import { requireAdmin } from "../auth";
import { createServiceClient } from "../supabase/server";

/**
 * Upload a (client-compressed) data-URL image to a public storage bucket.
 * Returns the public URL. Admin-only.
 */
export async function uploadImage(
  bucket: "player-photos" | "team-logos",
  dataUrl: string
): Promise<string> {
  await requireAdmin();
  const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image data.");
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength > 2_500_000) throw new Error("Image too large (max ~2MB).");

  const ext = contentType.split("/")[1] === "png" ? "png" : "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Public-facing player photo upload (used by the Submit-a-Player form).
 * No admin required, but strictly limited to player-photos with a hard size cap.
 */
export async function uploadPublicPlayerPhoto(dataUrl: string): Promise<string> {
  const m = /^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error("Invalid image.");
  const buffer = Buffer.from(m[2], "base64");
  if (buffer.byteLength > 2_000_000) throw new Error("Image too large (max 2MB).");
  const ext = m[1].includes("png") ? "png" : "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const supabase = createServiceClient();
  const { error } = await supabase.storage
    .from("player-photos")
    .upload(path, buffer, { contentType: m[1], upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from("player-photos").getPublicUrl(path).data.publicUrl;
}
