// TyProX Plugin Architecture Contract Interface

export interface TyProXPluginContext {
  mode: string;
  duration: number;
  seed: string;
  wpm: number;
  accuracy: number;
}

export interface TyProXPlugin {
  id: string;
  name: string;
  version: string;
  description?: string;

  // Lifecycle Hooks
  onInit?: (context: TyProXPluginContext) => void;
  onKeystroke?: (event: { key: string; timestamp: number; isCorrect: boolean }) => void;
  onTestComplete?: (result: { wpm: number; accuracy: number; duration: number }) => void;
  onRender?: () => React.ReactNode | null;
  onTeardown?: () => void;
}
