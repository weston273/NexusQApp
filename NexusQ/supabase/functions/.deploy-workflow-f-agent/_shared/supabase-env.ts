function getOptionalEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getRequiredEnv(primaryName: string, secondaryName: string) {
  const primaryValue = getOptionalEnv(primaryName);
  if (primaryValue) return primaryValue;

  const secondaryValue = getOptionalEnv(secondaryName);
  if (secondaryValue) return secondaryValue;

  throw new Error(`Missing required env var: ${primaryName} or ${secondaryName}`);
}

export function getSupabaseUrl() {
  return getRequiredEnv("SUPABASE_URL", "NEXUSQ_SUPABASE_URL");
}

export function getSupabaseAnonKey() {
  return getRequiredEnv("SUPABASE_ANON_KEY", "NEXUSQ_SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey() {
  return getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY", "NEXUSQ_SUPABASE_SERVICE_ROLE_KEY");
}
