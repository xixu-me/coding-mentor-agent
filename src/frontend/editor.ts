export type PythonEditor = {
  element: HTMLElement;
  getValue(): string;
  setValue(value: string): void;
  focusLine(lineNumber: number): void;
  destroy?(): void;
};

export async function createPythonEditor(initialValue: string): Promise<PythonEditor> {
  const host = document.createElement("div");
  host.className = "editor-host";
  try {
    const [{ EditorState }, { EditorView, keymap, lineNumbers }, { basicSetup }, { python }] = await Promise.all([
      import("@codemirror/state"),
      import("@codemirror/view"),
      import("codemirror"),
      import("@codemirror/lang-python"),
    ]);
    let view: InstanceType<typeof EditorView>;
    const state = EditorState.create({
      doc: initialValue,
      extensions: [basicSetup, lineNumbers(), keymap.of([]), python(), EditorView.lineWrapping],
    });
    view = new EditorView({ state, parent: host });
    return {
      element: host,
      getValue: () => view.state.doc.toString(),
      setValue: (value) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } }),
      focusLine: (lineNumber) => {
        const line = view.state.doc.line(Math.min(Math.max(1, lineNumber), view.state.doc.lines));
        view.dispatch({
          selection: { anchor: line.from },
          effects: EditorView.scrollIntoView(line.from, { y: "center" }),
        });
        view.focus();
        host.dataset.focusedLine = String(line.number);
      },
      destroy: () => view.destroy(),
    };
  } catch {
    const textarea = document.createElement("textarea");
    textarea.className = "code-textarea";
    textarea.value = initialValue;
    textarea.spellcheck = false;
    host.append(textarea);
    return {
      element: host,
      getValue: () => textarea.value,
      setValue: (value) => { textarea.value = value; },
      focusLine: (lineNumber) => {
        const lines = textarea.value.split(/\r?\n/);
        const target = Math.min(Math.max(1, lineNumber), lines.length);
        const start = lines.slice(0, target - 1).join("\n").length + (target > 1 ? 1 : 0);
        textarea.focus();
        textarea.setSelectionRange(start, start);
        host.dataset.focusedLine = String(target);
      },
      destroy: () => host.replaceChildren(),
    };
  }
}
