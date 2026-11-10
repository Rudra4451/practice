export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          theme: string;
          font_family: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          theme?: string;
          font_family?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          theme?: string;
          font_family?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      test_results: {
        Row: {
          id: string;
          user_id: string | null;
          wpm: number;
          raw_wpm: number;
          accuracy: number;
          consistency: number;
          error_count: number;
          backspace_count: number;
          mode: string;
          duration: number;
          seed: string;
          client_run_id?: string | null;
          generator_version?: number;
          is_ranked?: boolean;
          is_invalidated: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          wpm: number;
          raw_wpm: number;
          accuracy: number;
          consistency: number;
          error_count: number;
          backspace_count: number;
          mode: string;
          duration: number;
          seed: string;
          client_run_id?: string | null;
          generator_version?: number;
          is_ranked?: boolean;
          is_invalidated?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          wpm?: number;
          raw_wpm?: number;
          accuracy?: number;
          consistency?: number;
          error_count?: number;
          backspace_count?: number;
          mode?: string;
          duration?: number;
          seed?: string;
          client_run_id?: string | null;
          generator_version?: number;
          is_ranked?: boolean;
          is_invalidated?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'test_results_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      replays: {
        Row: {
          id: string;
          test_result_id: string;
          telemetry: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          test_result_id: string;
          telemetry: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          test_result_id?: string;
          telemetry?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'replays_test_result_id_fkey';
            columns: ['test_result_id'];
            isOneToOne: true;
            referencedRelation: 'test_results';
            referencedColumns: ['id'];
          }
        ];
      };
      streaks: {
        Row: {
          id: string;
          user_id: string;
          current_streak: number;
          longest_streak: number;
          last_active_date: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          current_streak?: number;
          longest_streak?: number;
          last_active_date?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          current_streak?: number;
          longest_streak?: number;
          last_active_date?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_challenges: {
        Row: {
          id: string;
          challenge_date: string;
          mode: string;
          duration: number;
          seed: string;
          text_content: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          challenge_date?: string;
          mode: string;
          duration: number;
          seed: string;
          text_content?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          challenge_date?: string;
          mode?: string;
          duration?: number;
          seed?: string;
          text_content?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      challenge_links: {
        Row: {
          id: string;
          creator_id: string | null;
          creator_wpm: number | null;
          creator_accuracy: number | null;
          mode: string;
          duration: number;
          seed: string;
          text_content: string | null;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          creator_id?: string | null;
          creator_wpm?: number | null;
          creator_accuracy?: number | null;
          mode: string;
          duration: number;
          seed: string;
          text_content?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string | null;
          creator_wpm?: number | null;
          creator_accuracy?: number | null;
          mode?: string;
          duration?: number;
          seed?: string;
          text_content?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'challenge_links_creator_id_fkey';
            columns: ['creator_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          }
        ];
      };
      user_challenge_progress: {
        Row: {
          id: string;
          user_id: string;
          challenge_id: string;
          test_result_id: string | null;
          completed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          challenge_id: string;
          test_result_id?: string | null;
          completed_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          challenge_id?: string;
          test_result_id?: string | null;
          completed_at?: string;
        };
        Relationships: [];
      };
      achievements: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string;
          criteria: Json;
          icon_path: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description: string;
          criteria: Json;
          icon_path: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string;
          criteria?: Json;
          icon_path?: string;
        };
        Relationships: [];
      };
      user_achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_id: string;
          unlocked_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          achievement_id: string;
          unlocked_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          achievement_id?: string;
          unlocked_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_achievements_achievement_id_fkey';
            columns: ['achievement_id'];
            isOneToOne: false;
            referencedRelation: 'achievements';
            referencedColumns: ['id'];
          }
        ];
      };
      user_progression: {
        Row: {
          user_id: string;
          total_xp: number;
          level: number;
          lessons_completed: number;
          daily_completed_count: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          total_xp?: number;
          level?: number;
          lessons_completed?: number;
          daily_completed_count?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          total_xp?: number;
          level?: number;
          lessons_completed?: number;
          daily_completed_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_lesson_progress: {
        Row: {
          id: string;
          user_id: string;
          lesson_slug: string;
          best_wpm: number;
          best_accuracy: number;
          stars: number;
          completed: boolean;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lesson_slug: string;
          best_wpm?: number;
          best_accuracy?: number;
          stars?: number;
          completed?: boolean;
          completed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          lesson_slug?: string;
          best_wpm?: number;
          best_accuracy?: number;
          stars?: number;
          completed?: boolean;
          completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      challenge_attempts: {
        Row: {
          id: string;
          challenge_id: string;
          challenger_id: string | null;
          test_result_id: string | null;
          wpm: number;
          accuracy: number;
          won: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          challenge_id: string;
          challenger_id?: string | null;
          test_result_id?: string | null;
          wpm: number;
          accuracy: number;
          won?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          challenge_id?: string;
          challenger_id?: string | null;
          test_result_id?: string | null;
          wpm?: number;
          accuracy?: number;
          won?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      leaderboard_view: {
        Row: {
          id: string;
          user_id: string | null;
          wpm: number;
          accuracy: number;
          consistency: number;
          mode: string;
          duration: number;
          is_invalidated: boolean;
          created_at: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      submit_verified_result: {
        Args: {
          p_user_id: string;
          p_wpm: number;
          p_raw_wpm: number;
          p_accuracy: number;
          p_consistency: number;
          p_error_count: number;
          p_backspace_count: number;
          p_mode: string;
          p_duration: number;
          p_seed: string;
          p_client_run_id: string | null;
          p_telemetry: Json;
          p_deduplicate_by_signature?: boolean;
        };
        Returns: Json;
      };
    };
  };
}

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type TestResultRow = Database['public']['Tables']['test_results']['Row'];
export type ReplayRow = Database['public']['Tables']['replays']['Row'];
export type StreakRow = Database['public']['Tables']['streaks']['Row'];
export type AchievementRow = Database['public']['Tables']['achievements']['Row'];
export type UserAchievementRow = Database['public']['Tables']['user_achievements']['Row'];
export type ChallengeLinkRow = Database['public']['Tables']['challenge_links']['Row'];
export type DailyChallengeRow = Database['public']['Tables']['daily_challenges']['Row'];
export type UserChallengeProgressRow = Database['public']['Tables']['user_challenge_progress']['Row'];
export type LeaderboardViewRow = Database['public']['Views']['leaderboard_view']['Row'];

