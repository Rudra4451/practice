// TyProX BaseEntity Architecture System Types (Revision 1 & ADR-023)

export type EntityType =
  | 'user'
  | 'profile'
  | 'session'
  | 'replay'
  | 'text_pack'
  | 'challenge'
  | 'club'
  | 'achievement'
  | 'badge'
  | 'drill'
  | 'event'
  | 'notification';

export interface BaseEntity {
  id: string;             // Unique UUID
  entityType: EntityType; // Discriminator type
  version: number;        // Integer version
  ownerId: string;        // Owner User UUID
  createdAt: string;      // ISO timestamp
  updatedAt: string;      // ISO timestamp
  visibility: 'public' | 'private' | 'unlisted';
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canFork: boolean;
  };
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface UserEntity extends BaseEntity {
  entityType: 'user';
  email: string;
}

export interface ProfileEntity extends BaseEntity {
  entityType: 'profile';
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  tprRating: number;
  reputationScore: number;
  equipment: {
    keyboard: string;
    switches: string;
    layout: string;
  };
}

export interface TextPackEntity extends BaseEntity {
  entityType: 'text_pack';
  title: string;
  description: string;
  category: 'english' | 'code' | 'symbols' | 'exam' | 'custom';
  content: string;
  packVersion: string; // e.g. "1.0.0"
  status: 'draft' | 'published' | 'deprecated' | 'archived';
  parentResourceId?: string;
  forkCount: number;
  ratingAvg: number;
  downloadCount: number;
}

export interface ChallengeEntity extends BaseEntity {
  entityType: 'challenge';
  title: string;
  challengeType: 'beat_best' | 'accuracy_sprint' | 'no_backspace' | 'weak_finger' | 'code' | 'endurance';
  rotation: 'daily' | 'weekly' | 'monthly' | 'custom';
  seed: string;
  mode: string;
  duration: number;
}

export interface ClubEntity extends BaseEntity {
  entityType: 'club';
  name: string;
  description: string;
  category: 'developer' | 'writer' | 'medical' | 'student' | 'competitive' | 'custom';
  memberCount: number;
}
