import { BaseEntity } from '@/types/entity.types';

export interface ActivityEvent extends BaseEntity {
  entityType: 'event';
  actionType:
    | 'completed_practice'
    | 'published_pack'
    | 'joined_club'
    | 'reached_pb'
    | 'earned_badge'
    | 'commented_replay'
    | 'shared_replay';
  actorId: string;
  actorUsername: string;
  targetEntityId?: string;
  summary: string;
}

export class ActivityStreamEngine {
  private static activities: ActivityEvent[] = [];

  public static publishEvent(event: Omit<ActivityEvent, 'id' | 'entityType' | 'version' | 'createdAt' | 'updatedAt'>): ActivityEvent {
    const fullEvent: ActivityEvent = {
      ...event,
      id: `act_${Math.random().toString(36).substring(7)}`,
      entityType: 'event',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.activities.unshift(fullEvent);
    this.activities = this.activities.slice(0, 500); // Keep last 500 events
    return fullEvent;
  }

  public static getFeed(filter?: { ownerId?: string; actionType?: string; limit?: number }): ActivityEvent[] {
    let result = [...this.activities];
    if (filter?.ownerId) {
      result = result.filter((a) => a.ownerId === filter.ownerId);
    }
    if (filter?.actionType) {
      result = result.filter((a) => a.actionType === filter.actionType);
    }
    return result.slice(0, filter?.limit || 50);
  }
}
