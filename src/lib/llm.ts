import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { DEFAULT_PROMPTS, PROVIDERS, modelOf, type XComposeConfig } from "./config.js";

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

export async function enhance(
  actionId: string,
  text: string,
  cfg: XComposeConfig
): Promise<string> {
  const prompt = cfg.prompts[actionId] ?? DEFAULT_PROMPTS[actionId];
  if (!prompt) throw new Error(`Unknown action: ${actionId}`);
  if (!cfg.apiKey.trim()) throw new Error("No API key set — open XCompose settings");
  const instructions = [cfg.generalPrompt.trim(), prompt].filter(Boolean).join("\n\n");
  const { text: out } = await generateText({
    model: modelFor(cfg),
    instructions,
    prompt: text,
  });
  const result = out.trim();
  if (!result) throw new Error("Empty response");
  return result;
}
