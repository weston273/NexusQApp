function getOptionalEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractChoiceContent(choice: Record<string, unknown> | null) {
  const message = asRecord(choice?.message);
  const direct = pickString(message?.content);
  if (direct) return direct;

  const content = message?.content;
  if (Array.isArray(content)) {
    const fragments = content
      .map((item) => {
        const record = asRecord(item);
        return pickString(record?.text, asRecord(record?.text)?.value);
      })
      .filter((value): value is string => Boolean(value));
    if (fragments.length) return fragments.join("\n");
  }

  return null;
}

function getProvider() {
  return (getOptionalEnv("LLM_PROVIDER") ?? getOptionalEnv("AI_PROVIDER") ?? "").toLowerCase().trim();
}

function getOpenAiApiKey() {
  return getOptionalEnv("OPENAI_API_KEY") ?? getOptionalEnv("NEXUSQ_OPENAI_API_KEY");
}

function getOpenRouterKeys() {
  const inline = (getOptionalEnv("OPENROUTER_API_KEYS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const numbered = Array.from({ length: 10 }, (_, index) => {
    const ordinal = index + 1;
    return (
      getOptionalEnv(`OPENROUTER_API_KEY_${ordinal}`) ??
      getOptionalEnv(`NEXUSQ_OPENROUTER_API_KEY_${ordinal}`) ??
      null
    );
  }).filter((value): value is string => Boolean(value));

  return Array.from(new Set([...inline, ...numbered]));
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenAiResponses<T>(args: {
  apiKey: string;
  model: string;
  systemText: string;
  userInput: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
}): Promise<T> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: args.systemText }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: JSON.stringify(args.userInput, null, 2) }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: args.schemaName,
          strict: true,
          schema: args.schema,
        },
      },
      max_output_tokens: args.maxOutputTokens,
    }),
  });

  const text = (await response.text()).trim();
  let payload: Record<string, unknown> = {};
  if (text) {
    payload = JSON.parse(text) as Record<string, unknown>;
  }

  if (!response.ok) {
    throw new Error(
      pickString(payload.error, asRecord(payload.error)?.message) ??
        `OpenAI request failed with HTTP ${response.status}.`
    );
  }

  const outputText = pickString(payload.output_text);
  if (!outputText) {
    throw new Error("OpenAI response did not include output_text.");
  }

  return JSON.parse(outputText) as T;
}

async function callOpenRouterChat<T>(args: {
  apiKeys: string[];
  model: string;
  systemText: string;
  userInput: unknown;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
}): Promise<T> {
  if (!args.apiKeys.length) {
    throw new Error("No OpenRouter API keys are configured.");
  }

  let lastError: string | null = null;

  for (const apiKey of args.apiKeys) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://nexusq.local",
          "X-Title": "NexusQ Workflow F",
        },
        body: JSON.stringify({
          model: args.model,
          temperature: 0.2,
          max_tokens: args.maxOutputTokens,
          messages: [
            {
              role: "system",
              content: [
                args.systemText,
                "Return only valid JSON.",
                `The response must match this JSON Schema exactly: ${JSON.stringify(args.schema)}`,
              ].join("\n"),
            },
            {
              role: "user",
              content: JSON.stringify(args.userInput, null, 2),
            },
          ],
        }),
      });

      const text = (await response.text()).trim();
      let payload: Record<string, unknown> = {};
      if (text) {
        payload = JSON.parse(text) as Record<string, unknown>;
      }

      if (!response.ok) {
        lastError =
          pickString(asRecord(payload.error)?.message, payload.message) ??
          `OpenRouter request failed with HTTP ${response.status}.`;
        if (response.status === 401 || response.status === 402 || response.status === 429 || response.status >= 500) {
          continue;
        }
        throw new Error(lastError);
      }

      const choices = Array.isArray(payload.choices) ? payload.choices : [];
      const finalText = extractChoiceContent(asRecord(choices[0]));
      if (!finalText) {
        throw new Error("OpenRouter response did not include message content.");
      }

      return JSON.parse(finalText) as T;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(lastError ?? "OpenRouter request failed.");
}

export async function generateStructuredResponse<T>(args: {
  model: string;
  systemText: string;
  userInput: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens?: number;
}): Promise<T> {
  const maxOutputTokens = args.maxOutputTokens ?? 500;
  const provider = getProvider();
  const openRouterKeys = getOpenRouterKeys();
  const useOpenRouter = provider === "openrouter" || (!provider && openRouterKeys.length > 0);

  let lastError: string | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (useOpenRouter) {
        return await callOpenRouterChat<T>({
          apiKeys: openRouterKeys,
          model: args.model,
          systemText: args.systemText,
          userInput: args.userInput,
          schema: args.schema,
          maxOutputTokens,
        });
      }

      const apiKey = getOpenAiApiKey();
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured.");
      }

      return await callOpenAiResponses<T>({
        apiKey,
        model: args.model,
        systemText: args.systemText,
        userInput: args.userInput,
        schemaName: args.schemaName,
        schema: args.schema,
        maxOutputTokens,
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < 2) {
        await sleep(300 * (attempt + 1));
        continue;
      }
    }
  }

  throw new Error(lastError ?? "LLM request failed.");
}
