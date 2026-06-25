"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "../auth";
import { createServiceClient } from "../supabase/server";

interface TeamInput {
  name: string;
  color?: string | null;
  logo_url?: string | null;
}

export async function createTeam(input: TeamInput) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) return { error: "Team name is required." };
  const supabase = createServiceClient();
  const { error } = await supabase.from("teams").insert({
    name,
    color: input.color || "#59C749",
    logo_url: input.logo_url || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/teams");
  return { ok: true };
}

export async function updateTeam(id: string, input: TeamInput) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("teams")
    .update({
      name: input.name.trim(),
      color: input.color || "#59C749",
      logo_url: input.logo_url || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/teams");
  return { ok: true };
}

export async function deleteTeam(id: string) {
  await requireAdmin();
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("match_players")
    .select("*", { count: "exact", head: true })
    .eq("team_id", id);
  if (count && count > 0) {
    return { error: "Team has match history and cannot be deleted." };
  }
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/teams");
  return { ok: true };
}
