# NexusQ Frontend

NexusQ is the React + Vite + TypeScript frontend for a multi-tenant home-service revenue and operations platform. The frontend is the primary operator/admin UI. Supabase provides auth, tenancy, database access, realtime, and edge functions. n8n remains the workflow engine behind the workflow proxy functions.

## Runtime Architecture

- Frontend: React, TypeScript, Vite, Tailwind, shadcn/ui, Radix, Framer Motion, Recharts, dnd-kit.
- Supabase: Auth, Postgres, Realtime, Storage-free browser access, and edge functions.
- Edge-function entry points used by the frontend:
  - `workspace-bootstrap`
  - `create-access-key`
  - `revoke-access-key`
  - `workflow-a-proxy`
  - `workflow-d-proxy`
  - `workflow-e-proxy`
- n8n stays behind the Supabase proxy layer. Browser code does not call workflow webhooks directly.

## Requirements

- Node.js `>=20.19.0`
- npm `>=10`
- A Supabase project with the expected auth/database/functions setup

## Required Frontend Environment

Copy `.env.example` to `.env.local` and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional:

- `VITE_AUTH_REDIRECT_URL`
- `VITE_PASSWORD_RESET_REDIRECT_URL`

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be real project values in `.env.local`, not the example placeholders from `.env.example`.

NexusQ now validates frontend env values during startup. If required values are missing, invalid, or still set to placeholder examples, the app renders a startup failure screen instead of booting into a broken state.

## Local Development

```bash
npm install
npm run dev
```

Default Vite dev server settings:

- host: `0.0.0.0`
- port: `3000`
- strict port: enabled

## Validation Commands

```bash
npm run lint:types
npm run lint:js
npm run test:node
npm run build
```

Full pre-release verification:

```bash
npm run release:check
```

## Workspace Bootstrap Flow

1. User signs in with Supabase Auth.
2. If the account has no active workspace access, the frontend routes to `/link-workspace`.
3. The user either:
   - creates a workspace through `workspace-bootstrap` with the `create_workspace` action, or
   - joins a workspace through `workspace-bootstrap` with the `join_workspace` action.
4. The frontend refreshes `user_access`, stores the active workspace `client_id`, and enters the main shell.

## Deployment Notes

- Vercel SPA rewrites are configured in [vercel.json](./vercel.json).
- Netlify/static SPA rewrites are configured in [public/_redirects](./public/_redirects).
- `dist/` is generated build output and is no longer intended to be tracked in git.
- Deploy from source and let the host run `npm install` + `npm run build`.
- Set the same frontend env vars in your deployment platform that you use locally.

## Supabase And Function Secrets

Frontend env values belong in `.env.local` or your deployment provider's frontend env settings.

Supabase edge-function secrets belong in the Supabase project, not the frontend. See [supabase/functions/README.md](./supabase/functions/README.md) for the current function secret list and deploy commands.

## Production Safeguards Added

- Shared frontend env validation in `src/lib/config.ts`
- Startup failure screen for invalid or missing env
- Clearer auth/workspace retry states in route guards
- Centralized edge-function URL construction from validated config
- Release-check script for lint + tests + build

## Release Checklist

1. Confirm `.env.local` or deployment env values are correct.
2. Confirm Supabase edge-function secrets are set and current.
3. Run `npm run release:check`.
4. Run `npm audit` and confirm no unresolved production-impacting advisories remain.
5. Verify SPA rewrites for the selected host:
   - Vercel uses `vercel.json`
   - Netlify/static hosts use `public/_redirects`
6. Smoke-test:
   - login
   - signup
   - workspace create/join
   - dashboard
   - pipeline drag/drop
   - intake submit
   - notifications
   - health page
7. Deploy from source, not from a committed `dist/` snapshot.
