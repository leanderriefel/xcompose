import type { IconName } from "./icons.js";

export type ProviderId = "openai" | "anthropic" | "openrouter" | "opencode" | "custom";

export type XComposeConfig = {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  prompts: Record<string, string>;
  enabled: string[];
};

export type ActionMeta = { id: string; label: string; icon: IconName; primary?: boolean };

export const ACTIONS: ActionMeta[] = [
  { id: "fix-grammar", label: "Fix", icon: "spell-check", primary: true },
  { id: "shorten", label: "Shorten", icon: "shrink", primary: true },
  { id: "punchier", label: "Punchier", icon: "bolt", primary: true },
  { id: "expand", label: "Expand", icon: "expand-paragraph" },
  { id: "formal", label: "Formal", icon: "briefcase" },
  { id: "casual", label: "Casual", icon: "smile" },
  { id: "emojify", label: "Emojify", icon: "sticker" },
];

export const DEFAULT_PROMPTS: Record<string, string> = {
  "fix-grammar":
    "Fix grammar, spelling and punctuation. Keep tone and meaning. Reply with the corrected text only.",
  shorten:
    "Make this more concise for X/Twitter, ideally under 280 characters. Reply with the result only.",
  punchier:
    "Make this more engaging for X/Twitter without changing the meaning. Reply with the result only.",
  expand:
    "Expand this slightly with more clarity. Keep it short enough for X/Twitter. Reply with the result only.",
  formal: "Rewrite in a professional tone. Reply with the result only.",
  casual: "Rewrite in a casual, friendly tone. Reply with the result only.",
  emojify: "Add 1-3 tasteful emojis. Reply with the result only.",
};

export const PROVIDERS: Record<
  ProviderId,
  { label: string; baseUrl: string; model: string; placeholder: string }
> = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5.6-luna",
    placeholder: "sk-…",
  },
  anthropic: {
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-haiku-4-5",
    placeholder: "sk-ant-…",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-5.6-luna",
    placeholder: "sk-or-…",
  },
  opencode: {
    label: "OpenCode",
    baseUrl: "https://api.opencode.ai/v1",
    model: "gpt-5.6-luna",
    placeholder: "key…",
  },
  custom: { label: "Custom", baseUrl: "", model: "gpt-5.6-luna", placeholder: "key…" },
};

const DEFAULTS: XComposeConfig = {
  provider: "openai",
  apiKey: "",
  baseUrl: "",
  model: "",
  prompts: DEFAULT_PROMPTS,
  enabled: ACTIONS.filter(a => a.primary).map(a => a.id),
};

export async function getConfig(): Promise<XComposeConfig> {
  const s = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const cfg = { ...DEFAULTS, ...s } as XComposeConfig;
  cfg.prompts = { ...DEFAULT_PROMPTS, ...((s.prompts as Record<string, string>) ?? {}) };
  cfg.enabled = Array.isArray(cfg.enabled) ? cfg.enabled : DEFAULTS.enabled;
  return cfg;
}

export async function setConfig(cfg: Partial<XComposeConfig>): Promise<void> {
  await chrome.storage.local.set(cfg);
}

export function modelOf(cfg: XComposeConfig): string {
  return cfg.model.trim() || PROVIDERS[cfg.provider].model;
}

export function baseUrlOf(cfg: XComposeConfig): string {
  return cfg.baseUrl.trim().replace(/\/$/, "") || PROVIDERS[cfg.provider].baseUrl;
}
