import { getText, setText } from "../../src/lib/editor";

const pause = () => new Promise(resolve => setTimeout(resolve, 20));
async function run() {
  document.documentElement.dataset.testStarted = "true";
  // This entry runs in Firefox's isolated extension world. Draft.js runs in the
  // page world; checking page-rendered EditorState catches DOM-only mutations.
  while (document.documentElement.dataset.ready !== "true") await pause();
  const editor = document.querySelector<HTMLElement>('[contenteditable="true"]')!;
  const original = getText(editor);
  const cases = [
    "Firefox replacement",
    "Two lines\n\nBlank line preserved",
    "Emoji 👋 café\n",
    original,
  ];
  const results = [];
  for (const text of cases) {
    const applied = await setText(editor, text);
    await pause();
    const state = document.querySelector('[data-state="0"]')!.textContent;
    results.push({
      name: `apply ${JSON.stringify(text)}`,
      pass: applied && getText(editor) === text && state === text,
      applied,
      dom: getText(editor),
      state,
    });
  }
  editor.setAttribute("contenteditable", "false");
  editor.blur();
  editor.focus();
  editor.setAttribute("contenteditable", "true");
  const applied = await setText(editor, "After generation");
  await pause();
  results.push({
    name: "apply after focusing locked input",
    pass: applied && document.querySelector('[data-state="0"]')!.textContent === "After generation",
  });
  // Exercise Firefox's native edit path after the replacement, to detect a
  // corrupted EditorState which would resurrect the old draft on the next edit.
  document.execCommand("insertText", false, "!");
  await pause();
  results.push({
    name: "continued editing",
    pass:
      getText(editor) === "After generation!" &&
      document.querySelector('[data-state="0"]')!.textContent === "After generation!",
  });
  results.push({
    name: "second composer unchanged",
    pass: document.querySelector('[data-state="1"]')!.textContent === "Second composer",
  });
  return { browser: navigator.userAgent, results };
}
const reportUrl = new URL("/firefox-test-result", location.href).href;
run()
  .then(report => fetch(reportUrl, { method: "POST", body: JSON.stringify(report) }))
  .catch(error =>
    fetch(reportUrl, { method: "POST", body: JSON.stringify({ error: String(error) }) })
  );
