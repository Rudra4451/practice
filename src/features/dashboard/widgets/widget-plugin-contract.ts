// TyProX Dashboard Widget Plugin Architecture Contract (Revision 7 & ADR-028)

export interface DashboardWidgetPlugin {
  id: string;
  title: string;
  defaultWidth?: 'full' | 'half' | 'third';
  defaultHeight?: number;

  register(): void;
  render(): React.ReactNode;
  refresh(): void;
  resize(width: 'full' | 'half' | 'third'): void;
  serialize(): Record<string, unknown>;
  deserialize(data: Record<string, unknown>): void;
}
