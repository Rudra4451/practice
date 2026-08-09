import { TyProXPlugin, TyProXPluginContext } from './contract';

class PluginManager {
  private plugins: Map<string, TyProXPlugin> = new Map();

  public register(plugin: TyProXPlugin): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`Plugin with id "${plugin.id}" is already registered. Overwriting.`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  public unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin && plugin.onTeardown) {
      try {
        plugin.onTeardown();
      } catch (err) {
        console.error(`Error in plugin "${pluginId}" teardown:`, err);
      }
    }
    this.plugins.delete(pluginId);
  }

  public triggerInit(context: TyProXPluginContext): void {
    this.plugins.forEach((plugin) => {
      if (plugin.onInit) {
        try {
          plugin.onInit(context);
        } catch (err) {
          console.error(`Error in plugin "${plugin.id}" onInit:`, err);
        }
      }
    });
  }

  public triggerKeystroke(event: { key: string; timestamp: number; isCorrect: boolean }): void {
    this.plugins.forEach((plugin) => {
      if (plugin.onKeystroke) {
        try {
          plugin.onKeystroke(event);
        } catch (err) {
          console.error(`Error in plugin "${plugin.id}" onKeystroke:`, err);
        }
      }
    });
  }

  public triggerTestComplete(result: { wpm: number; accuracy: number; duration: number }): void {
    this.plugins.forEach((plugin) => {
      if (plugin.onTestComplete) {
        try {
          plugin.onTestComplete(result);
        } catch (err) {
          console.error(`Error in plugin "${plugin.id}" onTestComplete:`, err);
        }
      }
    });
  }

  public getRegisteredPlugins(): TyProXPlugin[] {
    return Array.from(this.plugins.values());
  }
}

export const pluginManager = new PluginManager();
