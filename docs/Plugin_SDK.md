# TyProX Plugin SDK Reference

Developer guide for extending TyProX with custom plugins and dashboard widgets.

## Plugin Contract
```typescript
import { pluginManager, TyProXPlugin } from '@/infrastructure/plugins/plugin-manager';

export const MyCustomPlugin: TyProXPlugin = {
  id: 'my-custom-plugin',
  name: 'Custom Plugin',
  version: '1.0.0',
  onInit: (context) => console.log('Initialized', context),
  onKeystroke: (event) => console.log('Keystroke', event),
  onTestComplete: (result) => console.log('Complete', result),
};

// Register plugin
pluginManager.register(MyCustomPlugin);
```
