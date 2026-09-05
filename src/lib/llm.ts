import { z } from "zod";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { DEFAULT_PROMPTS, PROVIDERS, modelOf, type XComposeConfig } from "./config.js";

// Extension CSP forbids dynamic code generation; use Zod's interpreted validation.
z.config({ jitless: true });

function modelFor(cfg: XComposeConfig) {
  const key = cfg.apiKey.trim();
  const model = modelOf(cfg);
  if (cfg.provider === "openrouter")
    return createOpenRouter({ apiKey: key, baseURL: PROVIDERS.openrouter.baseUrl }).chat(model);

  const baseURL = PROVIDERS["opencode-go"].baseUrl;
  if (/^(gpt-|grok-|muse-)/.test(model))
    return createOpenAI({ apiKey: key, baseURL, name: cfg.provider }).responses(model);
  if (/^(minimax-|qwen)/.test(model)) return createAnthropic({ apiKey: key, baseURL })(model);
  return createOpenAICompatible({ apiKey: key, baseURL, name: cfg.provider }).chatModel(model);
}

const SESSION_KEY = "opencodeSessionId";

/**
 * Stable installation-scoped session id for OpenCode Go sticky routing.
 * OpenCode Go requires `x-opencode-session` (one stable ID per conversation);
 * our calls are single-shot, so one persisted ID keeps provider pinning and
 * prompt-cache hits. It must be sent per-request via `generateText({ headers })`.
 */
let sessionId: Promise<string> | undefined;

export function getGoSessionId(): Promise<string> {
  // Share the in-flight read/write as well as the result across concurrent calls.
  return (sessionId ??= loadGoSessionId());
}

async function loadGoSessionId(): Promise<string> {
  try {
    const stored = await chrome.storage.local.get(SESSION_KEY);
    const existing = stored[SESSION_KEY];
    if (typeof existing === "string" && existing.length > 0) return existing;
  } catch {
    // Storage unavailable (e.g. during tests) — fall through to ephemeral id.
  }
  const fresh = crypto.randomUUID();
  try {
    await chrome.storage.local.set({ [SESSION_KEY]: fresh });
  } catch {
    // Ignore persistence failures; the caller still gets a usable id.
  }
  return fresh;
}

export async function enhance(
  actionId: string,
  text: string,
  cfg: XComposeConfig,
  signal?: AbortSignal
): Promise<string> {
  const prompt = cfg.prompts[actionId] ?? DEFAULT_PROMPTS[actionId];
  if (!prompt) throw new Error(`Unknown action: ${actionId}`);
  if (!cfg.apiKey.trim()) throw new Error("No API key set — open XCompose settings");
  const instructions = [cfg.generalPrompt.trim(), prompt].filter(Boolean).join("\n\n");
  const headers =
    cfg.provider === "opencode-go" ? { "x-opencode-session": await getGoSessionId() } : undefined;
  const { text: out } = await generateText({
    model: modelFor(cfg),
    instructions,
    prompt: text,
    abortSignal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(60_000)])
      : AbortSignal.timeout(60_000),
    ...(headers ? { headers } : {}),
  });
  const result = out.trim();
  if (!result) throw new Error("Empty response");
  return result;
}
