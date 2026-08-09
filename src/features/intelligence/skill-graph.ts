import { KnowledgeGraph, SkillNodeKey, SkillGraphNode, SkillGraphEdge } from './types';

/**
 * 12-Node Directed Weighted Knowledge Graph Engine (ADR-010 & Revision 1)
 */
export class KnowledgeGraphEngine {
  public static createInitialGraph(): KnowledgeGraph {
    const nodes: Record<SkillNodeKey, SkillGraphNode> = {
      reaction: { key: 'reaction', label: 'Reaction Time', value: 75 },
      precision: { key: 'precision', label: 'Precision', value: 85 },
      consistency: { key: 'consistency', label: 'Consistency', value: 80 },
      rhythm: { key: 'rhythm', label: 'Rhythm Stability', value: 78 },
      acceleration: { key: 'acceleration', label: 'Acceleration', value: 70 },
      focus: { key: 'focus', label: 'Focus Stability', value: 82 },
      endurance: { key: 'endurance', label: 'Endurance', value: 75 },
      fingerIndependence: { key: 'fingerIndependence', label: 'Finger Independence', value: 72 },
      errorRecovery: { key: 'errorRecovery', label: 'Error Recovery', value: 76 },
      confidence: { key: 'confidence', label: 'Confidence Score', value: 80 },
      learningVelocity: { key: 'learningVelocity', label: 'Learning Velocity', value: 74 },
      speedCeiling: { key: 'speedCeiling', label: 'Speed Ceiling', value: 88 },
    };

    const edges: SkillGraphEdge[] = [
      { from: 'reaction', to: 'speedCeiling', weight: 0.84 },
      { from: 'reaction', to: 'confidence', weight: 0.22 },
      { from: 'precision', to: 'confidence', weight: 0.75 },
      { from: 'consistency', to: 'rhythm', weight: 0.88 },
      { from: 'consistency', to: 'learningVelocity', weight: 0.65 },
      { from: 'fingerIndependence', to: 'precision', weight: 0.70 },
      { from: 'rhythm', to: 'focus', weight: 0.60 },
      { from: 'errorRecovery', to: 'confidence', weight: 0.55 },
      { from: 'endurance', to: 'focus', weight: 0.68 },
      { from: 'learningVelocity', to: 'speedCeiling', weight: 0.80 },
    ];

    return { nodes, edges };
  }

  public static updateGraphWithSession(
    currentGraph: KnowledgeGraph,
    sessionStats: {
      reactionTimeMs: number;
      precision: number;
      consistency: number;
      rhythm: number;
      acceleration: number;
      fatigueDecayPercent: number;
    }
  ): KnowledgeGraph {
    const updated = JSON.parse(JSON.stringify(currentGraph)) as KnowledgeGraph;

    // Direct node updates
    updated.nodes.reaction.value = Math.max(0, Math.min(100, Math.round(100 - sessionStats.reactionTimeMs / 5)));
    updated.nodes.precision.value = Math.max(0, Math.min(100, Math.round(sessionStats.precision)));
    updated.nodes.consistency.value = Math.max(0, Math.min(100, Math.round(sessionStats.consistency)));
    updated.nodes.rhythm.value = Math.max(0, Math.min(100, Math.round(sessionStats.rhythm)));
    updated.nodes.endurance.value = Math.max(0, Math.min(100, Math.round(100 - sessionStats.fatigueDecayPercent * 2)));

    // Propagate weighted edge influences
    updated.edges.forEach((edge) => {
      const sourceVal = updated.nodes[edge.from].value;
      const targetVal = updated.nodes[edge.to].value;
      const delta = (sourceVal - targetVal) * edge.weight * 0.1;
      updated.nodes[edge.to].value = Math.max(0, Math.min(100, Math.round(targetVal + delta)));
    });

    return updated;
  }
}
