import type { XComposeConfig } from "./types.js";
import { getDefaultPrompts, getEffectiveBaseUrl, getEffectiveModel } from "./storage.js";

export async function callLLM(params: {
  actionId: string;
  text: string;
  cfg: XComposeConfig;
}): Promise<string> {
  const { actionId, text, cfg } = params;
  const prompt =
    (cfg.prompts && cfg.prompts[actionId]) ||
    getDefaultPrompts()[actionId] ||
    "Improve this text. Return only result.";
  const model = getEffectiveModel(cfg);
  const baseUrl = getEffectiveBaseUrl(cfg);
  const temperature = typeof cfg.temperature === "number" ? cfg.temperature : 0.7;

  if (!cfg.apiKey || !cfg.apiKey.trim()) {
    throw new Error("No API key set. Open XCompose settings and add your key.");
  }
  if (!text || !text.trim()) throw new Error("Nothing to enhance — compose is empty.");
  if (text.trim().length < 2) throw new Error("Text too short.");

  const provider = cfg.provider;

  if (provider === "anthropic") {
    return await callAnthropic({ baseUrl, apiKey: cfg.apiKey, model, prompt, text, temperature });
  } else {
    return await callOpenAICompatible({
      baseUrl,
      apiKey: cfg.apiKey,
      model,
      prompt,
      text,
      temperature,
      provider,
      cfg,
    });
  }
}

async function callOpenAICompatible(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  text: string;
  temperature: number;
  provider: string;
  cfg: XComposeConfig;
}): Promise<string> {
  const { baseUrl, apiKey, model, prompt, text, temperature, provider, cfg } = params;
  if (!baseUrl) throw new Error("Base URL is required for Custom provider.");
  const url = baseUrl.replace(/\/$/, "") + "/chat/completions";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (provider === "openrouter") {
    if (cfg.httpReferer) headers["HTTP-Referer"] = cfg.httpReferer;
    if (cfg.appTitle) headers["X-Title"] = cfg.appTitle;
  }

  const body = {
    model,
    temperature,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: text },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(raw) as unknown;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const j = json as Record<string, unknown> | null;
    const errObj = j?.["error"] as Record<string, unknown> | string | undefined;
    const msg =
      (typeof errObj === "object" && errObj !== null
        ? (errObj["message"] as string | undefined)
        : typeof errObj === "string"
          ? errObj
          : undefined) ??
      (j?.["message"] as string | undefined) ??
      raw ??
      res.statusText;
    throw new Error(`API error (${res.status}): ${msg}`);
  }
  const j = json as { choices?: Array<{ message?: { content?: string } }> } | null;
  const out = j?.choices?.[0]?.message?.content;
  if (!out) throw new Error("Empty response from model.");
  return out.trim();
}

async function callAnthropic(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
  text: string;
  temperature: number;
}): Promise<string> {
  const { baseUrl, apiKey, model, prompt, text, temperature } = params;
  const url = (baseUrl || "https://api.anthropic.com/v1").replace(/\/$/, "") + "/messages";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature,
      system: prompt,
      messages: [{ role: "user", content: text }],
    }),
  });
  const raw = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(raw) as unknown;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const j = json as Record<string, unknown> | null;
    const errObj = j?.["error"] as Record<string, unknown> | string | undefined;
    const msg =
      (typeof errObj === "object" && errObj !== null
        ? (errObj["message"] as string | undefined)
        : typeof errObj === "string"
          ? errObj
          : undefined) ??
      (j?.["message"] as string | undefined) ??
      raw ??
      res.statusText;
    throw new Error(`Anthropic error (${res.status}): ${msg}`);
  }
  const j = json as { content?: Array<{ text?: string }> } | null;
  const out = j?.content?.[0]?.text;
  if (!out) throw new Error("Empty response from Anthropic.");
  return out.trim();
}
