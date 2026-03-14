# NexusQ Frontend

React + Vite + TypeScript dashboard for workspace operations.

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run test:node
npm run lint
```

`npm run lint` runs:

1. `lint:types` (`tsc --noEmit`)
2. `lint:js` (ESLint)
3. `lint:css` (Stylelint)
4. `check:css-vars` (Tailwind CSS variable integrity)
5. `check:css-classes` (encoding artifact scan)

## Environment

Use `.env.local` for frontend values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AUTH_REDIRECT_URL` (optional)
- `VITE_PASSWORD_RESET_REDIRECT_URL` (optional)

Workflow webhooks are now invoked via Supabase Edge Function proxies (`workflow-a-proxy`, `workflow-d-proxy`, `workflow-e-proxy`), so browser-side webhook secrets are not required.
