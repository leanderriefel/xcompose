export type ProviderId = "openai" | "anthropic" | "openrouter" | "opencode" | "custom";

export interface ProviderMeta {
  label: string;
  baseUrl: string;
  model: string;
  keyPlaceholder: string;
}

export interface XComposeConfig {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  prompts: Record<string, string>;
  enabledActions: string[];
  httpReferer: string;
  appTitle: string;
}

export interface ActionMeta {
  id: string;
  label: string;
  icon: string;
  desc: string;
}

export type EnhanceRequest = {
  type: "XCOMPOSE_ENHANCE";
  actionId: string;
  text: string;
};

export type TestRequest = {
  type: "XCOMPOSE_TEST";
  cfg?: XComposeConfig;
};

export type GetConfigRequest = {
  type: "XCOMPOSE_GET_CONFIG";
};

export type XComposeMessage = EnhanceRequest | TestRequest | GetConfigRequest;

export type XComposeResponse =
  | { ok: true; result: string }
  | { ok: true; probe: string }
  | { ok: true; cfg: XComposeConfig }
  | { ok: false; error: string };
