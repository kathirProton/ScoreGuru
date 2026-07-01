"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../auth";
import { createServiceClient } from "../supabase/server";

interface TeamInput {
  name: string;
  color?: string | null;
  logo_url?: string | null;
}

const MAX_TEAM_NAME = 40;

export async function createTeam(input: TeamInput) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) return { error: "Team name is required." };
  if (name.length > MAX_TEAM_NAME) return { error: `Team name must be ${MAX_TEAM_NAME} characters or fewer.` };
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("teams")
    .insert({
      name,
      color: input.color || "#59C749",
      logo_url: input.logo_url || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Failed to create team." };
  revalidatePath("/admin/teams");
  revalidatePath("/teams");
  return { ok: true, teamId: data.id };
}

/**
 * Replace a team's roster with the given player set. Team ↔ player is a
 * persistent many-to-many; a player may be on any number of teams. This only
 * touches the roster — never match_players — so historical scorecards are safe.
 */
export async function setTeamRoster(teamId: string, playerIds: string[]) {
  await requireAdmin();
  const supabase = createServiceClient();
  const unique = [...new Set(playerIds)];
  await supabase.from("team_players").delete().eq("team_id", teamId);
  if (unique.length > 0) {
    const { error } = await supabase
      .from("team_players")
      .insert(unique.map((player_id) => ({ team_id: teamId, player_id })));
    if (error) return { error: error.message };
  }
  revalidatePath("/admin/teams");
  revalidatePath("/teams");
  return { ok: true };
}

export async function updateTeam(id: string, input: TeamInput) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) return { error: "Team name is required." };
  if (name.length > MAX_TEAM_NAME) return { error: `Team name must be ${MAX_TEAM_NAME} characters or fewer.` };
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("teams")
    .update({
      name,
      color: input.color || "#59C749",
      logo_url: input.logo_url || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/teams");
  revalidatePath("/teams");
  return { ok: true };
}

/**
 * Delete a team. A team that has appeared in a match is ARCHIVED (hidden) so
 * historical scorecards keep resolving its name; a team that never played is
 * hard-deleted (its roster rows cascade away).
 */
export async function deleteTeam(id: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const [{ count: mpCount }, { count: matchCount }] = await Promise.all([
    supabase.from("match_players").select("*", { count: "exact", head: true }).eq("team_id", id),
    supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .or(`team_a_id.eq.${id},team_b_id.eq.${id}`),
  ]);
  const hasHistory = (mpCount ?? 0) > 0 || (matchCount ?? 0) > 0;

  if (hasHistory) {
    const { error } = await supabase.from("teams").update({ hidden: true }).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin/teams");
    revalidatePath("/teams");
    return { ok: true, archived: true };
  }
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/teams");
  revalidatePath("/teams");
  return { ok: true, archived: false };
}

/** Restore an archived (hidden) team back into the pickers. */
export async function restoreTeam(id: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { error } = await supabase.from("teams").update({ hidden: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/teams");
  revalidatePath("/teams");
  return { ok: true };
}
