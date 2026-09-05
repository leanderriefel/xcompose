/** Read Draft.js blocks without including placeholders or dropping blank lines. */
export function getText(editor: HTMLElement): string {
  const blocks = editor.querySelectorAll<HTMLElement>('[data-block="true"]');
  if (blocks.length) {
    return Array.from(blocks, block => block.textContent ?? "").join("\n");
  }
  return editor.innerText ?? editor.textContent ?? "";
}

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function selectedEditor(editor: HTMLElement): boolean {
  const selection = getSelection();
  return (
    !!selection?.anchorNode &&
    !!selection.focusNode &&
    editor.contains(selection.anchorNode) &&
    editor.contains(selection.focusNode) &&
    document.activeElement === editor
  );
}

/** Paste through the editor's handler so its internal state stays in sync. */
export async function setText(editor: HTMLElement, text: string): Promise<boolean> {
  if (!editor.isConnected) return false;
  const original = getText(editor);
  // React's selection plugin ignores focus received while contenteditable=false.
  // Re-establish focus after unlocking so the upcoming range reaches Draft.js.
  if (document.activeElement === editor) editor.blur();
  editor.focus();
  const selection = getSelection();
  if (!selection) return false;
  const range = document.createRange();
  range.selectNodeContents(editor);
  const selectedText = range.toString();
  selection.removeAllRanges();
  selection.addRange(range);
  await tick();
  if (
    !editor.isConnected ||
    getText(editor) !== original ||
    !selectedEditor(editor) ||
    selection.rangeCount !== 1 ||
    selection.getRangeAt(0).toString() !== selectedText
  )
    return false;

  let handled = false;
  try {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    handled = !editor.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      })
    );
  } catch {
    // Some browsers cannot construct clipboard events.
  }
  // Timers also settle in background tabs, where animation frames can stop.
  await tick();
  await tick();
  if (
    getText(editor) !== text &&
    !handled &&
    !editor.closest(".DraftEditor-root") &&
    editor.isConnected &&
    getText(editor) === original &&
    selectedEditor(editor)
  ) {
    // Only unmanaged contenteditables may use native insertion. Reapplying a
    // paste to Draft.js can duplicate content and corrupt its EditorState.
    try {
      document.execCommand("insertText", false, text);
      await tick();
    } catch {
      /* Verification below determines success. */
    }
  }
  if (!editor.isConnected || getText(editor) !== text) return false;
  if (selectedEditor(editor)) {
    const end = document.createRange();
    end.selectNodeContents(editor);
    end.collapse(false);
    selection.removeAllRanges();
    selection.addRange(end);
  }
  return true;
}
