import { createClient } from '@/lib/supabase/client';

export interface ProfileRecord {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  theme: string;
  font_family: string;
  created_at: string;
}

export class ProfilesRepository {
  public static async getById(userId: string): Promise<ProfileRecord | null> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error || !data) return null;
      return data as ProfileRecord;
    } catch (err) {
      console.error('ProfilesRepository.getById error:', err);
      return null;
    }
  }

  public static async getByUsername(username: string): Promise<ProfileRecord | null> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username.toLowerCase())
        .single();
      if (error || !data) return null;
      return data as ProfileRecord;
    } catch (err) {
      console.error('ProfilesRepository.getByUsername error:', err);
      return null;
    }
  }

  public static async updateProfile(
    userId: string,
    updates: Partial<ProfileRecord>
  ): Promise<boolean> {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
      return !error;
    } catch (err) {
      console.error('ProfilesRepository.updateProfile error:', err);
      return false;
    }
  }
}
