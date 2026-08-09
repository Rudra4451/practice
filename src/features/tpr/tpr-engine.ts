/**
 * TyProX Performance Rating (TPR) Engine (ADR-019)
 * Computes transparent, explainable skill rating (0 - 3000 TPR).
 */

export interface TPRInput {
  wpm: number;
  accuracy: number;
  consistency: number;
  rhythm: number;
  enduranceSecs: number;
  challengesCompleted: number;
}

export class TPREngine {
  public static calculateTPR(input: TPRInput): number {
    const wpmScore = input.wpm * 12; // e.g. 100 WPM -> 1200 pts
    const accMultiplier = Math.pow(input.accuracy / 100, 3); // Exponential penalty for low accuracy
    const consistencyScore = input.consistency * 3;
    const rhythmScore = input.rhythm * 2;
    const enduranceBonus = Math.min(200, input.enduranceSecs * 2);
    const challengeBonus = Math.min(300, input.challengesCompleted * 15);

    const baseTPR = (wpmScore + consistencyScore + rhythmScore + enduranceBonus + challengeBonus) * accMultiplier;
    return Math.max(0, Math.min(3000, Math.round(baseTPR)));
  }

  public static getTPRTier(tprScore: number): { name: string; color: string; minTPR: number } {
    if (tprScore >= 2400) return { name: 'Grandmaster', color: 'text-error bg-error/10 border-error/30', minTPR: 2400 };
    if (tprScore >= 2000) return { name: 'Master', color: 'text-accent bg-accent/10 border-accent/30', minTPR: 2000 };
    if (tprScore >= 1600) return { name: 'Diamond', color: 'text-accent-secondary bg-accent-secondary/10 border-accent-secondary/30', minTPR: 1600 };
    if (tprScore >= 1200) return { name: 'Platinum', color: 'text-text-primary bg-surface border-border', minTPR: 1200 };
    if (tprScore >= 800) return { name: 'Gold', color: 'text-warning bg-warning/10 border-warning/30', minTPR: 800 };
    if (tprScore >= 400) return { name: 'Silver', color: 'text-text-secondary bg-surface-accent border-border/40', minTPR: 400 };
    return { name: 'Bronze', color: 'text-text-tertiary bg-surface-accent border-border/20', minTPR: 0 };
  }
}
