# TyProX Documentation Index

## Core Project & Governance Documents

- [Project README](../README.md) — Product overview, setup, environment configuration, Supabase migrations, scripts, deployment, and ownership terms
- [Copyright & Ownership Notice](../COPYRIGHT.md) — Proprietary rights notice, repository visibility status, owner-approval gate, and third-party license inventory
- [OAuth Setup Guide](../OAUTH_SETUP.md) — Google & GitHub OAuth configuration with Supabase redirect allowlists
- [Security & Ownership Audit Report](./security/SECURITY_AND_OWNERSHIP.md) — Secrets/history scan, RLS & RPC lockdown, API protections, `npm audit`, and GitHub repository settings
- [Final Repository Cleanup Report](./roadmap/FINAL_REPOSITORY_CLEANUP_REPORT.md) — Complete repository inventory classification, cleanup delta, and release verification baseline

## Database & Verification Infrastructure

- [Migrations Directory](../supabase/migrations/) — Ordered production migrations (`20260618` -> `20260619` -> `20260620` -> `20260621` -> `20260622`)
- [Legacy Schema Reference](../supabase/reference/FULL_SCHEMA.sql) — Reference baseline snapshot (not executed directly as a migration)
- [PostgreSQL 16 Verification Harness](../tests/db/run-pg-verification.sh) — 3-scenario clean bootstrap, legacy upgrade, and idempotent drift check (`docker-compose.db.yml`, `tests/db/verify_migrations.sql`)

## Engineering History & Roadmaps (`docs/roadmap/`)

- [Decision Log](./roadmap/DECISION_LOG.md)
- [Master Roadmap](./roadmap/MASTER_ROADMAP.md)
- [Technical Implementation Plan](./roadmap/TECHNICAL_IMPLEMENTATION_PLAN.md)
- [Product Feature Specifications](./roadmap/PRODUCT_FEATURE_SPECIFICATIONS.md)
- [Design System Plan](./roadmap/DESIGN_SYSTEM_PLAN.md)
- [Security Remediation Plan](./roadmap/SECURITY_REMEDIATION_PLAN.md)
- [Testing & Acceptance Criteria](./roadmap/TESTING_AND_ACCEPTANCE_CRITERIA.md)
- [Testing Report](./roadmap/TESTING_REPORT.md)
- [Phase 1 Diff Review](./roadmap/PHASE_1_DIFF_REVIEW.md)
- [Post-Implementation Audit](./roadmap/POST_IMPLEMENTATION_AUDIT.md)
- [Batch 1.1A Preflight Report](./roadmap/BATCH_1_1A_PREFLIGHT_REPORT.md)
- [Phase 1B Independent Audit](./roadmap/PHASE_1B_INDEPENDENT_AUDIT.md) | [Phase 1B Remediation Report](./roadmap/PHASE_1B_REMEDIATION_REPORT.md)
- [Phase 1C Remediation Report](./roadmap/PHASE_1C_REMEDIATION_REPORT.md)
- [Phase 1D Database Readiness Report](./roadmap/PHASE_1D_DATABASE_READINESS_REPORT.md)
- [Phase 1E Verification Harness Report](./roadmap/PHASE_1E_VERIFICATION_HARNESS_REPORT.md)
- [Phase 1F GitHub CI Preparation](./roadmap/PHASE_1F_GITHUB_CI_PREPARATION.md)
- [Phase 1G Pre-Merge Review](./roadmap/PHASE_1G_PRE_MERGE_REVIEW.md) | [Phase 1H Remediation Report](./roadmap/PHASE_1H_REMEDIATION_REPORT.md)
- [Final Engineering Release Report (PR #3 Snapshot)](./roadmap/FINAL_ENGINEERING_RELEASE_REPORT.md)
- [Final Independent Release Review (PR #3 Snapshot)](./roadmap/FINAL_INDEPENDENT_RELEASE_REVIEW.md)
- [Implementation Status Checklist (PR #3 Snapshot)](./roadmap/IMPLEMENTATION_STATUS.md)

## Baseline Audits (`docs/audit/`)

- [Project Audit](./audit/PROJECT_AUDIT.md)
- [Security Review](./audit/SECURITY_REVIEW.md)
- [Feature Inventory](./audit/FEATURE_INVENTORY.md)
- [Technical Debt](./audit/TECHNICAL_DEBT.md)
- [UX Review](./audit/UX_REVIEW.md)

