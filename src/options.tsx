import { For, Show, createSignal, onMount } from "solid-js";
import { render } from "solid-js/web";
import { Checkbox } from "@kobalte/core/checkbox";
import { Collapsible } from "@kobalte/core/collapsible";
import { Select } from "@kobalte/core/select";
import {
  ACTIONS,
  DEFAULT_GENERAL_PROMPT,
  DEFAULT_PROMPTS,
  PROVIDERS,
  getConfig,
  setConfig,
  type ProviderId,
  type XComposeConfig,
} from "./lib/config.js";

const GO_MODELS = [
  "deepseek-v4-flash",
  "deepseek-v4-flash-vision-exp",
  "deepseek-v4-pro",
  "glm-5",
  "glm-5.1",
  "glm-5.2",
  "glm-5.3",
  "glm-5.3-flash",
  "gpt-5.6-luna",
  "grok-4.5",
  "grok-4.6",
  "hy3",
  "hy3-preview",
  "hy4-preview",
  "kimi-k2.5",
  "kimi-k2.6",
  "kimi-k2.7-code",
  "kimi-k3",
  "longcat-2.0",
  "mimo-v2-omni",
  "mimo-v2-pro",
  "mimo-v2.5",
  "mimo-v2.5-pro",
  "minimax-m2.5",
  "minimax-m2.7",
  "minimax-m3",
  "muse-spark-1.2-contributor",
  "qwen3.5-plus",
  "qwen3.6-plus",
  "qwen3.7-max",
  "qwen3.7-plus",
  "qwen3.8-flash",
  "qwen3.8-max",
];

const STATIC_MODELS: Record<ProviderId, string[]> = {
  openrouter: ["openai/gpt-5.6-luna", "anthropic/claude-haiku-4-5"],
  "opencode-go": GO_MODELS,
};

const MODEL_NAMES: Record<string, string> = {
  "gpt-5.6-luna": "GPT 5.6 Luna",
  "grok-4.5": "Grok 4.5",
  "grok-4.6": "Grok 4.6",
  hy3: "Hy 3",
  "hy3-preview": "Hy 3 Preview",
  "hy4-preview": "Hy 4 Preview",
  "muse-spark-1.2-contributor": "Muse Spark 1.2 Contributor",
};

function modelName(model: string): string {
  return (
    MODEL_NAMES[model] ??
    model
      .split("-")
      .map(part => {
        if (/^glm$/i.test(part)) return part.toUpperCase();
        if (/^mimo$/i.test(part)) return "MiMo";
        if (/^deepseek$/i.test(part)) return "DeepSeek";
        if (/^longcat$/i.test(part)) return "LongCat";
        if (/^minimax$/i.test(part)) return "MiniMax";
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ")
  );
}

async function fetchGoModels(): Promise<string[]> {
  const response = (await chrome.runtime.sendMessage({ type: "get-go-models" })) as {
    ok: boolean;
    models?: string[];
    error?: string;
  };
  if (!response.ok) throw new Error(response.error ?? "Model discovery failed");
  return response.models?.length ? response.models : GO_MODELS;
}

function App() {
  const [cfg, setCfg] = createSignal<XComposeConfig>();
  const [status, setStatus] = createSignal("");
  const [testing, setTesting] = createSignal(false);
  const [saved, setSaved] = createSignal(false);
  const [goModels, setGoModels] = createSignal(GO_MODELS);
  let timer: number | undefined;

  onMount(async () => {
    const [config, models] = await Promise.all([
      getConfig(),
      fetchGoModels().catch(() => GO_MODELS),
    ]);
    setCfg(config);
    setGoModels(models);
  });

  const models = () => (cfg()?.provider === "opencode-go" ? goModels() : STATIC_MODELS.openrouter);

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  const flush = () => {
    clearTimeout(timer);
    const current = cfg();
    if (current) void setConfig(current);
  };

  window.addEventListener("pagehide", flush);

  const save = (patch: Partial<XComposeConfig>) => {
    setCfg(c => {
      if (!c) return c;
      const next = { ...c, ...patch };
      if (patch.generalPrompt !== undefined) next.generalPromptSet = true;
      if (patch.apiKey !== undefined || patch.model !== undefined) {
        next.providerSettings = {
          ...c.providerSettings,
          [next.provider]: { apiKey: next.apiKey, model: next.model },
        };
      }
      return next;
    });
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      const current = cfg();
      if (current) void setConfig(current).then(flash);
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
    try {
      const origin =
        c.provider === "openrouter" ? "https://openrouter.ai/*" : "https://opencode.ai/*";
      if (!(await chrome.permissions.request({ origins: [origin] }))) {
        throw new Error("Provider access was not allowed");
      }
      await setConfig(c);
      const res = await chrome.runtime.sendMessage({ type: "test", cfg: c });
      setStatus(res.ok ? `✓ ${res.probe}` : `✕ ${res.error}`);
    } catch (error) {
      setStatus(`✕ ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div class="shell">
      <header class="topbar">
        <div class="brand-title">XCompose</div>
        <span class="badge" classList={{ show: saved() }}>
          Saved
        </span>
      </header>

      <main class="main">
        <section class="card">
          <div class="grid">
            <div class="field">
              <span class="label">Provider</span>
              <Select<ProviderId>
                class="select-root"
                options={Object.keys(PROVIDERS) as ProviderId[]}
                value={cfg()?.provider}
                onChange={provider => {
                  const current = cfg();
                  if (!provider || !current) return;
                  save({ provider, ...current.providerSettings[provider] });
                }}
                itemComponent={props => (
                  <Select.Item item={props.item} class="select-item">
                    <Select.ItemLabel>{PROVIDERS[props.item.rawValue].label}</Select.ItemLabel>
                    <Select.ItemIndicator class="select-indicator">✓</Select.ItemIndicator>
                  </Select.Item>
                )}
              >
                <Select.Trigger class="input select-trigger" aria-label="Provider">
                  <Select.Value<ProviderId>>
                    {state => PROVIDERS[state.selectedOption()].label}
                  </Select.Value>
                  <Select.Icon class="select-icon">⌄</Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content class="select-content">
                    <Select.Listbox class="select-listbox" />
                  </Select.Content>
                </Select.Portal>
              </Select>
              <span class="help">{PROVIDERS[cfg()?.provider ?? "opencode-go"].baseUrl}</span>
            </div>
            <div class="field">
              <span class="label">Model</span>
              <Show
                when={cfg()?.provider === "opencode-go"}
                fallback={
                  <>
                    <input
                      id="model"
                      class="input"
                      list="models"
                      placeholder="provider default"
                      value={cfg()?.model}
                      onInput={e => save({ model: e.currentTarget.value })}
                    />
                    <datalist id="models">
                      <For each={STATIC_MODELS.openrouter}>{model => <option value={model} />}</For>
                    </datalist>
                  </>
                }
              >
                <Select<string>
                  class="select-root"
                  options={models()}
                  value={cfg()?.model || PROVIDERS["opencode-go"].model}
                  onChange={model => model && save({ model })}
                  itemComponent={props => (
                    <Select.Item item={props.item} class="select-item">
                      <Select.ItemLabel>{modelName(props.item.rawValue)}</Select.ItemLabel>
                      <Select.ItemIndicator class="select-indicator">✓</Select.ItemIndicator>
                    </Select.Item>
                  )}
                >
                  <Select.Trigger class="input select-trigger" aria-label="Model">
                    <Select.Value<string>>
                      {state => modelName(state.selectedOption())}
                    </Select.Value>
                    <Select.Icon class="select-icon">⌄</Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content class="select-content model-select-content">
                      <Select.Listbox class="select-listbox" />
                    </Select.Content>
                  </Select.Portal>
                </Select>
              </Show>
            </div>
          </div>

          <label class="field">
            <span class="label">API key</span>
            <input
              id="key"
              class="input mono"
              type="password"
              autocomplete="off"
              spellcheck={false}
              placeholder={PROVIDERS[cfg()?.provider ?? "opencode-go"].placeholder}
              value={cfg()?.apiKey}
              onInput={e => save({ apiKey: e.currentTarget.value })}
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
          <h2>Actions</h2>
          <div class="checks">
            <For each={ACTIONS}>
              {a => (
                <Checkbox
                  class="check"
                  checked={cfg()?.enabled.includes(a.id) ?? false}
                  onChange={checked => toggle(a.id, checked)}
                >
                  <Checkbox.Input />
                  <Checkbox.Control class="checkbox-control">
                    <Checkbox.Indicator class="checkbox-indicator">✓</Checkbox.Indicator>
                  </Checkbox.Control>
                  <Checkbox.Label>{a.label}</Checkbox.Label>
                </Checkbox>
              )}
            </For>
          </div>
        </section>

        <section class="card">
          <h2>Prompts</h2>
          <div class="prompts">
            <div class="prompt-item prompt-general">
              <label class="prompt-head" for="general-prompt">
                <span class="prompt-title">General instructions</span>
                <span class="help">Applied to every action</span>
              </label>
              <div class="prompt-body">
                <textarea
                  id="general-prompt"
                  class="prompt-textarea"
                  rows={3}
                  spellcheck={false}
                  placeholder="For example: Use sentence case, avoid em dashes, and keep formatting plain."
                  value={cfg()?.generalPrompt ?? ""}
                  onInput={e => save({ generalPrompt: e.currentTarget.value })}
                />
              </div>
            </div>
            <For each={ACTIONS}>
              {a => (
                <Collapsible class="prompt-item" defaultOpen={!!a.primary}>
                  <Collapsible.Trigger class="prompt-head">
                    <span class="prompt-title">{a.label}</span>
                    <span class="prompt-chevron">▾</span>
                  </Collapsible.Trigger>
                  <Collapsible.Content class="prompt-body">
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
                  </Collapsible.Content>
                </Collapsible>
              )}
            </For>
          </div>
          <div class="row">
            <button
              class="btn ghost small"
              onClick={() =>
                save({
                  generalPrompt: DEFAULT_GENERAL_PROMPT,
                  generalPromptSet: true,
                  prompts: { ...DEFAULT_PROMPTS },
                })
              }
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
