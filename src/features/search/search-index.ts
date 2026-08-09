import { BaseEntity, EntityType } from '@/types/entity.types';

export type SearchResultType = EntityType | 'command' | 'navigation';

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  type: SearchResultType;
  url?: string;
  action?: () => void;
  tags?: string[];
}

export class SearchIndexEngine {
  private static searchIndex: SearchResultItem[] = [
    { id: 'cmd_focus', title: 'Enter Focus Mode', subtitle: 'Start instant typing test', type: 'command', url: '/typing', tags: ['focus', 'start', 'test'] },
    { id: 'cmd_dashboard', title: 'Open Dashboard', subtitle: 'View performance analytics & DNA', type: 'navigation', url: '/dashboard', tags: ['dashboard', 'stats'] },
    { id: 'cmd_leaderboard', title: 'View Global Leaderboard', subtitle: 'Check Grandmaster rankings', type: 'navigation', url: '/leaderboard', tags: ['ranks', 'leaderboard'] },
    { id: 'cmd_theme', title: 'Toggle Light / Dark Theme', subtitle: 'Switch visual interface theme', type: 'command', tags: ['theme', 'dark', 'light'] },
  ];

  public static registerEntity(entity: BaseEntity, title: string, subtitle?: string, url?: string): void {
    const item: SearchResultItem = {
      id: entity.id,
      title,
      subtitle: subtitle || entity.entityType,
      type: entity.entityType,
      url,
      tags: entity.tags || [],
    };
    this.searchIndex = this.searchIndex.filter((i) => i.id !== entity.id);
    this.searchIndex.push(item);
  }

  public static query(term: string): SearchResultItem[] {
    if (!term || term.trim() === '') return this.searchIndex.slice(0, 8);

    const q = term.toLowerCase().trim();
    return this.searchIndex.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle?.toLowerCase().includes(q) ||
        item.tags?.some((t) => t.toLowerCase().includes(q))
    ).slice(0, 10);
  }
}
