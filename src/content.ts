import { ACTIONS, getConfig, type ActionMeta } from "./lib/config.js";
import { startGeneration } from "./lib/generation.js";
import { getText, setText } from "./lib/editor.js";
import { icon } from "./lib/icons.js";

const SELECTOR =
  'div[role="textbox"][contenteditable="true"], div[role="textbox"][data-xcompose-busy]';
const TOOLBAR_SELECTOR = '[data-testid="toolBar"]';
const OWNER = crypto.randomUUID();

document.documentElement.dataset.xcomposeOwner = OWNER;
// Recover any composer left locked by an invalidated extension script.
document.querySelectorAll<HTMLElement>("[data-xcompose-busy]").forEach(editor => {
  editor.setAttribute("contenteditable", "true");
  editor.removeAttribute("aria-busy");
  delete editor.dataset.xcomposeBusy;
});
document
  .querySelectorAll<HTMLElement>(
    "[data-xcompose-root], .xcompose-bar, .xcompose-dropdown, .xcompose-tooltip"
  )
  .forEach(element => element.remove());

type Mount = {
  bar: HTMLElement;
  host: HTMLElement;
  signature: string;
  menu?: HTMLElement;
  tooltip?: HTMLElement;
};

const mounts = new Map<HTMLElement, Mount>();
const busyEditors = new WeakSet<HTMLElement>();
const cancellations = new Map<HTMLElement, () => void>();
let openMenu: HTMLElement | undefined;
let menuSequence = 0;

const barOfEditor = (editor: HTMLElement) => mounts.get(editor)?.bar ?? null;

function toolbarOf(editor: HTMLElement): HTMLElement | null {
  let node = editor.parentElement;
  while (node && node !== document.body) {
    const toolbar = node.querySelector<HTMLElement>(TOOLBAR_SELECTOR);
    if (toolbar) return toolbar;
    node = node.parentElement;
  }
  return null;
}

function insertIntoToolbar(host: HTMLElement, bar: HTMLElement) {
  // Defensive: the host must never contain more than one button.
  host.querySelectorAll(":scope .xcompose-bar").forEach(el => {
    if (el !== bar) el.remove();
  });
  const submit = host.querySelector<HTMLElement>(
    '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]'
  );
  let item = submit;
  while (item?.parentElement && item.parentElement !== host) item = item.parentElement;
  const controls = item?.previousElementSibling;
  if (controls instanceof HTMLElement) controls.append(bar);
  else if (item?.parentElement === host) host.insertBefore(bar, item);
  else host.append(bar);
}

function removeMount(editor: HTMLElement) {
  const mount = mounts.get(editor);
  if (!mount) return;
  cancellations.get(editor)?.();
  if (openMenu === mount.menu) openMenu = undefined;
  mount.menu?.remove();
  mount.tooltip?.remove();
  mount.bar.remove();
  mounts.delete(editor);
}

function scan(enabled: string[]) {
  const signature = enabled.join("\0");
  const editors = new Set(document.querySelectorAll<HTMLElement>(SELECTOR));

  for (const editor of mounts.keys()) {
    if (!editors.has(editor) || !editor.isConnected) removeMount(editor);
  }

  // One button per toolbar: two editors can resolve to the same host because
  // toolbarOf() searches whole ancestor subtrees. First editor in DOM order wins;
  // insertIntoToolbar() also dedupes, so a pass never leaves two buttons behind.
  const usedHosts = new Set<HTMLElement>();

  for (const editor of editors) {
    const host = toolbarOf(editor);
    const existing = mounts.get(editor);
    const { display, visibility } = getComputedStyle(editor);
    const visible =
      (editor.isContentEditable || busyEditors.has(editor)) &&
      editor.getClientRects().length > 0 &&
      display !== "none" &&
      visibility !== "hidden";

    if (!visible || !host || enabled.length === 0) {
      removeMount(editor);
      continue;
    }
    if (usedHosts.has(host)) {
      removeMount(editor);
      continue;
    }
    if (existing?.bar.isConnected && existing.host.isConnected && existing.host === host) {
      if (existing.signature === signature) {
        usedHosts.add(host);
        continue;
      }
      removeMount(editor);
    }

    removeMount(editor);
    const mount = buildBar(editor, enabled);
    insertIntoToolbar(host, mount.bar);
    mounts.set(editor, { ...mount, host, signature });
    usedHosts.add(host);
  }
}

function actionBtn(editor: HTMLElement, bar: HTMLElement, action: ActionMeta): HTMLElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "xcompose-dropdown-item";
  btn.dataset.action = action.id;
  btn.title = action.label;
  const label = document.createElement("span");
  label.textContent = action.label;
  btn.append(icon(action.icon), label);
  btn.addEventListener("click", () => {
    if (openMenu) {
      openMenu.hidden = true;
      openMenu = undefined;
    }
    void run(editor, bar, action.id);
  });
  return btn;
}

function buildBar(editor: HTMLElement, enabled: string[]): Pick<Mount, "bar" | "menu" | "tooltip"> {
  const actions = enabled.map(id => ACTIONS.find(a => a.id === id)).filter(a => a !== undefined);
  const bar = document.createElement("div");
  bar.className = "xcompose-bar";
  bar.dataset.xcomposeRoot = "bar";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "xcompose-trigger";
  trigger.setAttribute("aria-label", "Open XCompose");
  trigger.setAttribute("aria-expanded", "false");
  trigger.append(icon("spell-check"));
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "xcompose-dropdown-item xcompose-cancel";
  cancel.textContent = "Cancel";
  cancel.hidden = !busyEditors.has(editor);
  cancel.addEventListener("click", () => cancellations.get(editor)?.());
  bar.append(trigger);

  const instance = ++menuSequence;
  const menu = document.createElement("div");
  menu.id = `xcompose-menu-${instance}`;
  menu.className = "xcompose-dropdown";
  menu.dataset.xcomposeRoot = "menu";
  menu.hidden = true;
  bar.dataset.menuId = menu.id;
  menu.append(...actions.map(action => actionBtn(editor, bar, action)));

  const undo = document.createElement("button");
  undo.type = "button";
  undo.className = "xcompose-dropdown-item xcompose-undo";
  undo.title = "Undo";
  undo.hidden = true;
  undo.append(icon("undo"), document.createTextNode("Undo"));
  undo.addEventListener("click", () => {
    const previous = bar.dataset.prev;
    if (previous === undefined || busyEditors.has(editor)) return;
    if (document.documentElement.dataset.xcomposeOwner !== OWNER) return;
    busyEditors.add(editor);
    undo.disabled = true;
    void (async () => {
      try {
        const applied = await setText(editor, previous);
        if (applied) {
          undo.hidden = true;
          delete bar.dataset.prev;
          setStatus(bar, "Undone");
        } else {
          setStatus(bar, "Undo failed");
        }
      } catch {
        setStatus(bar, "Undo failed");
      } finally {
        busyEditors.delete(editor);
        undo.disabled = false;
      }
    })();
  });

  const divider = document.createElement("div");
  divider.className = "xcompose-divider";
  const settings = document.createElement("button");
  settings.type = "button";
  settings.className = "xcompose-dropdown-item";
  settings.append(icon("settings"), document.createTextNode("Settings"));
  settings.addEventListener("click", () => {
    menu.hidden = true;
    openMenu = undefined;
    void chrome.runtime.sendMessage({ type: "open-options" });
  });
  const status = document.createElement("div");
  status.className = "xcompose-menu-status";
  status.hidden = true;
  menu.append(cancel, undo, divider, settings, status);
  document.body.append(menu);

  const tooltip = document.createElement("div");
  tooltip.id = `xcompose-tooltip-${instance}`;
  tooltip.className = "xcompose-tooltip";
  tooltip.dataset.xcomposeRoot = "tooltip";
  tooltip.textContent = "XCompose";
  tooltip.hidden = true;
  bar.dataset.tooltipId = tooltip.id;
  document.body.append(tooltip);

  let tooltipTimer: number | undefined;
  const hideTooltip = () => {
    clearTimeout(tooltipTimer);
    tooltip.hidden = true;
  };
  const showTooltip = () => {
    tooltip.hidden = false;
    const rect = trigger.getBoundingClientRect();
    const left = Math.max(
      6,
      Math.min(
        rect.left + (rect.width - tooltip.offsetWidth) / 2,
        innerWidth - tooltip.offsetWidth - 6
      )
    );
    const below = rect.bottom + tooltip.offsetHeight + 7 <= innerHeight;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${below ? rect.bottom + 7 : rect.top - tooltip.offsetHeight - 7}px`;
  };
  trigger.addEventListener("mouseenter", () => {
    tooltipTimer = window.setTimeout(showTooltip, 500);
  });
  trigger.addEventListener("mouseleave", hideTooltip);
  trigger.addEventListener("blur", hideTooltip);

  trigger.addEventListener("click", event => {
    hideTooltip();
    event.stopPropagation();
    if (openMenu && openMenu !== menu) openMenu.hidden = true;
    menu.hidden = !menu.hidden;
    openMenu = menu.hidden ? undefined : menu;
    trigger.setAttribute("aria-expanded", String(!menu.hidden));
    if (!menu.hidden) {
      const rect = trigger.getBoundingClientRect();
      const left = Math.max(
        8,
        Math.min(rect.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 8)
      );
      const below = rect.bottom + menu.offsetHeight + 8 <= innerHeight;
      const top = below ? rect.bottom + 6 : rect.top - menu.offsetHeight - 6;
      menu.style.left = `${left}px`;
      menu.style.top = `${Math.max(8, top)}px`;
    }
  });

  return { bar, menu, tooltip };
}

function setStatus(bar: HTMLElement, text: string) {
  const menu = document.getElementById(bar.dataset.menuId ?? "");
  const tooltip = document.getElementById(bar.dataset.tooltipId ?? "");
  const status = menu?.querySelector<HTMLElement>(".xcompose-menu-status");
  const trigger = bar.querySelector<HTMLButtonElement>(".xcompose-trigger");
  if (status) {
    status.textContent = text;
    status.hidden = !text;
  }
  if (trigger) trigger.setAttribute("aria-label", text ? `XCompose: ${text}` : "Open XCompose");
  if (tooltip) tooltip.textContent = text ? `XCompose · ${text}` : "XCompose";
}

async function run(editor: HTMLElement, bar: HTMLElement, actionId: string) {
  if (document.documentElement.dataset.xcomposeOwner !== OWNER || busyEditors.has(editor)) return;
  const trigger = bar.querySelector<HTMLButtonElement>(".xcompose-trigger");
  const original = getText(editor);
  if (!original.trim()) {
    setStatus(bar, "Empty draft");
    return;
  }
  busyEditors.add(editor);
  bar.classList.add("busy");
  const menu = document.getElementById(bar.dataset.menuId ?? "");
  const cancel = menu?.querySelector<HTMLButtonElement>(".xcompose-cancel");
  const actions = menu?.querySelectorAll<HTMLButtonElement>("[data-action], .xcompose-undo");
  actions?.forEach(button => {
    button.disabled = true;
  });
  if (trigger) trigger.setAttribute("aria-busy", "true");
  if (cancel) cancel.hidden = false;
  setStatus(bar, "Working…");
  try {
    const generation = startGeneration(editor, actionId, original);
    cancellations.set(editor, generation.cancel);
    const response = await generation.response;
    cancellations.delete(editor);
    if (!response.ok) throw new Error(response.error);
    const result = String(response.result).trim();
    if (
      document.documentElement.dataset.xcomposeOwner !== OWNER ||
      !editor.isConnected ||
      getText(editor) !== original
    ) {
      setStatus(bar, "Draft changed");
    } else if (result && result !== original) {
      bar.dataset.prev = original;
      const undo = menu?.querySelector<HTMLElement>(".xcompose-undo");
      const applied = await setText(editor, result);
      if (!applied) {
        // A handler may partially replace a draft before failing verification.
        // Keep the original available for recovery.
        if (undo) undo.hidden = false;
        setStatus(bar, "Apply failed");
      } else {
        if (undo) undo.hidden = false;
        setStatus(bar, "Applied");
      }
    } else {
      setStatus(bar, "No change");
    }
  } catch (error) {
    setStatus(bar, (error instanceof Error ? error.message : String(error)).slice(0, 60));
  } finally {
    busyEditors.delete(editor);
    cancellations.delete(editor);
    if (cancel) cancel.hidden = true;
    bar.classList.remove("busy");
    actions?.forEach(button => {
      button.disabled = false;
    });
    if (trigger) trigger.removeAttribute("aria-busy");
  }
}

let observer: MutationObserver | undefined;
let rescan: () => void;
let enabledActions: string[] | undefined;
{
  let timer: number | undefined;
  rescan = () => {
    if (document.documentElement.dataset.xcomposeOwner !== OWNER) {
      observer?.disconnect();
      return;
    }
    if (timer !== undefined) return;
    timer = window.setTimeout(() => {
      timer = undefined;
      if (enabledActions && document.documentElement.dataset.xcomposeOwner === OWNER)
        scan(enabledActions);
    });
  };
}

observer = new MutationObserver(rescan);
observer.observe(document.body, { childList: true, subtree: true });
const refreshConfig = async () => {
  try {
    enabledActions = (await getConfig()).enabled;
    rescan();
  } catch {
    // Extension reloads invalidate the previous script's runtime context.
  }
};
void refreshConfig();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.enabled) void refreshConfig();
});

document.addEventListener("click", event => {
  if (openMenu && !openMenu.contains(event.target as Node)) {
    openMenu.hidden = true;
    openMenu = undefined;
  }
});
window.addEventListener(
  "scroll",
  () => {
    if (openMenu) openMenu.hidden = true;
    openMenu = undefined;
  },
  true
);
window.addEventListener("resize", () => {
  if (openMenu) openMenu.hidden = true;
  openMenu = undefined;
});

document.addEventListener("keydown", event => {
  if (document.documentElement.dataset.xcomposeOwner !== OWNER) return;
  if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key !== "G") return;
  const editor = document.activeElement;
  if (!(editor instanceof HTMLElement) || !editor.matches(SELECTOR)) return;
  const bar = barOfEditor(editor);
  if (!bar || bar.classList.contains("busy")) return;
  event.preventDefault();
  void run(editor, bar, "fix-grammar");
});
