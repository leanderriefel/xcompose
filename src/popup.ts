import { getAll, getEffectiveModel, getProviderMeta } from "./lib/storage.js";

const $ = <T extends Element>(s: string): T => document.querySelector(s) as T;

const statusDot = $<HTMLElement>("#statusDot");
const statusText = $<HTMLElement>("#statusText");
const providerPill = $<HTMLElement>("#providerPill");
const modelText = $<HTMLElement>("#modelText");
const hintText = $<HTMLElement>("#hintText");
const btnSettings = $<HTMLElement>("#btnSettings");
const btnHelp = $<HTMLElement>("#btnHelp");
const miniHelp = $<HTMLElement>("#miniHelp");
const verEl = $<HTMLElement>("#ver");

try {
  const manifest = chrome.runtime.getManifest();
  if (manifest?.version) verEl.textContent = `v${manifest.version}`;
} catch {
  // ignore
}

function openOptions(): void {
  if (chrome.runtime.openOptionsPage) void chrome.runtime.openOptionsPage();
  else void chrome.tabs.create({ url: chrome.runtime.getURL("src/options.html") });
}

$<HTMLElement>("#openOptions").addEventListener("click", openOptions);
btnSettings.addEventListener("click", openOptions);
btnHelp.addEventListener("click", () => {
  miniHelp.classList.toggle("hidden");
  btnHelp.textContent = miniHelp.classList.contains("hidden") ? "How it works" : "Hide";
});
$<HTMLAnchorElement>("#rateLink").addEventListener("click", e => {
  e.preventDefault();
  void chrome.tabs.create({ url: "https://github.com" });
});

async function refresh(): Promise<void> {
  const cfg = await getAll();
  const meta = getProviderMeta(cfg.provider);
  const model = getEffectiveModel(cfg);
  providerPill.textContent = meta.label;
  modelText.textContent = model || "—";
  modelText.title = model || "";

  const hasKey = Boolean(cfg.apiKey && cfg.apiKey.trim().length > 8);
  if (!hasKey) {
    statusDot.className = "status-dot warn";
    statusText.textContent = "Not configured";
    providerPill.classList.remove("live");
    hintText.className = "hint error";
    hintText.textContent = "Add an API key in settings to enable the compose bar.";
  } else {
    statusDot.className = "status-dot ok";
    statusText.textContent = "Ready";
    providerPill.classList.add("live");
    hintText.className = "hint ok";
    hintText.textContent = `Using ${meta.label} • key saved locally`;
  }

  if (cfg.provider === "custom" && !cfg.baseUrl) {
    hintText.className = "hint error";
    hintText.textContent = "Custom provider needs a Base URL.";
    statusDot.className = "status-dot warn";
    statusText.textContent = "Base URL missing";
  }
}

void refresh();
chrome.storage.onChanged.addListener(() => {
  void refresh();
});
