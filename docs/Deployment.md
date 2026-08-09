# TyProX Production Deployment Guide

Instructions for deploying TyProX to production environments:

## Deployment Prerequisites
- Next.js 16.2 Node.js runtime environment.
- Supabase PostgreSQL instance with migrations applied (`supabase/migrations/`).
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Build Verification Command
```bash
npm run build
```
Generates static pre-rendered routes and dynamic API serverless functions.
