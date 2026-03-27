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
  - Tries Workflow D URLs from `WORKFLOW_D_URL` (preferred), then `WORKFLOW_D_WEBHOOK_URL`, then `WORKFLOW_D_FALLBACK_URL`, then the canonical `/webhook/pipeline-update` route.
  - Injects `x-nexusq-secret` server-side when `NEXUSQ_PIPELINE_SECRET` is configured.
  - Verifies that `pipeline.stage` and `leads.status` actually persisted before returning success.
  - Returns normalized JSON to frontend.

- `workflow-a-proxy`
  - Verifies caller auth token.
  - Requires `client_id` or `client_key`.
  - Resolves and validates tenant context server-side.
  - If both `client_id` and `client_key` are provided, they must refer to the same client.
  - Verifies caller has active workspace membership before forwarding.
  - Forwards canonical `client_id` and `client_key` to n8n.
  - Resolves Workflow A URL from `WORKFLOW_A_URL` (preferred), then `WORKFLOW_A_WEBHOOK_URL`, then `WORKFLOW_A_FALLBACK_URL`.
  - Injects `x-nexusq-secret` server-side when `NEXUSQ_WORKFLOW_A_SECRET` is configured.
  - Returns normalized JSON to frontend.

- `workflow-e-proxy`
  - Verifies caller auth token.
  - Requires `client_id` or `client_key`.
  - Resolves and validates tenant context server-side.
  - Verifies caller has active workspace membership before forwarding.
  - Resolves Workflow E URL from `WORKFLOW_E_STATUS_URL` (preferred), then `WORKFLOW_E_WEBHOOK_URL`, then `WORKFLOW_E_STATUS_FALLBACK_URL`.
  - Returns normalized JSON health payload to frontend.

- `workflow-f-agent`
  - Handles inbound Twilio SMS conversations for leads without relying on n8n runtime state.
  - Matches the lead by customer phone plus workspace sender phone for tenant-safe routing.
  - Initializes and loads business memory from `client_profiles`, `pricing_models`, `business_rules`, and `ai_behavior_config`.
  - Persists conversation memory in `lead_ai_sessions`.
  - Stores inbound and outbound SMS in `messages`.
  - If business context is incomplete, opens a `client_onboarding_sessions` flow and alerts operators instead of hallucinating.
  - Writes `reply_received`, `ai_message_sent`, `intent_detected`, `pricing_shared`, and `stage_updated` events to `lead_events`.
  - Reuses shared Workflow D update logic so AI-driven stage changes follow the same server-side persistence and fallback path as manual updates.
  - Falls back to a safe SMS reply if the AI request fails or times out.

- `client-ai-onboarding`
  - Verifies caller auth token.
  - Requires `owner/admin` access to the workspace.
  - Starts or continues the AI onboarding conversation for a client.
  - Uses OpenAI to extract business description, pricing, offers, ideal-customer fit, limitations, and tone from owner/admin responses.
  - Persists structured business memory into `client_profiles`, `pricing_models`, `business_rules`, `ai_behavior_config`, and `client_onboarding_sessions`.

- `delete-lead`
  - Verifies caller auth token.
  - Requires `lead_id`; optional `client_id` must match the resolved workspace.
  - Verifies caller has active `owner/admin` access to the lead workspace.
  - Calls `public.delete_lead_cascade(...)` server-side for atomic cleanup.
  - Deletes the lead plus pipeline, messages, lead events, and lead-linked notifications.

- `notification-preferences`
  - Verifies caller auth token.
  - Reads and updates the current user's operator delivery preferences in `user_profiles`.
  - Validates SMS phone numbers in E.164 format.
  - Refuses to enable SMS delivery without a saved phone number.

- `notification-subscriptions`
  - Verifies caller auth token.
  - Resolves tenant context from `client_id` or `client_key`.
  - Registers, inspects, and deletes browser push subscriptions per `user_id + client_id + endpoint`.
  - Stores subscription payloads in `notification_subscriptions`.

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
- `TWILIO_ACCOUNT_SID` (required for operator SMS delivery)
- `TWILIO_AUTH_TOKEN` (required for operator SMS delivery)
- `TWILIO_FROM_NUMBER` (required for operator SMS delivery)
- `OPENAI_API_KEY` (required for `workflow-f-agent`)
- `LLM_PROVIDER` (optional, set to `openrouter` to force OpenRouter)
- `OPENROUTER_API_KEYS` (optional comma-separated key pool for OpenRouter failover)
- `OPENROUTER_API_KEY_1` ... `OPENROUTER_API_KEY_10` (optional numbered OpenRouter key pool)
- `WEB_PUSH_VAPID_PUBLIC_KEY` (required for browser push delivery)
- `WEB_PUSH_VAPID_PRIVATE_KEY` (required for browser push delivery)
- `WEB_PUSH_VAPID_SUBJECT` (optional contact subject for web push)

## Deploy

```bash
supabase functions deploy create-access-key --no-verify-jwt
supabase functions deploy revoke-access-key --no-verify-jwt
supabase functions deploy workspace-bootstrap --no-verify-jwt
supabase functions deploy workflow-d-proxy --no-verify-jwt
supabase functions deploy workflow-a-proxy --no-verify-jwt
supabase functions deploy workflow-e-proxy --no-verify-jwt
supabase functions deploy workflow-f-agent --no-verify-jwt
supabase functions deploy client-ai-onboarding --no-verify-jwt
supabase functions deploy delete-lead --no-verify-jwt
supabase functions deploy notification-preferences --no-verify-jwt
supabase functions deploy notification-subscriptions --no-verify-jwt
```

If running locally:

```bash
supabase functions serve --env-file supabase/functions/.env.local
```

## Multi-client rollout order

Before importing workflow versions that query `clients.client_key`:

1. Apply the latest database migrations, including:
   - `20260320170000_multi_client_tenant_hardening.sql`
   - `20260321090000_client_key_bootstrap_contract.sql`
2. Deploy `workflow-a-proxy` and `workflow-e-proxy`.
3. Import the updated n8n workflow JSONs.

If step 1 is skipped, Workflow A will fail with `column clients.client_key does not exist`.
