# TyProX Feature-First Folder Structure Blueprint

```
c:\Users\rudra\practice\
├── docs/                     # System Documentation & ADRs
│   ├── adr/                  # ADR-001 to ADR-007
│   ├── Architecture.md
│   ├── FolderStructure.md
│   ├── CodingStandards.md
│   ├── ComponentCatalog.md
│   ├── TelemetryOverview.md
│   ├── DecisionLog.md
│   └── MigrationGuide.md
├── src/                      # Source Root
│   ├── app/                  # Next.js App Router (v1 API & pages)
│   ├── design-system/        # Mechanical Keycap Tokens & Primitives
│   │   ├── tokens/           # Color, typography, spacing, motion tokens
│   │   └── primitives/       # KeycapButton, KeycapCard, Panel, BlueprintGrid, etc.
│   ├── components/           # Universal Primitive Components
│   ├── features/             # Feature Modules (typing-engine, analytics, companion)
│   ├── telemetry/            # Core Math (5 Attributes, Typing DNA, Serializers)
│   ├── infrastructure/       # Repositories, Worker Manager, Plugins, Recovery, Metrics
│   │   ├── api-client/       # Versioned API Clients
│   │   ├── logger/           # Structured Logging
│   │   ├── metrics/          # Performance Instrumentation Debug Overlay
│   │   ├── plugins/          # Plugin Contract Framework
│   │   ├── recovery/         # Subsystem Degradation Recovery
│   │   ├── repositories/     # Profiles, TestResults, Replays Repositories
│   │   ├── supabase/         # Supabase Clients & Middleware
│   │   └── worker-manager/   # Web Worker Lifecycle Manager
│   ├── providers/            # React Context Providers (Theme, Performance)
│   ├── stores/               # Zustand Client Stores (TypingStore, UserStore, ToastStore)
│   ├── types/                # Domain TypeScript Types
│   └── workers/              # Pure Web Worker Scripts (analytics.worker.ts)
└── supabase/                 # PostgreSQL Database Migrations
```
