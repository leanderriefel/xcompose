import { ACTIONS, getConfig, type ActionMeta } from "./lib/config.js";
import { icon } from "./lib/icons.js";

const SELECTOR = 'div[role="textbox"][contenteditable="true"]';

const barOfEditor = (editor: HTMLElement) =>
  editor.nextElementSibling?.classList.contains("xcompose-bar")
    ? (editor.nextElementSibling as HTMLElement)
    : null;

function scan(enabled: string[]) {
  for (const bar of document.querySelectorAll<HTMLElement>(".xcompose-bar")) bar.remove();
  if (enabled.length === 0) return;
  for (const editor of document.querySelectorAll<HTMLElement>(SELECTOR)) {
    const { display, visibility } = getComputedStyle(editor);
    if (!editor.isContentEditable || display === "none" || visibility === "hidden") continue;
    editor.insertAdjacentElement("afterend", buildBar(editor, enabled));
  }
}

function actionBtn(
  editor: HTMLElement,
  bar: HTMLElement,
  a: ActionMeta,
  primary: boolean
): HTMLElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = primary ? "xcompose-btn primary" : "xcompose-dropdown-item";
  btn.dataset.action = a.id;
  btn.title = a.label;
  btn.innerHTML = `${icon(a.icon)}<span>${a.label}</span>`;
  btn.addEventListener("click", () => void run(editor, bar, a.id));
  return btn;
}

function buildBar(editor: HTMLElement, enabled: string[]): HTMLElement {
  const actions = enabled.map(id => ACTIONS.find(a => a.id === id)).filter(a => a !== undefined);
  const bar = document.createElement("div");
  bar.className = "xcompose-bar";

  const brand = document.createElement("button");
  brand.type = "button";
  brand.className = "xcompose-brand";
  brand.title = "Settings";
  brand.innerHTML = `<span class="xcompose-dot"></span>${icon("settings")}`;
  brand.addEventListener("click", () => void chrome.runtime.openOptionsPage());
  bar.append(brand);

  const primary = actions[0];
  if (primary) bar.append(actionBtn(editor, bar, primary, true));

  const rest = actions.slice(1);
  if (rest.length > 0) {
    const details = document.createElement("details");
    details.className = "xcompose-more";
    const summary = document.createElement("summary");
    summary.className = "xcompose-btn xcompose-more-btn";
    summary.title = "More";
    summary.textContent = "▾";
    details.append(summary, ...rest.map(a => actionBtn(editor, bar, a, false)));
    bar.append(details);
  }

  const status = document.createElement("span");
  status.className = "xcompose-status";

  const undo = document.createElement("button");
  undo.type = "button";
  undo.className = "xcompose-icon-btn";
  undo.title = "Undo";
  undo.hidden = true;
  undo.innerHTML = icon("undo");
  undo.addEventListener("click", () => {
    const prev = bar.dataset.prev;
    if (prev) {
      setText(editor, prev);
      undo.hidden = true;
      status.textContent = "Undone";
    }
  });

  bar.append(status, undo);
  return bar;
}

function setText(editor: HTMLElement, text: string) {
  editor.focus();
  const sel = getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(editor);
  sel.removeAllRanges();
  sel.addRange(range);
  if (!document.execCommand("insertText", false, text)) {
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    editor.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })
    );
  }
}

async function run(editor: HTMLElement, bar: HTMLElement, actionId: string) {
  const status = bar.querySelector<HTMLElement>(".xcompose-status");
  const original = editor.innerText.trim();
  if (!original) {
    if (status) status.textContent = "Empty";
    return;
  }
  bar.classList.add("busy");
  if (status) status.textContent = "…";
  try {
    const res = await chrome.runtime.sendMessage({ type: "enhance", actionId, text: original });
    if (!res.ok) throw new Error(res.error);
    const result = res.result.trim();
    if (result && result !== original) {
      bar.dataset.prev = original;
      const undo = bar.querySelector<HTMLElement>(".xcompose-icon-btn");
      if (undo) undo.hidden = false;
      setText(editor, result);
      if (status) status.textContent = "✓";
    } else if (status) {
      status.textContent = "No change";
    }
  } catch (e) {
    if (status) status.textContent = (e instanceof Error ? e.message : String(e)).slice(0, 60);
  } finally {
    bar.classList.remove("busy");
  }
}

let rescan: () => void;
{
  let t: number | undefined;
  rescan = () => {
    clearTimeout(t);
    t = window.setTimeout(async () => scan((await getConfig()).enabled), 150);
  };
}

rescan();
new MutationObserver(rescan).observe(document.body, { childList: true, subtree: true });
chrome.storage.onChanged.addListener(rescan);

document.addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.key !== "G") return;
  const editor = document.activeElement;
  if (!(editor instanceof HTMLElement) || !editor.matches(SELECTOR)) return;
  const bar = barOfEditor(editor);
  if (!bar || bar.classList.contains("busy")) return;
  e.preventDefault();
  void run(editor, bar, "fix-grammar");
});
