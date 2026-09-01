import { createSignal, onMount } from "solid-js";
import { render } from "solid-js/web";
import { PROVIDERS, getConfig, modelOf, type XComposeConfig } from "./lib/config.js";
import { icon } from "./lib/icons.js";

function App() {
  const [cfg, setCfg] = createSignal<XComposeConfig>();
  onMount(async () => {
    setCfg(await getConfig());
    chrome.storage.onChanged.addListener(() => void getConfig().then(setCfg));
  });

  const ok = () => {
    const c = cfg();
    return !!c && c.apiKey.trim().length > 8 && (c.provider !== "custom" || !!c.baseUrl.trim());
  };
  const model = () => {
    const c = cfg();
    return c ? modelOf(c) : "—";
  };

  return (
    <>
      <header class="popup-head">
        <div class="brand">
          <span class="dot" />
          <span class="brand-name">XCompose</span>
        </div>
        <button
          class="icon-btn"
          title="Settings"
          innerHTML={icon("settings")}
          onClick={() => void chrome.runtime.openOptionsPage()}
        />
      </header>

      <div class="card">
        <div class="status-row">
          <span class={`status-dot ${ok() ? "ok" : "warn"}`} />
          <span class="status-text">{ok() ? "Ready" : "No API key"}</span>
          <span class={`pill ${ok() ? "live" : ""}`}>
            {PROVIDERS[cfg()?.provider ?? "openai"].label}
          </span>
        </div>
        <div class="model-row">
          <span class="muted">Model</span>
          <span class="model">{model()}</span>
        </div>
      </div>

      <button class="btn primary" onClick={() => void chrome.runtime.openOptionsPage()}>
        Open settings
      </button>

      <p class="hint">
        Buttons show up under the compose box on x.com. <kbd>↩</kbd> undoes.{" "}
        <kbd>Ctrl/⌘+Shift+G</kbd> fixes grammar.
      </p>
    </>
  );
}

render(() => <App />, document.getElementById("root")!);
