import { useEffect, useRef } from "react";
import { createPythonEditor, type PythonEditor } from "./editor.js";

type CodeEditorProps = {
  initialValue: string;
  onReady: (editor: PythonEditor | null) => void;
};

export function CodeEditor({ initialValue, onReady }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let editor: PythonEditor | undefined;

    void createPythonEditor(initialValue).then((created) => {
      if (disposed) {
        created.destroy?.();
        return;
      }
      editor = created;
      hostRef.current?.replaceChildren(created.element);
      onReady(created);
    });

    return () => {
      disposed = true;
      onReady(null);
      editor?.destroy?.();
      hostRef.current?.replaceChildren();
    };
  }, [initialValue, onReady]);

  return <div ref={hostRef} className="code-editor-mount" />;
}
