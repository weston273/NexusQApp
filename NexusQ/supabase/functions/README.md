# NexusQ Access Key Edge Functions

This folder contains secure server-side creation and revocation logic for workspace access keys.

## Key normalization rule

- Trim leading/trailing whitespace.
- Force uppercase.
- Keep dashes.

Frontend claim flow uses the same normalization rule before calling `public.claim_client_access(raw_key)`.

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

## Required Function Secrets

Set in Supabase project secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Deploy

```bash
supabase functions deploy create-access-key
supabase functions deploy revoke-access-key
```

If running locally:

```bash
supabase functions serve --env-file supabase/functions/.env.local
```
