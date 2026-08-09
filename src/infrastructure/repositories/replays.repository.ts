import { createClient } from '@/lib/supabase/client';

export class ReplaysRepository {
  public static async saveReplay(testResultId: string, telemetry: Record<string, unknown>[]): Promise<boolean> {
    try {
      const supabase = createClient();
      const { error } = await supabase.from('replays').insert({
        test_result_id: testResultId,
        telemetry,
      });
      return !error;
    } catch (err) {
      console.error('ReplaysRepository.saveReplay error:', err);
      return false;
    }
  }

  public static async getByTestId(testResultId: string): Promise<Record<string, unknown>[] | null> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('replays')
        .select('telemetry')
        .eq('test_result_id', testResultId)
        .single();
      if (error || !data) return null;
      return data.telemetry;
    } catch (err) {
      console.error('ReplaysRepository.getByTestId error:', err);
      return null;
    }
  }
}
