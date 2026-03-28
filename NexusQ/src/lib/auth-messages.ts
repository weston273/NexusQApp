function cleanMessage(message: string | null | undefined) {
  return typeof message === "string" ? message.trim() : "";
}

export function isGoogleProviderDisabledMessage(message: string | null | undefined) {
  const lower = cleanMessage(message).toLowerCase();
  return lower.includes("unsupported provider") || lower.includes("provider is not enabled");
}

export function formatSupabaseAuthErrorMessage(
  message: string | null | undefined,
  options?: {
    redirectTo?: string | null;
  }
) {
  const cleaned = cleanMessage(message);
  if (!cleaned) {
    return "Unable to continue with authentication.";
  }

  if (isGoogleProviderDisabledMessage(cleaned)) {
    const redirectTo = cleanMessage(options?.redirectTo);
    const redirectInstruction = redirectTo
      ? `Enable Google in Supabase Auth and add ${redirectTo} as an authorized redirect URL.`
      : "Enable Google in Supabase Auth and add this app's /auth/callback URL as an authorized redirect URL.";

    return `Google sign-in is not enabled for this Supabase project. ${redirectInstruction}`;
  }

  return cleaned;
}
