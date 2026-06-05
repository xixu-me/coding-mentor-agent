export type AgentSseEvent =
  | { type: "message_delta"; turn_id: string; message_id: string; seq: number; delta: string }
  | { type: "tool_start"; turn_id: string; tool_call_id: string; tool_name: string; display_name?: string }
  | { type: "tool_end"; turn_id: string; tool_call_id: string; tool_name: string; ok: boolean; code: string; summary: string; data?: unknown }
  | { type: "learning_event_recorded"; turn_id: string; event_id: string; event_type: string; concept_ids: string[] }
  | { type: "error"; turn_id?: string; code: string; message: string; retryable: boolean }
  | { type: "done"; turn_id: string };

export type ViewModel = {
  sessionId?: string;
  messages: Array<{ turnId: string; messageId: string; text: string; chunks: Map<number, string> }>;
  tools: Array<{ turnId: string; toolCallId: string; toolName: string; status: "running" | "done"; summary?: string }>;
  errors: Array<{ code: string; message: string }>;
};

export function createInitialViewModel(): ViewModel {
  return { messages: [], tools: [], errors: [] };
}

export function applySseEvent(state: ViewModel, event: AgentSseEvent): ViewModel {
  const next: ViewModel = {
    ...state,
    messages: state.messages.map((message) => ({ ...message, chunks: new Map(message.chunks) })),
    tools: state.tools.map((tool) => ({ ...tool })),
    errors: [...state.errors],
  };
  if (event.type === "message_delta") {
    let message = next.messages.find((item) => item.turnId === event.turn_id && item.messageId === event.message_id);
    if (!message) {
      message = { turnId: event.turn_id, messageId: event.message_id, text: "", chunks: new Map() };
      next.messages.push(message);
    }
    if (!message.chunks.has(event.seq)) {
      message.chunks.set(event.seq, event.delta);
      message.text = [...message.chunks.entries()].sort(([a], [b]) => a - b).map(([, chunk]) => chunk).join("");
    }
  } else if (event.type === "tool_start") {
    next.tools.push({ turnId: event.turn_id, toolCallId: event.tool_call_id, toolName: event.tool_name, status: "running" });
  } else if (event.type === "tool_end") {
    const tool = next.tools.find((item) => item.toolCallId === event.tool_call_id);
    if (tool) {
      tool.status = "done";
      tool.summary = event.summary;
    } else {
      next.tools.push({ turnId: event.turn_id, toolCallId: event.tool_call_id, toolName: event.tool_name, status: "done", summary: event.summary });
    }
  } else if (event.type === "error") {
    next.errors.push({ code: event.code, message: event.message });
  }
  return next;
}

export function renderTextNode(text: string): HTMLElement {
  const element = document.createElement("span");
  element.textContent = text;
  return element;
}
