import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { DEFAULT_PROMPTS, baseUrlOf, modelOf, type XComposeConfig } from "./config.js";

function modelFor(cfg: XComposeConfig) {
  const key = cfg.apiKey.trim();
  const model = modelOf(cfg);
  if (cfg.provider === "anthropic")
    return createAnthropic({ apiKey: key, baseURL: baseUrlOf(cfg) })(model);
  if (cfg.provider === "openrouter") return createOpenRouter({ apiKey: key }).chat(model);
  if (cfg.provider === "openai") return createOpenAI({ apiKey: key }).responses(model);
  return createOpenAI({ apiKey: key, baseURL: baseUrlOf(cfg), name: cfg.provider }).chat(model);
}

export async function enhance(
  actionId: string,
  text: string,
  cfg: XComposeConfig
): Promise<string> {
  const prompt = cfg.prompts[actionId] ?? DEFAULT_PROMPTS[actionId];
  if (!prompt) throw new Error(`Unknown action: ${actionId}`);
  if (!cfg.apiKey.trim()) throw new Error("No API key set — open XCompose settings");
  if (cfg.provider === "custom" && !baseUrlOf(cfg))
    throw new Error("Custom provider needs a Base URL");

  const { text: out } = await generateText({
    model: modelFor(cfg),
    instructions: prompt,
    prompt: text,
  });
  const result = out.trim();
  if (!result) throw new Error("Empty response");
  return result;
}
