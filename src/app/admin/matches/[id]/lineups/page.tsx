import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { LineupEditor } from "@/components/admin/LineupEditor";
import { createReadClient } from "@/lib/supabase/server";
import { getPlayers, getRosterMap } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function LineupsPage({ params }: { params: { id: string } }) {
  await ensureAdmin();
  const supabase = createReadClient();
  const { data: match } = await supabase.from("matches").select("*").eq("id", params.id).maybeSingle();
  if (!match) notFound();

  const [{ data: teams }, { data: matchPlayers }, players, rosters, { data: innings }] = await Promise.all([
    supabase.from("teams").select("*").in("id", [match.team_a_id, match.team_b_id].filter(Boolean) as string[]),
    supabase.from("match_players").select("*").eq("match_id", params.id),
    getPlayers(["approved"]),
    getRosterMap(),
    supabase.from("innings").select("id").eq("match_id", params.id),
  ]);

  // Determine which players have participated (can't be removed).
  const innIds = (innings ?? []).map((i) => i.id);
  const locked = new Set<string>();
  if (innIds.length > 0) {
    const [{ data: deliveries }, { data: events }] = await Promise.all([
      supabase
        .from("deliveries")
        .select("bowler_id,striker_id,non_striker_id,dismissed_player_id,fielder_id")
        .in("innings_id", innIds),
      supabase.from("batting_events").select("player_id").in("innings_id", innIds),
    ]);
    for (const d of deliveries ?? []) {
      [d.bowler_id, d.striker_id, d.non_striker_id, d.dismissed_player_id, d.fielder_id].forEach(
        (id) => id && locked.add(id)
      );
    }
    for (const e of events ?? []) if (e.player_id) locked.add(e.player_id);
  }

  return (
    <AdminShell>
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/admin/matches/${params.id}/score`} className="text-sm text-ink-muted hover:text-ink">
          ← Back to scoring
        </Link>
      </div>
      <h1 className="mb-1 font-display text-2xl font-bold text-ink">Edit lineups</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Add or swap players any time. A player who has already batted, bowled or fielded is locked.
      </p>
      <LineupEditor
        matchId={params.id}
        teams={teams ?? []}
        matchPlayers={matchPlayers ?? []}
        players={players}
        rosters={rosters}
        lockedIds={[...locked]}
      />
    </AdminShell>
  );
}
