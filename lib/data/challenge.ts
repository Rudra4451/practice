import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import {
  normalizeBracketDuration,
  type RankedMode,
  type ValidDuration,
} from '@/lib/typing/metrics';

export interface ChallengeLinkDetails {
  id: string;
  creator_id: string | null;
  creator_wpm: number | null;
  creator_accuracy: number | null;
  mode: RankedMode;
  duration: ValidDuration;
  seed: string;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

const VALID_RANKED_MODES = new Set<RankedMode>([
  'words',
  'quotes',
  'numbers',
  'punctuation',
  'code',
]);

export const getActiveChallengeById = cache(
  async (id: string): Promise<ChallengeLinkDetails | null> => {
    const cleanId = id.trim();
    if (!cleanId) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('challenge_links')
      .select('id, creator_id, creator_wpm, creator_accuracy, mode, duration, seed, profiles(username, display_name, avatar_url)')
      .eq('id', cleanId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const joinedProfile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
    const mode = VALID_RANKED_MODES.has(data.mode as RankedMode)
      ? (data.mode as RankedMode)
      : 'words';

    return {
      id: data.id,
      creator_id: data.creator_id,
      creator_wpm: data.creator_wpm,
      creator_accuracy: data.creator_accuracy,
      mode,
      duration: normalizeBracketDuration(data.duration),
      seed: data.seed,
      profiles: joinedProfile
        ? {
            username: joinedProfile.username,
            display_name: joinedProfile.display_name,
            avatar_url: joinedProfile.avatar_url,
          }
        : null,
    };
  }
);

