function getOptionalEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getRequiredEnv(customName: string, fallbackName: string) {
  const customValue = getOptionalEnv(customName);
  if (customValue) return customValue;

  const fallbackValue = getOptionalEnv(fallbackName);
  if (fallbackValue) return fallbackValue;

  throw new Error(`Missing required env var: ${customName} or ${fallbackName}`);
}

export function getSupabaseUrl() {
  return getRequiredEnv("NEXUSQ_SUPABASE_URL", "SUPABASE_URL");
}

export function getSupabaseAnonKey() {
  return getRequiredEnv("NEXUSQ_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey() {
  return getRequiredEnv("NEXUSQ_SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");
}
