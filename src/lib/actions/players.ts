"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../auth";
import { createServiceClient } from "../supabase/server";
import type { BattingHand, PlayerStatus } from "../types";

interface PlayerInput {
  name: string;
  nickname?: string | null;
  jersey_number?: number | null;
  batting_style?: BattingHand | null;
  bowling_style?: string | null;
  photo_url?: string | null;
  /** Designation: batsman | bowler | all_rounder | keeper. */
  role?: string | null;
  /** Plain-text self-edit password. Optional on update (blank = keep). */
  edit_password?: string | null;
}

const MAX_NAME = 40;
const MAX_NICK = 24;
const DEFAULT_PASSWORD = "Test@123";

/** Returns an error string if the (already-trimmed) name is invalid, else null. */
function nameError(name: string): string | null {
  if (!name) return "Name is required.";
  if (name.length > MAX_NAME) return `Name must be ${MAX_NAME} characters or fewer.`;
  return null;
}

function clean(input: PlayerInput) {
  return {
    name: input.name.trim(),
    nickname: input.nickname?.trim().slice(0, MAX_NICK) || null,
    jersey_number:
      input.jersey_number != null && !Number.isNaN(input.jersey_number)
        ? input.jersey_number
        : null,
    batting_style: input.batting_style || null,
    bowling_style: input.bowling_style?.trim() || null,
    photo_url: input.photo_url || null,
    role: input.role || null,
  };
}

/** Public submission → pending queue. No auth required. */
export async function submitPlayer(input: PlayerInput) {
  const data = clean(input);
  const err = nameError(data.name);
  if (err) return { error: err };
  const supabase = createServiceClient();
  // unique among non-rejected
  const { data: existing } = await supabase
    .from("players")
    .select("id")
    .ilike("name", data.name)
    .neq("status", "rejected")
    .maybeSingle();
  if (existing) return { error: "A player with this name already exists." };

  const { error } = await supabase
    .from("players")
    .insert({ ...data, edit_password: input.edit_password?.trim() || DEFAULT_PASSWORD, status: "pending" });
  if (error) return { error: error.message };
  revalidatePath("/admin/players");
  return { ok: true };
}

/** Admin creates a player directly (auto-approved). */
export async function createPlayer(input: PlayerInput) {
  await requireAdmin();
  const data = clean(input);
  const err = nameError(data.name);
  if (err) return { error: err };
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("players")
    .select("id")
    .ilike("name", data.name)
    .neq("status", "rejected")
    .maybeSingle();
  if (existing) return { error: "A player with this name already exists." };
  const { error } = await supabase
    .from("players")
    .insert({ ...data, edit_password: input.edit_password?.trim() || DEFAULT_PASSWORD, status: "approved" });
  if (error) return { error: error.message };
  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { ok: true };
}

export async function updatePlayer(id: string, input: PlayerInput) {
  await requireAdmin();
  const data = clean(input);
  const err = nameError(data.name);
  if (err) return { error: err };
  const supabase = createServiceClient();
  // Name is the identity — block renaming onto another (non-rejected) player.
  const { data: clash } = await supabase
    .from("players")
    .select("id")
    .ilike("name", data.name)
    .neq("status", "rejected")
    .neq("id", id)
    .maybeSingle();
  if (clash) return { error: "A player with this name already exists." };
  const pw = input.edit_password?.trim();
  const patch = { ...data, ...(pw ? { edit_password: pw } : {}) }; // blank = keep existing
  const { error } = await supabase.from("players").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/players");
  revalidatePath(`/players/${id}`);
  return { ok: true };
}

/** Public: check a player's self-edit password. Returns only a boolean. */
export async function checkPlayerPassword(id: string, password: string) {
  const supabase = createServiceClient();
  const { data: player } = await supabase
    .from("players")
    .select("edit_password")
    .eq("id", id)
    .maybeSingle();
  if (!player) return { ok: false };
  return { ok: (password ?? "").trim() === (player.edit_password ?? "") };
}

/**
 * Public self-service edit, gated by the player's password. Updates their own
 * details (and optionally a new password). Never changes approval status.
 */
export async function updatePlayerSelf(id: string, password: string, input: PlayerInput) {
  const supabase = createServiceClient();
  const { data: player } = await supabase
    .from("players")
    .select("edit_password")
    .eq("id", id)
    .maybeSingle();
  if (!player) return { error: "Player not found." };
  if ((password ?? "").trim() !== (player.edit_password ?? ""))
    return { error: "Incorrect password." };

  const data = clean(input);
  const err = nameError(data.name);
  if (err) return { error: err };
  const { data: clash } = await supabase
    .from("players")
    .select("id")
    .ilike("name", data.name)
    .neq("status", "rejected")
    .neq("id", id)
    .maybeSingle();
  if (clash) return { error: "A player with this name already exists." };

  const newPw = input.edit_password?.trim();
  const patch = { ...data, ...(newPw ? { edit_password: newPw } : {}) };
  const { error } = await supabase.from("players").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/players/${id}`);
  revalidatePath("/players");
  revalidatePath("/admin/players");
  return { ok: true };
}

export async function setPlayerStatus(id: string, status: PlayerStatus) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { error } = await supabase.from("players").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { ok: true };
}

export async function approvePlayer(id: string) {
  return setPlayerStatus(id, "approved");
}

/** Reject = delete a pending submission. */
export async function rejectPlayer(id: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/players");
  return { ok: true };
}

/**
 * Delete a player. If they have any match history, hide instead (preserve
 * historical scorecards). Only zero-history players are hard-deleted.
 */
export async function deletePlayer(id: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("match_players")
    .select("*", { count: "exact", head: true })
    .eq("player_id", id);
  if (count && count > 0) {
    const { error } = await supabase
      .from("players")
      .update({ status: "hidden" })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin/players");
    return { ok: true, hidden: true };
  }
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/players");
  return { ok: true, hidden: false };
}

/**
 * Bulk remove players. Same rule as deletePlayer applied across the set:
 * anyone with match history is hidden (to keep historical scorecards intact),
 * the rest are hard-deleted. Returns how many of each happened.
 */
export async function deletePlayers(ids: string[]) {
  await requireAdmin();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return { error: "No players selected." };
  const supabase = createServiceClient();
  const { data: mpRows } = await supabase
    .from("match_players")
    .select("player_id")
    .in("player_id", unique);
  const withHistory = new Set((mpRows ?? []).map((r) => r.player_id));
  const toHide = unique.filter((id) => withHistory.has(id));
  const toDelete = unique.filter((id) => !withHistory.has(id));

  if (toHide.length > 0) {
    const { error } = await supabase.from("players").update({ status: "hidden" }).in("id", toHide);
    if (error) return { error: error.message };
  }
  if (toDelete.length > 0) {
    const { error } = await supabase.from("players").delete().in("id", toDelete);
    if (error) return { error: error.message };
  }
  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { ok: true, deleted: toDelete.length, hidden: toHide.length };
}
