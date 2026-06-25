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
}

function clean(input: PlayerInput) {
  return {
    name: input.name.trim(),
    nickname: input.nickname?.trim() || null,
    jersey_number:
      input.jersey_number != null && !Number.isNaN(input.jersey_number)
        ? input.jersey_number
        : null,
    batting_style: input.batting_style || null,
    bowling_style: input.bowling_style?.trim() || null,
    photo_url: input.photo_url || null,
  };
}

/** Public submission → pending queue. No auth required. */
export async function submitPlayer(input: PlayerInput) {
  const data = clean(input);
  if (!data.name) return { error: "Name is required." };
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
    .insert({ ...data, status: "pending" });
  if (error) return { error: error.message };
  revalidatePath("/admin/players");
  return { ok: true };
}

/** Admin creates a player directly (auto-approved). */
export async function createPlayer(input: PlayerInput) {
  await requireAdmin();
  const data = clean(input);
  if (!data.name) return { error: "Name is required." };
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
    .insert({ ...data, status: "approved" });
  if (error) return { error: error.message };
  revalidatePath("/admin/players");
  revalidatePath("/players");
  return { ok: true };
}

export async function updatePlayer(id: string, input: PlayerInput) {
  await requireAdmin();
  const data = clean(input);
  const supabase = createServiceClient();
  const { error } = await supabase.from("players").update(data).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/players");
  revalidatePath(`/players/${id}`);
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
