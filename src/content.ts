import { ACTIONS } from "./lib/prompts.js";

const SELECTORS = [
  'div[data-testid="tweetTextarea_0"]',
  'div[data-testid="tweetTextarea_0RichTextInputContainer"] div[role="textbox"]',
  'div[data-lexical-editor="true"]',
  'div[role="textbox"][data-testid][contenteditable="true"]',
  'div[aria-label="Post text"][role="textbox"]',
] as const;

const BROAD = 'div[role="textbox"][contenteditable="true"]' as const;

const injected = new WeakSet<Element>();
let observer: MutationObserver | null = null;

const PRIMARY_IDS = ["fix-grammar", "shorten", "punchier"] as const;
const SECONDARY_IDS = ACTIONS.filter(a => !(PRIMARY_IDS as readonly string[]).includes(a.id)).map(
  a => a.id
);

type BarElement = HTMLDivElement & {
  _xcomposeEditor?: HTMLElement;
  _statusTimer?: number;
};

function getEditorEl(rootMatch: Element | null): HTMLElement | null {
  if (!rootMatch) return null;
  if (rootMatch.getAttribute("contenteditable") === "true") return rootMatch as HTMLElement;
  const inner = rootMatch.querySelector<HTMLElement>(
    'div[data-lexical-editor="true"], div[role="textbox"][contenteditable="true"]'
  );
  return (inner ?? (rootMatch as HTMLElement)) || null;
}

function findEditors(): HTMLElement[] {
  const seen = new Set<Element>();
  const results: HTMLElement[] = [];
  for (const sel of [...SELECTORS, BROAD]) {
    try {
      document.querySelectorAll(sel).forEach(el => {
        const editor = getEditorEl(el);
        if (!editor) return;
        if (seen.has(editor)) return;
        if (!editor.isConnected) return;
        const style = window.getComputedStyle(editor);
        if (style.display === "none" || style.visibility === "hidden") return;
        if (editor.closest('[aria-hidden="true"]')) return;
        seen.add(editor);
        results.push(editor);
      });
    } catch {
      // ignore invalid selector
    }
  }
  return results;
}

function createToolbar(editor: HTMLElement): BarElement {
  const bar = document.createElement("div") as BarElement;
  bar.className = "xcompose-bar";
  bar.dataset["xcompose"] = "bar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "XCompose AI tools");

  const brand = document.createElement("button");
  brand.type = "button";
  brand.className = "xcompose-brand";
  brand.title = "Open XCompose settings";
  brand.innerHTML =
    '<span class="xcompose-dot" aria-hidden="true"></span><span class="xcompose-brand-text">XCompose</span>';
  brand.addEventListener("click", () => {
    void chrome.runtime.sendMessage({ type: "XCOMPOSE_GET_CONFIG" });
    void chrome.runtime.openOptionsPage?.();
  });
  bar.appendChild(brand);

  const divider1 = document.createElement("span");
  divider1.className = "xcompose-divider";
  bar.appendChild(divider1);

  for (const id of PRIMARY_IDS) {
    const meta = ACTIONS.find(a => a.id === id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "xcompose-btn";
    if (id === "fix-grammar") btn.classList.add("primary");
    btn.dataset["action"] = id;
    btn.title = meta ? `${meta.label} — ${meta.desc ?? ""}` : id;
    btn.innerHTML = `<span class="xcompose-btn-icon" aria-hidden="true">${meta ? meta.icon : "✦"}</span><span class="xcompose-btn-label">${meta ? meta.label : id}</span>`;
    btn.addEventListener("click", () => {
      void handleAction(editor, bar, id, btn);
    });
    bar.appendChild(btn);
  }

  const moreWrap = document.createElement("div");
  moreWrap.className = "xcompose-more-wrap";
  const moreBtn = document.createElement("button");
  moreBtn.type = "button";
  moreBtn.className = "xcompose-btn xcompose-more-btn";
  moreBtn.setAttribute("aria-haspopup", "true");
  moreBtn.setAttribute("aria-expanded", "false");
  moreBtn.title = "More actions";
  moreBtn.textContent = "▾";
  const dropdown = document.createElement("div");
  dropdown.className = "xcompose-dropdown hidden";
  dropdown.setAttribute("role", "menu");

  for (const id of SECONDARY_IDS) {
    const meta = ACTIONS.find(a => a.id === id);
    if (!meta) continue;
    const item = document.createElement("button");
    item.type = "button";
    item.className = "xcompose-dropdown-item";
    item.dataset["action"] = id;
    item.setAttribute("role", "menuitem");
    item.innerHTML = `<span aria-hidden="true">${meta.icon}</span> ${meta.label}`;
    item.title = meta.desc ?? "";
    item.addEventListener("click", async e => {
      e.stopPropagation();
      dropdown.classList.add("hidden");
      moreBtn.setAttribute("aria-expanded", "false");
      await handleAction(editor, bar, id, item);
    });
    dropdown.appendChild(item);
  }

  moreBtn.addEventListener("click", e => {
    e.stopPropagation();
    const isHidden = dropdown.classList.contains("hidden");
    document.querySelectorAll(".xcompose-dropdown").forEach(d => d.classList.add("hidden"));
    document
      .querySelectorAll(".xcompose-more-btn")
      .forEach(b => b.setAttribute("aria-expanded", "false"));
    if (isHidden) {
      dropdown.classList.remove("hidden");
      moreBtn.setAttribute("aria-expanded", "true");
    }
  });

  moreWrap.appendChild(moreBtn);
  moreWrap.appendChild(dropdown);
  bar.appendChild(moreWrap);

  const status = document.createElement("span");
  status.className = "xcompose-status";
  status.setAttribute("aria-live", "polite");
  bar.appendChild(status);

  const undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.className = "xcompose-icon-btn";
  undoBtn.dataset["undo"] = "1";
  undoBtn.title = "Undo last change";
  undoBtn.textContent = "↩";
  undoBtn.hidden = true;
  undoBtn.addEventListener("click", () => {
    const prev = bar.dataset["prevText"];
    if (prev !== undefined) {
      setEditorText(editor, prev);
      showStatus(bar, "Undone", "info");
      undoBtn.hidden = true;
    }
  });
  bar.appendChild(undoBtn);

  document.addEventListener("click", () => {
    dropdown.classList.add("hidden");
    moreBtn.setAttribute("aria-expanded", "false");
  });

  return bar;
}

function findAnchorForBar(editor: HTMLElement): {
  parent: HTMLElement | null;
  before?: Element | null;
  after?: Element | null;
} {
  let cur: HTMLElement | null = editor;
  for (let i = 0; i < 8 && cur && cur !== document.body; i++) {
    const par: HTMLElement | null = cur.parentElement;
    if (!par) break;
    const toolbar = par.querySelector('[data-testid="toolBar"], [data-testid="tweetButton"]');
    if (toolbar) return { parent: par, before: toolbar.closest("div") ?? toolbar, after: null };
    if (par.matches('[data-testid="tweetTextarea_0"]')) {
      return { parent: par.parentElement ?? par, before: null, after: par };
    }
    cur = par;
  }
  return { parent: editor.parentElement, after: editor };
}

function injectForEditor(editor: HTMLElement): void {
  if (injected.has(editor)) return;
  if (editor.dataset["xcomposeInjected"] === "1") return;
  const anchor = findAnchorForBar(editor);
  if (!anchor || !anchor.parent) return;
  if (anchor.parent.querySelector(":scope > .xcompose-bar")) return;
  let p: HTMLElement | null = editor;
  while (p && p !== document.body) {
    if (p.querySelector && p.querySelector(".xcompose-bar")) {
      if (p !== editor) break;
    }
    if (p.dataset && (p as HTMLElement).dataset["xcompose"] === "bar") return;
    p = p.parentElement;
    if (!p) break;
    if (p.querySelector && p.querySelector(":scope > .xcompose-bar")) return;
  }

  const bar = createToolbar(editor);
  try {
    if (anchor.before && anchor.before.parentElement === anchor.parent) {
      anchor.parent.insertBefore(bar, anchor.before);
    } else if (anchor.after && anchor.after.parentElement === anchor.parent) {
      anchor.after.insertAdjacentElement("afterend", bar);
    } else if (anchor.after) {
      anchor.after.insertAdjacentElement("afterend", bar);
    } else {
      anchor.parent.appendChild(bar);
    }
  } catch {
    editor.insertAdjacentElement("afterend", bar);
  }

  editor.dataset["xcomposeInjected"] = "1";
  injected.add(editor);
  bar._xcomposeEditor = editor;

  const mo = new MutationObserver(() => {
    if (!editor.isConnected) {
      injected.delete(editor);
      mo.disconnect();
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

function scan(): void {
  const editors = findEditors();
  editors.forEach(injectForEditor);
  document.querySelectorAll<BarElement>(".xcompose-bar").forEach(bar => {
    const ed = bar._xcomposeEditor;
    if (ed && !ed.isConnected) bar.remove();
  });
}

function getEditorText(editor: HTMLElement): string {
  const t = (editor as HTMLElement & { innerText?: string }).innerText ?? editor.textContent ?? "";
  return t.replaceAll("\uFEFF", "").replace(/\s+$/, "").replace(/^\s+/, "");
}

function setEditorText(editor: HTMLElement, newText: string): void {
  editor.focus();
  const sel = window.getSelection();
  try {
    const range = document.createRange();
    range.selectNodeContents(editor);
    sel?.removeAllRanges();
    sel?.addRange(range);
  } catch {
    // ignore
  }

  let replaced = false;
  try {
    replaced = document.execCommand("selectAll", false, undefined);
  } catch {
    // ignore
  }
  try {
    if (document.execCommand("insertText", false, newText)) replaced = true;
  } catch {
    // ignore
  }

  if (!replaced) {
    try {
      editor.dispatchEvent(
        new InputEvent("beforeinput", {
          inputType: "insertReplacementText",
          data: newText,
          bubbles: true,
          cancelable: true,
        })
      );
    } catch {
      // ignore
    }
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", newText);
    const pasteEvent = new ClipboardEvent("paste", {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true,
    });
    const handled = editor.dispatchEvent(pasteEvent);
    if (!handled || editor.innerText === "" || editor.textContent === "") {
      editor.textContent = "";
      const lines = newText.split("\n");
      lines.forEach((line, i) => {
        if (line) editor.appendChild(document.createTextNode(line));
        if (i < lines.length - 1) editor.appendChild(document.createElement("br"));
      });
    }
  }

  editor.dispatchEvent(
    new InputEvent("input", { bubbles: true, data: newText, inputType: "insertText" })
  );
  editor.dispatchEvent(new Event("change", { bubbles: true }));
  editor.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));

  try {
    const r = document.createRange();
    r.selectNodeContents(editor);
    r.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(r);
  } catch {
    // ignore
  }

  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function showStatus(
  bar: BarElement,
  msg: string,
  kind: "info" | "error" | "success" = "info"
): void {
  const el = bar.querySelector<HTMLElement>(".xcompose-status");
  if (!el) return;
  el.textContent = msg;
  el.dataset["kind"] = kind;
  if (kind === "error") el.style.color = "#ff7a7a";
  else if (kind === "success") el.style.color = "#1D9BF0";
  else el.style.color = "#71767B";
  if (msg) {
    clearTimeout(bar._statusTimer as unknown as number);
    bar._statusTimer = window.setTimeout(() => {
      el.textContent = "";
    }, 3500);
  }
}

function setLoading(bar: BarElement, loading: boolean): void {
  bar.querySelectorAll<HTMLButtonElement>(".xcompose-btn").forEach(b => {
    b.disabled = loading;
    b.style.opacity = loading ? "0.6" : "1";
    b.style.cursor = loading ? "wait" : "pointer";
  });
  const status = bar.querySelector<HTMLElement>(".xcompose-status");
  if (loading) {
    bar.classList.add("loading");
    if (status) status.textContent = "…";
  } else {
    bar.classList.remove("loading");
  }
}

async function handleAction(
  editor: HTMLElement,
  bar: BarElement,
  actionId: string,
  btn: HTMLElement
): Promise<void> {
  const original = getEditorText(editor);
  if (!original || !original.trim()) {
    showStatus(bar, "Nothing to edit", "error");
    toast("Compose is empty", "error");
    return;
  }
  setLoading(bar, true);
  btn.classList.add("is-loading");
  showStatus(bar, "Thinking…", "info");
  try {
    const resp = (await chrome.runtime.sendMessage({
      type: "XCOMPOSE_ENHANCE",
      actionId,
      text: original,
    })) as { ok: boolean; result?: string; error?: string };
    if (!resp || !resp.ok) throw new Error(resp?.error ?? "Unknown error");
    const result = (resp.result ?? "").trim();
    if (!result) throw new Error("Model returned empty.");
    if (result === original.trim()) {
      showStatus(bar, "No change needed", "info");
      toast("Already looks good ✨", "info");
      return;
    }
    bar.dataset["prevText"] = original;
    const undoBtn = bar.querySelector<HTMLButtonElement>("[data-undo]");
    if (undoBtn) undoBtn.hidden = false;

    setEditorText(editor, result);
    showStatus(bar, "Done ✓", "success");
    toast("Enhanced — ↩ to undo", "success");
    (bar as unknown as { animate?: Element["animate"] }).animate?.(
      [{ transform: "scale(1)" }, { transform: "scale(1.01)" }, { transform: "scale(1)" }],
      { duration: 220 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[XCompose] enhance failed", err);
    showStatus(bar, msg.slice(0, 80), "error");
    toast(msg, "error");
    if (msg.includes("No API key") || msg.includes("API key")) {
      setTimeout(() => {
        if (confirm("XCompose: No API key set. Open settings now?"))
          void chrome.runtime.openOptionsPage?.();
      }, 300);
    }
  } finally {
    setLoading(bar, false);
    btn.classList.remove("is-loading");
  }
}

function toast(message: string, kind: "info" | "error" | "success" = "info"): void {
  let c = document.getElementById("xcompose-toast-container");
  if (!c) {
    c = document.createElement("div");
    c.id = "xcompose-toast-container";
    c.className = "xcompose-toast-container";
    document.body.appendChild(c);
  }
  const t = document.createElement("div");
  t.className = `xcompose-toast xcompose-toast--${kind}`;
  t.textContent = message;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add("in"));
  setTimeout(() => {
    t.classList.remove("in");
    setTimeout(() => t.remove(), 250);
  }, 3400);
}

function startObserver(): void {
  scan();
  if (observer) observer.disconnect();
  observer = new MutationObserver(() => {
    // debounce
    clearTimeout((observer as unknown as { _t?: number })._t);
    (observer as unknown as { _t: number })._t = window.setTimeout(scan, 120);
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: false });
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(scan, 500);
    }
  }, 800);
  window.addEventListener("focus", () => setTimeout(scan, 200));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(scan, 200);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startObserver);
} else {
  startObserver();
}

document.addEventListener("keydown", (e: KeyboardEvent) => {
  const isMod = e.ctrlKey || e.metaKey;
  if (isMod && e.shiftKey && e.key.toLowerCase() === "g") {
    const ae = document.activeElement as HTMLElement | null;
    if (ae && ae.getAttribute("contenteditable") === "true") {
      const editors = findEditors();
      const editor = editors.find(ed => ed === ae || ed.contains(ae) || ae.contains(ed)) ?? ae;
      const tb = document.querySelector<BarElement>(".xcompose-bar");
      if (editor && tb) {
        e.preventDefault();
        const btn = tb.querySelector<HTMLButtonElement>('[data-action="fix-grammar"]');
        void handleAction(editor as HTMLElement, tb, "fix-grammar", (btn ?? tb) as HTMLElement);
      }
    }
  }
});

// oxlint-disable-next-line no-console
console.log("[XCompose] content script loaded");
