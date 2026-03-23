/// <reference types="vite/client" />

declare module '*.css'

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_AUTH_REDIRECT_URL?: string;
  readonly VITE_PASSWORD_RESET_REDIRECT_URL?: string;
  readonly VITE_WORKFLOW_A_DEV_FALLBACK_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
