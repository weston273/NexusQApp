type TwilioConfig = {
  accountSid: string;
  authToken: string;
};

function getOptionalEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function resolveTwilioConfig() {
  const accountSid =
    getOptionalEnv("TWILIO_ACCOUNT_SID") ?? getOptionalEnv("NEXUSQ_TWILIO_ACCOUNT_SID");
  const authToken =
    getOptionalEnv("TWILIO_AUTH_TOKEN") ?? getOptionalEnv("NEXUSQ_TWILIO_AUTH_TOKEN");

  if (!accountSid || !authToken) return null;
  return { accountSid, authToken } satisfies TwilioConfig;
}

export async function sendTwilioSms(args: {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  body: string;
}) {
  let lastError: string | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const form = new URLSearchParams({
      To: args.to,
      From: args.from,
      Body: args.body,
    });

    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(args.accountSid)}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${args.accountSid}:${args.authToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: form.toString(),
        }
      );

      const text = (await response.text()).trim();
      let payload: Record<string, unknown> | null = null;

      if (text) {
        try {
          payload = JSON.parse(text) as Record<string, unknown>;
        } catch {
          payload = { message: text };
        }
      }

      if (!response.ok) {
        lastError =
          (typeof payload?.message === "string" && payload.message) ||
          (typeof payload?.error_message === "string" && payload.error_message) ||
          `Twilio SMS failed with HTTP ${response.status}.`;

        if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
          continue;
        }

        throw new Error(lastError);
      }

      return payload ?? {};
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
        continue;
      }
    }
  }

  throw new Error(lastError ?? "Twilio SMS failed.");
}
