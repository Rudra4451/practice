import { createClient } from '@/lib/supabase/client';

export interface SaveTestResultParams {
  userId: string;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  errorCount: number;
  backspaceCount: number;
  mode: string;
  duration: number;
  seed: string;
}

export class TestResultsRepository {
  public static async saveResult(params: SaveTestResultParams): Promise<{ id: string } | null> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('test_results')
        .insert({
          user_id: params.userId,
          wpm: params.wpm,
          raw_wpm: params.rawWpm,
          accuracy: params.accuracy,
          consistency: params.consistency,
          error_count: params.errorCount,
          backspace_count: params.backspaceCount,
          mode: params.mode,
          duration: params.duration,
          seed: params.seed,
        })
        .select('id')
        .single();

      if (error || !data) {
        console.error('TestResultsRepository.saveResult error:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('TestResultsRepository.saveResult exception:', err);
      return null;
    }
  }

  public static async getUserHistory(userId: string, limit = 50): Promise<Record<string, unknown>[]> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('test_results')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error || !data) return [];
      return data;
    } catch (err) {
      console.error('TestResultsRepository.getUserHistory error:', err);
      return [];
    }
  }
}
