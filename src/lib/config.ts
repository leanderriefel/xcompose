import type { IconName } from "./icons.js";

export type ProviderId = "openrouter" | "opencode-go";
type ProviderSettings = Record<ProviderId, { apiKey: string; model: string }>;

export type XComposeConfig = {
  provider: ProviderId;
  apiKey: string;
  model: string;
  providerSettings: ProviderSettings;
  generalPrompt: string;
  generalPromptSet: boolean;
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

export const DEFAULT_GENERAL_PROMPT =
  "Do not use em dashes or semicolons as punctuation unless they are clearly correct or explicitly wanted. Keep the resulting text close to the original, changing only what the requested action requires.";

export const PROVIDERS: Record<
  ProviderId,
  { label: string; baseUrl: string; model: string; placeholder: string }
> = {
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-5.6-luna",
    placeholder: "sk-or-…",
  },
  "opencode-go": {
    label: "OpenCode Go",
    baseUrl: "https://opencode.ai/zen/go/v1",
    model: "gpt-5.6-luna",
    placeholder: "OpenCode Go key…",
  },
};

const DEFAULTS: XComposeConfig = {
  provider: "opencode-go",
  apiKey: "",
  model: "",
  providerSettings: {
    openrouter: { apiKey: "", model: "" },
    "opencode-go": { apiKey: "", model: "" },
  },
  generalPrompt: DEFAULT_GENERAL_PROMPT,
  generalPromptSet: false,
  prompts: DEFAULT_PROMPTS,
  enabled: ACTIONS.filter(a => a.primary).map(a => a.id),
};

export async function getConfig(): Promise<XComposeConfig> {
  const s = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const cfg = { ...DEFAULTS, ...s } as XComposeConfig;
  if (s.provider === "opencode") {
    cfg.provider = "opencode-go";
  }
  if (!(cfg.provider in PROVIDERS)) {
    cfg.provider = DEFAULTS.provider;
    cfg.apiKey = "";
    cfg.model = "";
  }
  const storedSettings =
    s.providerSettings && typeof s.providerSettings === "object"
      ? (s.providerSettings as Partial<ProviderSettings>)
      : undefined;
  cfg.providerSettings = {
    openrouter: {
      apiKey:
        typeof storedSettings?.openrouter?.apiKey === "string"
          ? storedSettings.openrouter.apiKey
          : "",
      model:
        typeof storedSettings?.openrouter?.model === "string"
          ? storedSettings.openrouter.model
          : "",
    },
    "opencode-go": {
      apiKey:
        typeof storedSettings?.["opencode-go"]?.apiKey === "string"
          ? storedSettings["opencode-go"].apiKey
          : "",
      model:
        typeof storedSettings?.["opencode-go"]?.model === "string"
          ? storedSettings["opencode-go"].model
          : "",
    },
  };
  if (!storedSettings) {
    cfg.providerSettings[cfg.provider] = { apiKey: cfg.apiKey, model: cfg.model };
  }
  const activeSettings = cfg.providerSettings[cfg.provider];
  cfg.apiKey = activeSettings.apiKey;
  cfg.model = activeSettings.model;
  cfg.generalPromptSet =
    s.generalPromptSet === true ||
    (typeof s.generalPrompt === "string" && s.generalPrompt.length > 0);
  cfg.generalPrompt = cfg.generalPromptSet
    ? typeof s.generalPrompt === "string"
      ? s.generalPrompt
      : ""
    : DEFAULT_GENERAL_PROMPT;
  cfg.prompts = {
    ...DEFAULT_PROMPTS,
    ...(s.prompts && typeof s.prompts === "object" ? (s.prompts as Record<string, string>) : {}),
  };
  const actionIds = new Set(ACTIONS.map(action => action.id));
  cfg.enabled = Array.isArray(cfg.enabled)
    ? [...new Set(cfg.enabled.filter(id => typeof id === "string" && actionIds.has(id)))]
    : DEFAULTS.enabled;
  return cfg;
}

export async function setConfig(cfg: Partial<XComposeConfig>): Promise<void> {
  await chrome.storage.local.set(cfg);
}

export function modelOf(cfg: XComposeConfig): string {
  return cfg.model.trim() || PROVIDERS[cfg.provider].model;
}
