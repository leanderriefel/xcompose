import React from "react";
import ReactDOM from "react-dom";
import Draft from "draft-js";
import "draft-js/dist/Draft.css";

const { Editor, EditorState, ContentState } = Draft;
function Composer({ index }) {
  const [state, update] = React.useState(() =>
    EditorState.createWithContent(
      ContentState.createFromText(index ? "Second composer" : "Original draft\n\nSecond line")
    )
  );
  return React.createElement(
    "section",
    null,
    React.createElement(Editor, { editorState: state, onChange: update }),
    React.createElement(
      "pre",
      { "data-state": index },
      state.getCurrentContent().getPlainText("\n")
    )
  );
}
ReactDOM.render(
  React.createElement(
    React.Fragment,
    null,
    React.createElement(Composer, { index: 0 }),
    React.createElement(Composer, { index: 1 })
  ),
  document.getElementById("root")
);
document.documentElement.dataset.ready = "true";
// web-ext may install the temporary add-on after the first page load.
setTimeout(() => {
  if (document.documentElement.dataset.testStarted !== "true") location.reload();
}, 1500);
