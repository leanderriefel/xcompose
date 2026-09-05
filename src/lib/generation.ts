const GENERATION_TIMEOUT = 60_000;
type Response = { ok: boolean; result?: string; error?: string };

/** Lock only this composer, and always restore it even if the worker goes away. */
export function startGeneration(editor: HTMLElement, actionId: string, text: string) {
  const requestId = crypto.randomUUID();
  const editable = editor.getAttribute("contenteditable");
  const ariaBusy = editor.getAttribute("aria-busy");
  editor.dataset.xcomposeBusy = requestId;
  editor.setAttribute("contenteditable", "false");
  editor.setAttribute("aria-busy", "true");
  const preventEdit = (event: Event) => {
    if (editor.dataset.xcomposeBusy !== requestId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const preventKey = (event: KeyboardEvent) => {
    if (
      !["Tab", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(
        event.key
      )
    )
      preventEdit(event);
  };
  for (const event of ["beforeinput", "paste", "cut", "drop"])
    editor.addEventListener(event, preventEdit, true);
  editor.addEventListener("keydown", preventKey, true);
  let rejectCancellation: (error: Error) => void;
  let finished = false;
  const cancellation = new Promise<never>((_resolve, reject) => {
    rejectCancellation = reject;
  });
  const cancel = (message = "Cancelled") => {
    if (finished) return;
    rejectCancellation(new Error(message));
    try {
      void chrome.runtime.sendMessage({ type: "cancel-enhance", requestId }).catch(() => {});
    } catch {
      /* The worker may have been reloaded. Local cleanup still runs. */
    }
  };
  const timer = setTimeout(() => cancel("Timed out. Please try again."), GENERATION_TIMEOUT);
  const response = Promise.race([
    (async () =>
      (await chrome.runtime.sendMessage({
        type: "enhance",
        requestId,
        actionId,
        text,
      })) as Response)(),
    cancellation,
  ]).finally(() => {
    finished = true;
    clearTimeout(timer);
    for (const event of ["beforeinput", "paste", "cut", "drop"])
      editor.removeEventListener(event, preventEdit, true);
    editor.removeEventListener("keydown", preventKey, true);
    if (editor.dataset.xcomposeBusy !== requestId) return;
    delete editor.dataset.xcomposeBusy;
    if (editable === null) editor.removeAttribute("contenteditable");
    else editor.setAttribute("contenteditable", editable);
    if (ariaBusy === null) editor.removeAttribute("aria-busy");
    else editor.setAttribute("aria-busy", ariaBusy);
  });
  return { response, cancel: () => cancel() };
}
