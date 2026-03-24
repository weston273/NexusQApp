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
- `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be real project values in `.env.local`, not the example placeholders from `.env.example`.

If browser push is enabled, `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` must be the same public VAPID key configured in the Supabase Edge Function secrets as `WEB_PUSH_VAPID_PUBLIC_KEY`.

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
2. If the account has no operator phone number on file, the frontend routes to `/complete-profile` before workspace access is restored.
3. If the account has no active workspace access, the frontend routes to `/link-workspace`.
4. The user either:
   - creates a workspace through `workspace-bootstrap` with the `create_workspace` action, or
   - joins a workspace through `workspace-bootstrap` with the `join_workspace` action.
5. The frontend refreshes `user_access`, stores the active workspace `client_id`, and enters the main shell.

## Deployment Notes

- Vercel SPA rewrites are configured in [vercel.json](./vercel.json).
- Netlify/static SPA rewrites are configured in [public/_redirects](./public/_redirects).
- `dist/` is generated build output and is no longer intended to be tracked in git.
- Deploy from source and let the host run `npm install` + `npm run build`.
- Set the same frontend env vars in your deployment platform that you use locally.

## Supabase And Function Secrets

Frontend env values belong in `.env.local` or your deployment provider's frontend env settings.

Supabase edge-function secrets belong in the Supabase project, not the frontend. See [supabase/functions/README.md](./supabase/functions/README.md) for the current function secret list and deploy commands.

Browser push key placement:

- Frontend: `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` in `.env.local` and in your deployment platform's frontend env settings
- Supabase secrets: `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_VAPID_SUBJECT`

## Multi-Client Rollout

The current repo includes a tenant-hardening migration and updated edge functions for the multi-client rollout.

After importing the updated n8n workflow JSONs, run:

```bash
npm run tenant:rollout
```

Or run the steps individually:

```bash
npm run tenant:push:migrations
npm run tenant:deploy:functions
```

Notes:

- The rollout expects the linked Supabase project in `supabase/.temp/project-ref`.
- You must already be authenticated for the Supabase CLI on the machine running the command.
- Messaging and inbound reply routing are now tenant-safe, which means each client needs its own `clients.phone` value before those flows can run for multiple clients.
- Workflow A and Workflow E now depend on a real `clients.client_key` column. Apply database migrations before importing workflow revisions that select `client_key`.
- New workspaces now receive a generated `client_key` automatically through the database bootstrap path.
- Frontend lead intake is proxy-first again. A direct webhook fallback is only available in local development when `VITE_WORKFLOW_A_DEV_FALLBACK_URL` is set.
- Frontend health monitoring is proxy-only. Browser code now reaches Workflow E through `workflow-e-proxy` instead of direct webhook URLs.

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
