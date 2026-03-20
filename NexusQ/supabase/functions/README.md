# NexusQ Access Key Edge Functions

This folder contains secure server-side logic for workspace access keys, onboarding bootstrap, and secure workflow proxying.

## Key normalization rule

- Trim leading/trailing whitespace.
- Force uppercase.
- Keep dashes.

Frontend workspace-linking flow uses the same normalization rule before calling the `workspace-bootstrap` edge function.

## Functions

- `create-access-key`
  - Verifies caller auth token.
  - Verifies caller has active `owner/admin` access to the target client.
  - Restricts owner-level key creation to current owners only.
  - Requires explicit owner-key confirmation and short-lived owner expiry.
  - Generates a cryptographically strong raw key.
  - Hashes key with SHA-256 (hex) and stores only `key_hash`.
  - Returns raw key once in response.

- `revoke-access-key`
  - Verifies caller auth token.
  - Verifies caller has active `owner/admin` access to key's client.
  - Enforces owner-only changes for owner-level keys.
  - Toggles `is_active`.

- `workspace-bootstrap`
  - Verifies caller auth token.
  - `create_workspace` action:
    - Calls SQL function `public.bootstrap_workspace_for_user(...)`.
    - Ensures `user_profiles` exists.
    - Creates a `clients` row.
    - Creates owner membership in `user_access`.
    - Optionally creates initial `client_access_keys` row (returns raw key once).
  - `join_workspace` action:
    - Calls SQL function `public.join_workspace_with_access_key(...)`.
    - Validates hashed key server-side.
    - Upserts membership in `user_access`.

- `workflow-d-proxy`
  - Verifies caller auth token.
  - Resolves lead context and verifies caller has active `user_access` to the lead client.
  - Resolves Workflow D URL from `WORKFLOW_D_URL` (preferred), then `WORKFLOW_D_WEBHOOK_URL`, then `WORKFLOW_D_FALLBACK_URL`.
  - Injects `x-nexusq-secret` server-side when `NEXUSQ_PIPELINE_SECRET` is configured.
  - Verifies that `pipeline.stage` and `leads.status` actually persisted before returning success.
  - Returns normalized JSON to frontend.

- `workflow-a-proxy`
  - Verifies caller auth token.
  - Optionally verifies workspace membership when `client_id` is provided.
  - Resolves Workflow A URL from `WORKFLOW_A_URL` (preferred), then `WORKFLOW_A_WEBHOOK_URL`, then `WORKFLOW_A_FALLBACK_URL`.
  - Injects `x-nexusq-secret` server-side when `NEXUSQ_WORKFLOW_A_SECRET` is configured.
  - Returns normalized JSON to frontend.

- `workflow-e-proxy`
  - Verifies caller auth token.
  - Optionally verifies workspace membership when `client_id` is provided.
  - Resolves Workflow E URL from `WORKFLOW_E_STATUS_URL` (preferred), then `WORKFLOW_E_WEBHOOK_URL`, then `WORKFLOW_E_STATUS_FALLBACK_URL`.
  - Returns normalized JSON health payload to frontend.

## Required Function Secrets

Set in Supabase project secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `WORKFLOW_D_URL` (recommended for `workflow-d-proxy`)
- `WORKFLOW_A_URL` (recommended for `workflow-a-proxy`)
- `WORKFLOW_E_STATUS_URL` (recommended for `workflow-e-proxy`)

Optional:

- `WORKFLOW_D_WEBHOOK_URL` (legacy alias fallback)
- `WORKFLOW_D_FALLBACK_URL` (optional fallback)
- `WORKFLOW_A_WEBHOOK_URL` (legacy alias fallback)
- `WORKFLOW_A_FALLBACK_URL` (optional fallback)
- `WORKFLOW_E_WEBHOOK_URL` (legacy alias fallback)
- `WORKFLOW_E_STATUS_FALLBACK_URL` (optional fallback)
- `NEXUSQ_PIPELINE_SECRET` (if set, proxy sends `x-nexusq-secret`)
- `NEXUSQ_WORKFLOW_A_SECRET` (if set, proxy sends `x-nexusq-secret`)

## Deploy

```bash
supabase functions deploy create-access-key
supabase functions deploy revoke-access-key
supabase functions deploy workspace-bootstrap
supabase functions deploy workflow-d-proxy
supabase functions deploy workflow-a-proxy
supabase functions deploy workflow-e-proxy
```

If running locally:

```bash
supabase functions serve --env-file supabase/functions/.env.local
```
