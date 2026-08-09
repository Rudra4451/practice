/**
 * TyProX Community Reputation Engine (Revision 4 & ADR-026)
 * Calculates social contribution reputation separate from TPR typing skill rating.
 */

export interface ReputationAction {
  type: 'publish_pack' | 'pack_upvote' | 'comment_replay' | 'create_challenge' | 'verified_contribution';
  points: number;
}

export class ReputationEngine {
  private static ACTION_POINTS: Record<string, number> = {
    publish_pack: 50,
    pack_upvote: 10,
    comment_replay: 5,
    create_challenge: 25,
    verified_contribution: 100,
  };

  public static calculateReputation(actions: ReputationAction[]): number {
    if (!actions || actions.length === 0) return 0;
    return actions.reduce((sum, act) => {
      const basePoints = this.ACTION_POINTS[act.type] || 5;
      return sum + basePoints;
    }, 0);
  }

  public static getReputationTier(reputationScore: number): { title: string; color: string } {
    if (reputationScore >= 1000) return { title: 'Legendary Contributor', color: 'text-accent font-bold' };
    if (reputationScore >= 500) return { title: 'Master Curator', color: 'text-accent-secondary font-bold' };
    if (reputationScore >= 200) return { title: 'Active Architect', color: 'text-success font-bold' };
    if (reputationScore >= 50) return { title: 'Community Member', color: 'text-text-primary font-bold' };
    return { title: 'Novice Contributor', color: 'text-text-tertiary' };
  }
}
