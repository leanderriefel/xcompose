import { For, createSignal, onMount } from "solid-js";
import { render } from "solid-js/web";
import {
  ACTIONS,
  DEFAULT_PROMPTS,
  PROVIDERS,
  getConfig,
  setConfig,
  type ProviderId,
  type XComposeConfig,
} from "./lib/config.js";
import { icon } from "./lib/icons.js";

const MODELS: Record<ProviderId, string[]> = {
  openai: ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol", "gpt-5-mini"],
  anthropic: ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-5"],
  openrouter: ["openai/gpt-5.6-luna", "anthropic/claude-haiku-4-5"],
  opencode: ["gpt-5.6-luna", "claude-haiku-4-5"],
  custom: ["gpt-5.6-luna", "gpt-5-mini"],
};

function App() {
  const [cfg, setCfg] = createSignal<XComposeConfig>();
  const [status, setStatus] = createSignal("");
  const [testing, setTesting] = createSignal(false);
  const [saved, setSaved] = createSignal(false);
  let timer: number | undefined;

  onMount(async () => setCfg(await getConfig()));

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  const save = (patch: Partial<XComposeConfig>) => {
    setCfg(c => (c ? { ...c, ...patch } : c));
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      const c = cfg();
      if (c) void setConfig(c).then(flash);
    }, 400);
  };

  const toggle = (id: string, on: boolean) => {
    const c = cfg();
    if (!c) return;
    const enabled = new Set(c.enabled);
    if (on) enabled.add(id);
    else enabled.delete(id);
    save({ enabled: [...enabled] });
  };

  const test = async () => {
    const c = cfg();
    if (!c) return;
    setTesting(true);
    setStatus("Testing…");
    await setConfig(c);
    const res = await chrome.runtime.sendMessage({ type: "test", cfg: c });
    setStatus(res.ok ? `✓ ${res.probe}` : `✕ ${res.error}`);
    setTesting(false);
  };

  return (
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <span class="dot" />
          <div>
            <div class="brand-title">XCompose</div>
            <div class="brand-sub">AI for the X compose box</div>
          </div>
        </div>
        <span class="badge" classList={{ show: saved() }}>
          Saved
        </span>
      </header>

      <main class="main">
        <section class="card">
          <div class="grid">
            <label class="field">
              <span class="label">Provider</span>
              <select
                id="provider"
                class="input"
                value={cfg()?.provider}
                onChange={e => save({ provider: e.currentTarget.value as ProviderId })}
              >
                <For each={Object.entries(PROVIDERS)}>
                  {([id, p]) => <option value={id}>{p.label}</option>}
                </For>
              </select>
              <span class="help">
                {PROVIDERS[cfg()?.provider ?? "openai"].baseUrl || "Set a Base URL below"}
              </span>
            </label>
            <label class="field">
              <span class="label">Model</span>
              <input
                id="model"
                class="input"
                list="models"
                placeholder="provider default"
                value={cfg()?.model}
                onInput={e => save({ model: e.currentTarget.value })}
              />
              <datalist id="models">
                <For each={MODELS[cfg()?.provider ?? "openai"]}>{m => <option value={m} />}</For>
              </datalist>
            </label>
          </div>

          <label class="field">
            <span class="label">API key</span>
            <input
              id="key"
              class="input mono"
              type="password"
              autocomplete="off"
              spellcheck={false}
              placeholder={PROVIDERS[cfg()?.provider ?? "openai"].placeholder}
              value={cfg()?.apiKey}
              onInput={e => save({ apiKey: e.currentTarget.value })}
            />
          </label>

          <label class="field">
            <span class="label">Base URL</span>
            <input
              id="base"
              class="input mono"
              spellcheck={false}
              placeholder={PROVIDERS[cfg()?.provider ?? "openai"].baseUrl || "https://host/v1"}
              value={cfg()?.baseUrl}
              onInput={e => save({ baseUrl: e.currentTarget.value })}
            />
          </label>

          <div class="row">
            <button class="btn primary" disabled={testing()} onClick={() => void test()}>
              {testing() ? "Testing…" : "Test"}
            </button>
            <span class="test-status">{status()}</span>
          </div>
        </section>

        <section class="card">
          <h2>Toolbar buttons</h2>
          <div class="checks">
            <For each={ACTIONS}>
              {a => (
                <label class="check">
                  <input
                    type="checkbox"
                    checked={cfg()?.enabled.includes(a.id) ?? false}
                    onChange={e => toggle(a.id, e.currentTarget.checked)}
                  />
                  <span class="check-icon" innerHTML={icon(a.icon)} />
                  {a.label}
                </label>
              )}
            </For>
          </div>
        </section>

        <section class="card">
          <h2>Prompts</h2>
          <div class="prompts">
            <For each={ACTIONS}>
              {a => (
                <details class="prompt-item" open={!!a.primary}>
                  <summary class="prompt-head">
                    <span class="prompt-title">
                      <span class="check-icon" innerHTML={icon(a.icon)} />
                      {a.label}
                    </span>
                    <span class="prompt-chevron">▾</span>
                  </summary>
                  <div class="prompt-body">
                    <textarea
                      class="prompt-textarea"
                      rows={2}
                      spellcheck={false}
                      value={cfg()?.prompts[a.id] ?? ""}
                      onInput={e => {
                        const c = cfg();
                        if (!c) return;
                        save({ prompts: { ...c.prompts, [a.id]: e.currentTarget.value } });
                      }}
                    />
                  </div>
                </details>
              )}
            </For>
          </div>
          <div class="row">
            <button
              class="btn ghost small"
              onClick={() => save({ prompts: { ...DEFAULT_PROMPTS } })}
            >
              Reset prompts
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

render(() => <App />, document.getElementById("root")!);
