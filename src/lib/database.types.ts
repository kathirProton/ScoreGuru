export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      batting_events: {
        Row: {
          at_end: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["batting_event_type"]
          id: string
          innings_id: string
          player_id: string
          seq: number
        }
        Insert: {
          at_end?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["batting_event_type"]
          id?: string
          innings_id: string
          player_id: string
          seq?: number
        }
        Update: {
          at_end?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["batting_event_type"]
          id?: string
          innings_id?: string
          player_id?: string
          seq?: number
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          ball_in_over: number
          bowler_id: string
          created_at: string
          dismissed_player_id: string | null
          extra_runs: number
          extra_type: Database["public"]["Enums"]["extra_type"]
          fielder_id: string | null
          id: string
          innings_id: string
          is_free_hit: boolean
          is_wicket: boolean
          legal_ball_number: number
          non_striker_id: string
          over_number: number
          runs_off_bat: number
          seq: number
          striker_id: string
          wicket_type: Database["public"]["Enums"]["wicket_type"] | null
        }
        Insert: {
          ball_in_over: number
          bowler_id: string
          created_at?: string
          dismissed_player_id?: string | null
          extra_runs?: number
          extra_type?: Database["public"]["Enums"]["extra_type"]
          fielder_id?: string | null
          id?: string
          innings_id: string
          is_free_hit?: boolean
          is_wicket?: boolean
          legal_ball_number: number
          non_striker_id: string
          over_number: number
          runs_off_bat?: number
          seq?: number
          striker_id: string
          wicket_type?: Database["public"]["Enums"]["wicket_type"] | null
        }
        Update: Partial<Database["public"]["Tables"]["deliveries"]["Insert"]>
        Relationships: []
      }
      innings: {
        Row: {
          batting_team_id: string
          bowling_team_id: string
          created_at: string
          id: string
          innings_number: number
          is_closed: boolean
          is_super_over: boolean
          match_id: string
          target: number | null
        }
        Insert: {
          batting_team_id: string
          bowling_team_id: string
          created_at?: string
          id?: string
          innings_number: number
          is_closed?: boolean
          is_super_over?: boolean
          match_id: string
          target?: number | null
        }
        Update: Partial<Database["public"]["Tables"]["innings"]["Insert"]>
        Relationships: []
      }
      match_players: {
        Row: {
          batting_order: number | null
          match_id: string
          player_id: string
          team_id: string
        }
        Insert: {
          batting_order?: number | null
          match_id: string
          player_id: string
          team_id: string
        }
        Update: Partial<Database["public"]["Tables"]["match_players"]["Insert"]>
        Relationships: []
      }
      matches: {
        Row: {
          block_consecutive_overs: boolean
          completed_at: string | null
          created_at: string
          free_hit_enabled: boolean
          id: string
          is_tie: boolean
          last_man_stands: boolean
          match_date: string
          name: string | null
          overs: number
          potm_player_id: string | null
          result_text: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          super_over_overs: number
          team_a_id: string | null
          team_b_id: string | null
          toss_decision: Database["public"]["Enums"]["toss_decision"] | null
          toss_winner_team_id: string | null
          venue: string | null
          winner_team_id: string | null
        }
        Insert: {
          block_consecutive_overs?: boolean
          completed_at?: string | null
          created_at?: string
          free_hit_enabled?: boolean
          id?: string
          is_tie?: boolean
          last_man_stands?: boolean
          match_date?: string
          name?: string | null
          overs?: number
          potm_player_id?: string | null
          result_text?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          super_over_overs?: number
          team_a_id?: string | null
          team_b_id?: string | null
          toss_decision?: Database["public"]["Enums"]["toss_decision"] | null
          toss_winner_team_id?: string | null
          venue?: string | null
          winner_team_id?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["matches"]["Insert"]>
        Relationships: []
      }
      players: {
        Row: {
          batting_style: Database["public"]["Enums"]["batting_hand"] | null
          bowling_style: string | null
          created_at: string
          edit_password: string
          id: string
          jersey_number: number | null
          name: string
          nickname: string | null
          photo_url: string | null
          status: Database["public"]["Enums"]["player_status"]
        }
        Insert: {
          batting_style?: Database["public"]["Enums"]["batting_hand"] | null
          bowling_style?: string | null
          created_at?: string
          edit_password?: string
          id?: string
          jersey_number?: number | null
          name: string
          nickname?: string | null
          photo_url?: string | null
          status?: Database["public"]["Enums"]["player_status"]
        }
        Update: Partial<Database["public"]["Tables"]["players"]["Insert"]>
        Relationships: []
      }
      teams: {
        Row: {
          color: string | null
          created_at: string
          hidden: boolean
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          hidden?: boolean
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: Partial<Database["public"]["Tables"]["teams"]["Insert"]>
        Relationships: []
      }
      team_players: {
        Row: {
          created_at: string
          player_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          player_id: string
          team_id: string
        }
        Update: Partial<Database["public"]["Tables"]["team_players"]["Insert"]>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: {
      batting_event_type:
        | "in"
        | "retired_not_out"
        | "retired_out"
        | "swap_strike"
      batting_hand: "right" | "left"
      extra_type: "none" | "wide" | "no_ball" | "bye" | "leg_bye"
      match_status:
        | "setup"
        | "live"
        | "innings_break"
        | "super_over"
        | "completed"
        | "abandoned"
      player_status: "pending" | "approved" | "rejected" | "hidden"
      toss_decision: "bat" | "bowl"
      wicket_type:
        | "bowled"
        | "caught"
        | "lbw"
        | "run_out"
        | "stumped"
        | "hit_wicket"
        | "caught_and_bowled"
        | "retired_out"
        | "obstructing"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]
export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T]
