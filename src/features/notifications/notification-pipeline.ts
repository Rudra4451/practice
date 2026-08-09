import { BaseEntity } from '@/types/entity.types';

export interface NotificationEntity extends BaseEntity {
  entityType: 'notification';
  recipientId: string;
  title: string;
  message: string;
  read: boolean;
  linkUrl?: string;
}

export class NotificationPipeline {
  private static notifications: NotificationEntity[] = [];

  public static dispatch(
    recipientId: string,
    title: string,
    message: string,
    linkUrl?: string
  ): NotificationEntity {
    const notif: NotificationEntity = {
      id: `notif_${Math.random().toString(36).substring(7)}`,
      entityType: 'notification',
      version: 1,
      ownerId: recipientId,
      recipientId,
      title,
      message,
      read: false,
      linkUrl,
      visibility: 'private',
      permissions: { canEdit: false, canDelete: true, canFork: false },
      tags: ['notification'],
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.notifications.unshift(notif);
    return notif;
  }

  public static getForUser(userId: string): NotificationEntity[] {
    return this.notifications.filter((n) => n.recipientId === userId);
  }

  public static markAsRead(notificationId: string): void {
    const target = this.notifications.find((n) => n.id === notificationId);
    if (target) {
      target.read = true;
      target.updatedAt = new Date().toISOString();
    }
  }
}
