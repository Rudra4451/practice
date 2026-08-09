# TyProX Sprint 0 Architecture Migration Guide

This guide details step-by-step instructions for adopting the Sprint 0 foundation across new and existing modules.

---

## 1. Using Design System Primitives
Replace raw `<button>` elements with `KeycapButton`:

```tsx
// ❌ Legacy direct HTML button
<button className="bg-orange-500 p-2 rounded">Start Test</button>

// ✅ TyProX KeycapButton Primitive
import { KeycapButton } from '@/design-system';

<KeycapButton variant="accent" size="md" onClick={handleStart}>
  Start Test
</KeycapButton>
```

---

## 2. Using Repositories Instead of Direct SDK Calls
Replace inline Supabase query calls with type-safe repositories:

```tsx
// ❌ Legacy direct Supabase query
const { data } = await supabase.from('profiles').select('*').eq('id', userId);

// ✅ TyProX Repository Pattern
import { ProfilesRepository } from '@/infrastructure/repositories/profiles.repository';

const profile = await ProfilesRepository.getById(userId);
```

---

## 3. Registering Plugins
Register new feature extensions with the Plugin Manager:

```tsx
import { pluginManager } from '@/infrastructure/plugins/plugin-manager';

pluginManager.register({
  id: 'my-extension',
  name: 'My Extension',
  version: '1.0.0',
  onKeystroke: (event) => {
    // React to keystrokes safely
  },
});
```

---

## 4. Toggling the Development Debug Overlay
Press `Ctrl + Shift + D` in any environment to inspect live frame rates, input latency, Web Worker execution time, JS heap usage, and database query latencies.
