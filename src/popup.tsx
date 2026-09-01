import { createSignal, onMount } from "solid-js";
import { render } from "solid-js/web";
import { PROVIDERS, getConfig, modelOf, type XComposeConfig } from "./lib/config.js";

const openOptions = () => void chrome.runtime.sendMessage({ type: "open-options" });

function App() {
  const [cfg, setCfg] = createSignal<XComposeConfig>();
  onMount(async () => {
    setCfg(await getConfig());
    chrome.storage.onChanged.addListener(() => void getConfig().then(setCfg));
  });

  const ok = () => {
    const c = cfg();
    return !!c && c.apiKey.trim().length > 8;
  };
  const model = () => {
    const c = cfg();
    return c ? modelOf(c) : "—";
  };
  return (
    <>
      <header class="popup-head">
        <span class="brand-name">XCompose</span>
        <span class="provider">{PROVIDERS[cfg()?.provider ?? "opencode-go"].label}</span>
      </header>

      <div class="info">
        <div class="info-row">
          <span class="muted">Status</span>
          <span>{ok() ? "Ready" : "API key required"}</span>
        </div>
        <div class="info-row">
          <span class="muted">Model</span>
          <span class="model">{model()}</span>
        </div>
      </div>

      <button class="btn" onClick={openOptions}>
        Settings
      </button>

      <p class="hint">
        <kbd>Ctrl/⌘ Shift G</kbd> fixes grammar.
      </p>
    </>
  );
}

render(() => <App />, document.getElementById("root")!);
