import { getAll, getDefaultPrompts, getProviderMeta, set as setStorage } from "./lib/storage.js";
import { ACTIONS } from "./lib/prompts.js";
import type { ProviderId, XComposeConfig } from "./lib/types.js";

const $ = <T extends Element>(s: string): T => document.querySelector(s) as T;

const els = {
  provider: $<HTMLSelectElement>("#provider"),
  providerHelp: $<HTMLElement>("#providerHelp"),
  model: $<HTMLInputElement>("#model"),
  modelList: $<HTMLDataListElement>("#modelList"),
  apiKey: $<HTMLInputElement>("#apiKey"),
  baseUrl: $<HTMLInputElement>("#baseUrl"),
  baseUrlRow: $<HTMLElement>("#baseUrlRow"),
  httpReferer: $<HTMLInputElement>("#httpReferer"),
  appTitle: $<HTMLInputElement>("#appTitle"),
  openrouterRow: $<HTMLElement>("#openrouterRow"),
  toggleKey: $<HTMLButtonElement>("#toggleKey"),
  testBtn: $<HTMLButtonElement>("#testBtn"),
  testStatus: $<HTMLElement>("#testStatus"),
  saveBtn: $<HTMLButtonElement>("#saveBtn"),
  saveBadge: $<HTMLElement>("#saveBadge"),
  promptsList: $<HTMLElement>("#promptsList"),
  resetPrompts: $<HTMLButtonElement>("#resetPrompts"),
  exportBtn: $<HTMLButtonElement>("#exportBtn"),
  importFile: $<HTMLInputElement>("#importFile"),
  resetAll: $<HTMLButtonElement>("#resetAll"),
  includeKey: $<HTMLInputElement>("#includeKey"),
  footVer: $<HTMLElement>("#footVer"),
};

const MODEL_SUGGESTIONS: Record<ProviderId, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "o4-mini"],
  anthropic: ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-sonnet-4-20250514"],
  openrouter: [
    "openai/gpt-4o-mini",
    "anthropic/claude-3.5-haiku",
    "google/gemini-2.0-flash-001",
    "meta-llama/llama-3.3-70b-instruct",
  ],
  opencode: ["gpt-4o-mini", "claude-3-5-sonnet-latest", "openai/gpt-4o-mini"],
  custom: ["gpt-4o-mini", "gpt-4o", "llama-3.3-70b"],
};

let current: XComposeConfig | null = null;
let saveTimer: number | undefined;

function providerHelpText(p: ProviderId): string {
  const map: Record<ProviderId, string> = {
    openai: "Uses https://api.openai.com/v1 — key starts sk-…",
    anthropic: "Uses https://api.anthropic.com/v1 — key starts sk-ant-…",
    openrouter:
      "Uses https://openrouter.ai/api/v1 — get a key at openrouter.ai. One key → 300+ models.",
    opencode:
      "OpenCode Zen / OpenCode Cloud — OpenAI-compatible. Paste your Zen key. Default base is https://api.opencode.ai/v1 (override if self-hosted).",
    custom: "Any OpenAI-compatible endpoint (LiteLLM, Ollama via proxy, vLLM, etc.). Set Base URL.",
  };
  return map[p] ?? "";
}

function updateModelDatalist(provider: ProviderId): void {
  const list = MODEL_SUGGESTIONS[provider] ?? MODEL_SUGGESTIONS.custom;
  els.modelList.innerHTML = "";
  for (const m of list) {
    const o = document.createElement("option");
    o.value = m;
    els.modelList.appendChild(o);
  }
}

function refreshProviderUI(): void {
  const p = els.provider.value as ProviderId;
  els.providerHelp.textContent = providerHelpText(p);
  updateModelDatalist(p);

  const meta = getProviderMeta(p);
  els.apiKey.placeholder = meta.keyPlaceholder || "sk-...";

  if (p === "custom") {
    els.baseUrlRow.style.display = "";
    els.baseUrl.placeholder = "https://api.example.com/v1";
  } else if (p === "opencode") {
    els.baseUrlRow.style.display = "";
    els.baseUrl.placeholder = `${meta.baseUrl}  (leave blank for default)`;
  } else {
    els.baseUrlRow.style.display = "";
    els.baseUrl.placeholder = `${meta.baseUrl}  (leave blank for default)`;
  }

  els.openrouterRow.style.display = p === "openrouter" ? "" : "none";
}

function buildPrompts(): void {
  if (!current) return;
  const cfg = current;
  els.promptsList.innerHTML = "";
  for (const a of ACTIONS) {
    const item = document.createElement("div");
    item.className = "prompt-item";
    item.dataset["id"] = a.id;
    const isPrimary = ["fix-grammar", "shorten", "punchier"].includes(a.id);
    if (isPrimary) item.classList.add("open");
    item.innerHTML = `
        <div class="prompt-head" role="button" tabindex="0" aria-expanded="${isPrimary ? "true" : "false"}">
          <span class="prompt-title"><span class="prompt-icon">${a.icon}</span> ${a.label} <span class="prompt-desc">${a.desc}</span></span>
          <span class="prompt-chevron">▾</span>
        </div>
        <div class="prompt-body">
          <textarea class="prompt-textarea" rows="2" spellcheck="false" data-prompt="${a.id}"></textarea>
        </div>
      `;
    const head = item.querySelector<HTMLElement>(".prompt-head")!;
    const ta = item.querySelector<HTMLTextAreaElement>("textarea")!;
    ta.value = (cfg.prompts && cfg.prompts[a.id]) || getDefaultPrompts()[a.id] || "";
    head.addEventListener("click", () => {
      const open = item.classList.toggle("open");
      head.setAttribute("aria-expanded", open ? "true" : "false");
    });
    head.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        head.click();
      }
    });
    ta.addEventListener("input", () => {
      if (!current) return;
      current.prompts[a.id] = ta.value;
      scheduleSave();
    });
    els.promptsList.appendChild(item);
  }
}

function collectForm(): Partial<XComposeConfig> {
  if (!current) throw new Error("not loaded");
  return {
    provider: els.provider.value as ProviderId,
    apiKey: els.apiKey.value.trim(),
    baseUrl: els.baseUrl.value.trim(),
    model: els.model.value.trim(),
    httpReferer: els.httpReferer.value.trim(),
    appTitle: els.appTitle.value.trim(),
    prompts: current.prompts,
  };
}

async function save(showBadge = true): Promise<void> {
  const data = collectForm();
  await setStorage(data);
  if (current) current = { ...current, ...data } as XComposeConfig;
  if (showBadge) flashSaved();
}

function flashSaved(): void {
  els.saveBadge.classList.add("show");
  clearTimeout((flashSaved as unknown as { _t?: number })._t);
  (flashSaved as unknown as { _t: number })._t = window.setTimeout(
    () => els.saveBadge.classList.remove("show"),
    1400
  );
}

function scheduleSave(): void {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void save(true);
  }, 450);
}

function setTestStatus(msg: string, kind: "info" | "ok" | "bad" = "info"): void {
  els.testStatus.textContent = msg;
  els.testStatus.className = `test-status ${kind}`;
}

async function testConnection(): Promise<void> {
  if (!current) return;
  const cfg = { ...current, ...collectForm() } as XComposeConfig;
  await setStorage(cfg);
  current = cfg;
  els.testBtn.disabled = true;
  els.testBtn.textContent = "Testing…";
  setTestStatus("Sending probe…", "info");
  try {
    const resp = (await chrome.runtime.sendMessage({
      type: "XCOMPOSE_TEST",
      cfg,
    })) as { ok: boolean; probe?: string; error?: string };
    if (!resp || !resp.ok) throw new Error(resp?.error ?? "Test failed");
    const preview = resp.probe ? `“${resp.probe.slice(0, 80)}”` : "ok";
    setTestStatus(`✓ Connected — probe: ${preview}`, "ok");
    flashSaved();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    setTestStatus(`✕ ${msg.slice(0, 180)}`, "bad");
  } finally {
    els.testBtn.disabled = false;
    els.testBtn.textContent = "Test connection";
  }
}

async function load(): Promise<void> {
  current = await getAll();
  els.provider.value = current.provider || "openai";
  els.model.value = current.model || "";
  els.apiKey.value = current.apiKey || "";
  els.baseUrl.value = current.baseUrl || "";
  els.httpReferer.value = current.httpReferer || "";
  els.appTitle.value = current.appTitle || "XCompose";
  refreshProviderUI();
  buildPrompts();
  try {
    const manifest = chrome.runtime.getManifest();
    if (manifest?.version) els.footVer.textContent = `v${manifest.version}`;
  } catch {
    // ignore
  }
}

els.provider.addEventListener("change", () => {
  refreshProviderUI();
  if (current) current.provider = els.provider.value as ProviderId;
  scheduleSave();
});
for (const id of ["model", "baseUrl", "httpReferer", "appTitle"] as const) {
  const el = els[id] as HTMLInputElement;
  el.addEventListener("input", scheduleSave);
  el.addEventListener("change", () => {
    void save(true);
  });
}
els.apiKey.addEventListener("input", scheduleSave);
els.toggleKey.addEventListener("click", () => {
  const isPw = els.apiKey.type === "password";
  els.apiKey.type = isPw ? "text" : "password";
  els.toggleKey.textContent = isPw ? "🙈" : "👁";
});
els.testBtn.addEventListener("click", () => {
  void testConnection();
});
els.saveBtn.addEventListener("click", () => {
  void save(true);
});

els.resetPrompts.addEventListener("click", async () => {
  if (!confirm("Restore all prompts to defaults?")) return;
  const defaults = getDefaultPrompts();
  if (!current) return;
  current.prompts = { ...defaults };
  await setStorage({ prompts: current.prompts });
  buildPrompts();
  flashSaved();
});

els.exportBtn.addEventListener("click", async () => {
  const cfg = await getAll();
  const out: Record<string, unknown> & { _exportedAt?: string; _xcomposeVersion?: string } = {
    ...cfg,
  };
  if (!els.includeKey.checked) delete out["apiKey"];
  out["_exportedAt"] = new Date().toISOString();
  out["_xcomposeVersion"] = chrome.runtime.getManifest().version;
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `xcompose-settings-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

els.importFile.addEventListener("change", async e => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const json = JSON.parse(text) as Record<string, unknown>;
    const allowed: (keyof XComposeConfig)[] = [
      "provider",
      "apiKey",
      "baseUrl",
      "model",
      "temperature",
      "prompts",
      "httpReferer",
      "appTitle",
    ];
    const toSave: Partial<XComposeConfig> = {};
    for (const k of allowed)
      if (json[k as string] !== undefined)
        (toSave as Record<string, unknown>)[k as string] = json[k as string];
    await setStorage(toSave);
    await load();
    setTestStatus("Imported ✓ — review and hit Test.", "ok");
    flashSaved();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setTestStatus(`Import failed: ${msg}`, "bad");
  } finally {
    target.value = "";
  }
});

els.resetAll.addEventListener("click", async () => {
  if (!confirm("Reset all XCompose settings? This clears your API key and prompts.")) return;
  await chrome.storage.local.clear();
  current = await getAll();
  await load();
  setTestStatus("Reset done.", "info");
  flashSaved();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") void save(false);
});

void load();
