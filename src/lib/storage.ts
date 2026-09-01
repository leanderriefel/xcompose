import type { ProviderId, ProviderMeta, XComposeConfig } from "./types.js";

export const DEFAULT_PROMPTS: Record<string, string> = {
  "fix-grammar":
    "Fix grammar, spelling, and punctuation. Preserve tone and meaning. Return only the corrected text, no quotes, no explanation.",
  shorten:
    "Make this more concise and punchy for X/Twitter. Keep the core meaning. Aim under 280 characters if possible. Return only the result.",
  punchier:
    "Make this punchier, more engaging, and more viral for X/Twitter without changing meaning. Use strong verbs. Return only the result.",
  expand:
    "Expand this slightly with more clarity and nuance, still concise for X/Twitter. Return only the result.",
  formal: "Rewrite this in a more professional, formal tone for X/Twitter. Return only the result.",
  casual:
    "Rewrite this in a casual, friendly, conversational tone for X/Twitter. Return only the result.",
  emojify:
    "Add 1-3 relevant tasteful emojis to make this more expressive for X/Twitter. Don't overdo it. Return only the result.",
};

export const DEFAULTS: XComposeConfig = {
  provider: "openai",
  apiKey: "",
  baseUrl: "",
  model: "",
  temperature: 0.7,
  prompts: DEFAULT_PROMPTS,
  enabledActions: ["fix-grammar", "shorten", "punchier"],
  httpReferer: "",
  appTitle: "XCompose",
};

export const PROVIDER_META: Record<ProviderId, ProviderMeta> = {
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    keyPlaceholder: "sk-...",
  },
  anthropic: {
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-3-5-haiku-latest",
    keyPlaceholder: "sk-ant-...",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
    keyPlaceholder: "sk-or-...",
  },
  opencode: {
    label: "OpenCode / Zen",
    baseUrl: "https://api.opencode.ai/v1",
    model: "gpt-4o-mini",
    keyPlaceholder: "opencode_... or sk-...",
  },
  custom: {
    label: "Custom (OpenAI Compatible)",
    baseUrl: "",
    model: "gpt-4o-mini",
    keyPlaceholder: "sk-...",
  },
};

export async function getAll(): Promise<XComposeConfig> {
  const keys = Object.keys(DEFAULTS) as (keyof XComposeConfig)[];
  const stored = (await chrome.storage.local.get(keys)) as Partial<XComposeConfig>;
  const out: XComposeConfig = { ...DEFAULTS };
  for (const k of keys) {
    if (stored[k] !== undefined) {
      (out as unknown as Record<string, unknown>)[k] = stored[k];
    }
  }
  // deep merge prompts
  out.prompts = { ...DEFAULT_PROMPTS, ...(stored.prompts ?? {}) };
  return out;
}

export async function set(obj: Partial<XComposeConfig>): Promise<void> {
  await chrome.storage.local.set(obj as Record<string, unknown>);
}

export function getDefaultPrompts(): Record<string, string> {
  return { ...DEFAULT_PROMPTS };
}

export function getProviderMeta(provider: ProviderId): ProviderMeta {
  return PROVIDER_META[provider] ?? PROVIDER_META.custom;
}

export function getEffectiveModel(cfg: XComposeConfig): string {
  if (cfg.model && cfg.model.trim()) return cfg.model.trim();
  return getProviderMeta(cfg.provider).model;
}

export function getEffectiveBaseUrl(cfg: XComposeConfig): string {
  if (cfg.baseUrl && cfg.baseUrl.trim()) return cfg.baseUrl.trim().replace(/\/$/, "");
  return getProviderMeta(cfg.provider).baseUrl;
}
