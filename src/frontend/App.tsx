import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  apiJson,
  connectEvents,
  type DiagnosticAnswerResponse,
  type DiagnosticResponse,
  type ExerciseResponse,
  type PracticeOutcome,
  type ProgressResponse,
  type SessionResponse,
  type SessionSnapshotResponse,
  type TutorAgentActionSummary,
  type TutorAgentState,
} from "./api.js";
import { CodeEditor } from "./CodeEditor.js";
import { SafeMarkdown } from "./SafeMarkdown.js";
import { createInitialViewModel, applySseEvent, type ViewModel } from "./state.js";
import type { PythonEditor } from "./editor.js";

type LocalMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  tone?: "error";
  annotations?: SessionSnapshotResponse["turns"][number]["annotations"];
  toolSummaries?: SessionSnapshotResponse["turns"][number]["tool_summaries"];
};

export function App() {
  const [sessionId, setSessionId] = useState("");
  const [connected, setConnected] = useState(false);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResponse | null>(null);
  const [exercise, setExercise] = useState<ExerciseResponse["exercise"] | null>(null);
  const [practiceOutcome, setPracticeOutcome] = useState<PracticeOutcome | null>(null);
  const [, setTutorAgentState] = useState<TutorAgentState | null>(null);
  const [, setRecentTutorAction] = useState<TutorAgentActionSummary | null>(null);
  const [, setGuidanceLoopState] = useState<SessionSnapshotResponse["guidance_loop_state"] | null>(null);
  const [, setLatestPracticeReview] = useState<SessionSnapshotResponse["latest_agent_practice_review"] | null>(null);
  const [viewModel, setViewModel] = useState<ViewModel>(() => createInitialViewModel());
  const [snapshotMessages, setSnapshotMessages] = useState<LocalMessage[]>([]);
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [composerText, setComposerText] = useState("");
  const [selectedDiagnosticChoice, setSelectedDiagnosticChoice] = useState("");
  const [submittingDiagnostic, setSubmittingDiagnostic] = useState(false);
  const [startingGuidance, setStartingGuidance] = useState(false);
  const [exerciseStatus, setExerciseStatus] = useState("提交后由导师评阅");
  const [submittingExercise, setSubmittingExercise] = useState(false);
  const [appError, setAppError] = useState("");
  const editorRef = useRef<PythonEditor | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadProgress = useCallback(async () => {
    const data = await apiJson<ProgressResponse>("/api/progress/me");
    setProgress(data);
    return data;
  }, []);

  const loadDiagnostic = useCallback(async () => {
    const data = await apiJson<DiagnosticResponse>("/api/diagnostics/next");
    setDiagnostic(data);
    return data;
  }, []);

  const restoreSnapshot = useCallback(async (id: string) => {
    const snapshot = await apiJson<SessionSnapshotResponse>(`/api/sessions/${encodeURIComponent(id)}/snapshot`);
    setSnapshotMessages(messagesFromSnapshot(snapshot));
    setExercise(snapshot.active_exercise);
    setExerciseStatus("提交后由导师评阅");
    setPracticeOutcome(snapshot.active_practice_outcome ?? null);
    setTutorAgentState(snapshot.tutor_agent_state ?? null);
    setRecentTutorAction(snapshot.recent_tutor_agent_actions?.[0] ?? null);
    setGuidanceLoopState(snapshot.guidance_loop_state ?? null);
    setLatestPracticeReview(snapshot.latest_agent_practice_review ?? null);
    setViewModel(createInitialViewModel());
    setLocalMessages([]);
    return snapshot;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const session = await apiJson<SessionResponse>("/api/sessions", { method: "POST", body: JSON.stringify({ resume: true }) });
        if (cancelled) return;
        setSessionId(session.session_id);
        const source = connectEvents(session.session_id, (event) => {
          setViewModel((current) => applySseEvent(current, event));
        }, () => {
          setConnected(false);
          setExerciseStatus((current) => current === "正在提交给导师评阅..." ? "连接已断开，稍后可重试" : current);
        });
        source.onopen = () => setConnected(true);
        eventSourceRef.current = source;
        setConnected(true);
        const [, progressData, diagnosticData] = await Promise.all([
          restoreSnapshot(session.session_id),
          loadProgress(),
          loadDiagnostic(),
        ]);
        if (!progressData.diagnostic.completed && !diagnosticData.completed) {
          setExercise(null);
        }
      } catch (error) {
        if (!cancelled) setAppError(userFacingError(error));
      }
    }

    void boot();
    return () => {
      cancelled = true;
      eventSourceRef.current?.close();
    };
  }, [loadDiagnostic, loadProgress, restoreSnapshot]);

  useEffect(() => {
    setSelectedDiagnosticChoice("");
  }, [diagnostic?.question?.id]);

  const streamingMessages = useMemo<LocalMessage[]>(() => {
    return viewModel.messages.map((message) => ({
      id: `${message.turnId}-${message.messageId}`,
      role: "assistant",
      text: message.text,
    }));
  }, [viewModel.messages]);

  const focusLine = useCallback((lineNumber: number) => {
    editorRef.current?.focusLine(lineNumber);
  }, []);

  const handleEditorReady = useCallback((editor: PythonEditor | null) => {
    editorRef.current = editor;
  }, []);

  const sendMessage = useCallback(async () => {
    const message = composerText.trim();
    if (!message || !sessionId) return;
    const code = editorRef.current?.getValue() ?? "";
    setComposerText("");
    setLocalMessages((items) => [...items, { id: `user-${Date.now()}`, role: "user", text: message }]);
    try {
      await apiJson(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
        method: "POST",
        body: JSON.stringify({ message, code, attachments: [] }),
      });
      await restoreSnapshot(sessionId);
    } catch (error) {
      const snapshot = sessionId ? await restoreSnapshot(sessionId).catch(() => null) : null;
      if (!snapshot?.turns.at(-1)?.turn_error) {
        setLocalMessages((items) => [...items, { id: `error-${Date.now()}`, role: "assistant", text: userFacingError(error), tone: "error" }]);
      }
    }
  }, [composerText, restoreSnapshot, sessionId]);

  const submitExercise = useCallback(async () => {
    if (!exercise || !sessionId || submittingExercise) return;
    const code = editorRef.current?.getValue() ?? "";
    setSubmittingExercise(true);
    setExerciseStatus("正在提交给导师评阅...");
    try {
      await apiJson(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
        method: "POST",
        body: JSON.stringify({
          message: buildPracticeSubmissionMessage(exercise, code),
          code,
          attachments: [],
          practice_submission: {
            kind: "practice_submission",
            practice_contract_id: exercise.practice_contract_id ?? exercise.id,
            code,
          },
        }),
      });
      await loadProgress();
      const snapshot = await restoreSnapshot(sessionId);
      setExerciseStatus(snapshot.active_exercise ? "提交后由导师评阅" : "已提交，导师已回复");
    } catch (error) {
      const snapshot = sessionId ? await restoreSnapshot(sessionId).catch(() => null) : null;
      setExerciseStatus(
        snapshot?.turns.at(-1)?.turn_error
          ? "导师动作生成失败，已记录错误"
          : (userFacingError(error).split("\n")[0] ?? "提交失败，请重试"),
      );
    } finally {
      setSubmittingExercise(false);
    }
  }, [exercise, loadProgress, restoreSnapshot, sessionId, submittingExercise]);

  const submitDiagnostic = useCallback(async () => {
    if (!diagnostic?.question || !selectedDiagnosticChoice || submittingDiagnostic) return;
    setSubmittingDiagnostic(true);
    try {
      await apiJson<DiagnosticAnswerResponse>(`/api/diagnostics/${encodeURIComponent(diagnostic.diagnostic_id)}/answers`, {
        method: "POST",
        body: JSON.stringify({
          question_id: diagnostic.question.id,
          answer: { choice_id: selectedDiagnosticChoice },
        }),
      });
      await Promise.all([loadDiagnostic(), loadProgress()]);
    } catch (error) {
      setAppError(userFacingError(error));
    } finally {
      setSubmittingDiagnostic(false);
    }
  }, [diagnostic, loadDiagnostic, loadProgress, selectedDiagnosticChoice, submittingDiagnostic]);

  const startGuidance = useCallback(async () => {
    if (!sessionId || startingGuidance) return;
    setStartingGuidance(true);
    try {
      await apiJson<{ accepted: true; turn_id: string }>(`/api/sessions/${encodeURIComponent(sessionId)}/guidance/start`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await restoreSnapshot(sessionId);
      await loadProgress();
    } catch (error) {
      const snapshot = sessionId ? await restoreSnapshot(sessionId).catch(() => null) : null;
      if (!snapshot?.turns.at(-1)?.turn_error) {
        setLocalMessages((items) => [
          ...items,
          { id: `guidance-error-${Date.now()}`, role: "assistant", text: userFacingError(error), tone: "error" },
        ]);
      }
    } finally {
      setStartingGuidance(false);
    }
  }, [loadProgress, restoreSnapshot, sessionId, startingGuidance]);

  const diagnosticTechnicalUnavailable = isDiagnosticTechnicalUnavailable(progress, diagnostic);
  const introText = diagnosticTechnicalUnavailable
    ? "测评题暂时无法生成。这是技术状态，不是学习起点判断。"
    : progress?.diagnostic.completed === false
      ? "先完成初始测评来确定起点水平，然后查看学习起点和下一步建议。"
      : progress?.diagnostic.completed
      ? "初始测评已完成。我先把测评反馈整理出来。"
      : "你好，我们继续学习 Python。正在读取你的学习状态。";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Python 课程伴学智能体</div>
        <ProgressStatus progress={progress} connected={connected} />
      </header>

      <main className="mentor-shell">
        <section className="conversation-column" aria-label="导师对话">
          {appError ? <MessageItem role="assistant" text={appError} onLineClick={focusLine} tone="error" /> : null}
          <MessageItem role="assistant" text={introText} onLineClick={focusLine} />
          {diagnostic?.question ? (
            <DiagnosticBlock
              diagnostic={diagnostic}
              selectedChoice={selectedDiagnosticChoice}
              submitting={submittingDiagnostic}
              onSelect={setSelectedDiagnosticChoice}
              onSubmit={submitDiagnostic}
            />
          ) : null}
          {diagnosticTechnicalUnavailable && progress ? (
            <DiagnosticTechnicalUnavailableBlock progress={progress} />
          ) : practiceOutcome && !exercise && practiceOutcome.kind !== "exercise_ready" ? (
            <PracticeOutcomeBlock outcome={practiceOutcome} />
          ) : !exercise && progress?.diagnostic.completed ? (
            <DiagnosticFeedbackBlock
              progress={progress}
              starting={startingGuidance}
              onStartGuidance={startGuidance}
            />
          ) : progress ? null : (
            <div className="diagnostic-card loading-card">正在整理学习状态...</div>
          )}
          {[...snapshotMessages, ...localMessages, ...streamingMessages].map((message) => (
            <MessageItem key={message.id} role={message.role} text={message.text} annotations={message.annotations} toolSummaries={message.toolSummaries} tone={message.tone} onLineClick={focusLine} />
          ))}
          {exercise ? (
            <ExerciseBlock
              exercise={exercise}
              status={exerciseStatus}
              submitting={submittingExercise}
              onSubmit={submitExercise}
              onEditorReady={handleEditorReady}
            />
          ) : null}
          <Composer value={composerText} onChange={setComposerText} onSend={sendMessage} disabled={!sessionId} />
        </section>
      </main>
    </div>
  );
}

function ProgressStatus({ progress, connected }: { progress: ProgressResponse | null; connected: boolean }) {
  const percent = progress?.course_progress_percent ?? 0;
  const progressLabel = progress ? progress.diagnostic.completed ? `课程总进度 ${percent}%` : "课程总进度 待测评" : "课程总进度 加载中";
  const diagnosticText = progress ? diagnosticProgressText(progress.diagnostic) : "测评读取中";
  return (
    <div className="progress-status" aria-label="学习进度">
      <div className="progress-line">
        <span className="progress-copy">{progressLabel}</span>
        <span className="progress-bar" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </span>
        <span className="progress-divider" />
        <span>起点 {progress?.current_level ?? "读取中"}</span>
        <span>当前 {progress?.current_chapter_title ?? "读取中"}</span>
        <span>{diagnosticText}</span>
        <span className={connected ? "sync-state ok" : "sync-state"}>{connected ? "会话同步" : "会话连接中"}</span>
        <span className="sandbox-state">沙箱可用</span>
      </div>
      {progress ? (
        <div className="chapter-strip" aria-label={`课程章节，共 ${progress.curriculum.length} 章，当前 ${progress.current_chapter_title}`}>
          <span className="chapter-total">共 {progress.curriculum.length} 章</span>
          {progress.curriculum.map((chapter, index) => (
            <span
              key={chapter.id}
              className={`chapter-chip ${chapter.status}`}
              aria-current={chapter.status === "current" ? "step" : undefined}
              title={`${chapter.title}：${chapter.mastery_percent}%`}
            >
              {index + 1}. {chapter.title}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DiagnosticBlock({
  diagnostic,
  selectedChoice,
  submitting,
  onSelect,
  onSubmit,
}: {
  diagnostic: DiagnosticResponse;
  selectedChoice: string;
  submitting: boolean;
  onSelect: (choiceId: string) => void;
  onSubmit: () => void;
}) {
  if (!diagnostic.question) return null;
  const focus = diagnostic.progress.current_focus_concept_ids.map(conceptLabel).join("、") || "起点水平";
  const remaining = diagnostic.progress.estimated_remaining_max === 0
    ? "正在确认完成条件"
    : `预计还需 ${diagnostic.progress.estimated_remaining_min}-${diagnostic.progress.estimated_remaining_max} 题`;
  return (
    <article className="diagnostic-card">
      <div className="diagnostic-header">
        <div>
          <div className="diagnostic-kicker">初始测评</div>
          <h2>确定起点水平</h2>
        </div>
        <span>自适应测评 · 已答 {diagnostic.progress.answered} 题</span>
      </div>
      <div className="diagnostic-meta">当前关注：{focus} · 置信度 {percent(diagnostic.progress.placement_confidence)} · {remaining}</div>
      <SafeMarkdown className="diagnostic-prompt" text={diagnostic.question.prompt_md} variant="prompt" />
      <div className="diagnostic-choices" role="radiogroup" aria-label="初始测评选项">
        {diagnostic.question.choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            role="radio"
            aria-checked={selectedChoice === choice.id}
            className={selectedChoice === choice.id ? "choice selected" : "choice"}
            onClick={() => onSelect(choice.id)}
          >
            <span>{choice.id.toUpperCase()}</span>
            {choice.text}
          </button>
        ))}
      </div>
      <div className="diagnostic-footer">
        <span>继续判断学习起点，达到高置信后再进入后续学习</span>
        <button className="primary" type="button" onClick={onSubmit} disabled={!selectedChoice || submitting}>
          {submitting ? "提交中..." : "提交测评"}
        </button>
      </div>
    </article>
  );
}

function DiagnosticFeedbackBlock({
  progress,
  starting,
  onStartGuidance,
}: {
  progress: ProgressResponse;
  starting: boolean;
  onStartGuidance: () => void;
}) {
  const feedback = progress.diagnostic_feedback ?? fallbackDiagnosticFeedback(progress);
  return (
    <article className="diagnostic-card diagnostic-feedback">
      <div className="diagnostic-header">
        <div>
          <div className="diagnostic-kicker">测评反馈</div>
          <h2>你的学习起点</h2>
        </div>
      </div>
      <div className="diagnostic-summary-grid diagnostic-feedback-grid">
        <div>
          <span>测评表现</span>
          <strong>{feedback.performance_summary}</strong>
        </div>
        <div>
          <span>掌握情况</span>
          <strong>{feedback.mastery_summary}</strong>
        </div>
        <div>
          <span>学习起点</span>
          <strong>{feedback.learning_start}</strong>
        </div>
      </div>
      <div className="diagnostic-footer">
        <span>从这个起点进入导师指导。</span>
        <button className="primary" type="button" onClick={onStartGuidance} disabled={starting}>
          {starting ? "正在开始..." : "开始导师指导"}
        </button>
      </div>
    </article>
  );
}

function CurrentLearningStrip({
  action,
  loopState,
}: {
  action: TutorAgentActionSummary | null;
  loopState: SessionSnapshotResponse["guidance_loop_state"] | null;
}) {
  const conceptId = loopState?.current_concept_id ?? action?.concept_id ?? null;
  return (
    <div className="current-learning-strip" aria-label="当前导师指导状态">
      <span>导师指导中</span>
      {conceptId ? <strong>{conceptLabel(conceptId)}</strong> : null}
      {loopState ? <span>{loopPhaseLabel(loopState.phase)}</span> : null}
      {action ? <span>{actionLabel(action.action_kind)} · {action.validation_status === "accepted" ? "已验证" : "需重规划"}</span> : null}
    </div>
  );
}

function loopPhaseLabel(phase: NonNullable<SessionSnapshotResponse["guidance_loop_state"]>["phase"]): string {
  const labels: Record<NonNullable<SessionSnapshotResponse["guidance_loop_state"]>["phase"], string> = {
    need_explanation: "概念解释",
    need_guided_question: "引导追问",
    awaiting_guided_answer: "等待回答",
    practice_ready: "准备练习",
    active_practice: "练习中",
    review_practice_result: "练习复盘",
    need_remediation: "补救讲解",
  };
  return labels[phase];
}

function PracticeOutcomeBlock({ outcome }: { outcome: Extract<PracticeOutcome, { kind: "practice_locked" | "practice_unavailable" }> }) {
  return (
    <article className="diagnostic-card diagnostic-feedback">
      <div className="diagnostic-header">
        <div>
          <div className="diagnostic-kicker">{outcome.kind === "practice_locked" ? "练习未解锁" : "练习暂时不可用"}</div>
          <h2>{outcome.message}</h2>
        </div>
      </div>
      <p>{outcome.next_step}</p>
    </article>
  );
}

function DiagnosticTechnicalUnavailableBlock({ progress }: { progress: ProgressResponse }) {
  const focus = progress.diagnostic.current_focus_concept_ids.map(conceptLabel).join("、") || "当前测评目标";
  return (
    <article className="diagnostic-card diagnostic-feedback">
      <div className="diagnostic-header">
        <div>
          <div className="diagnostic-kicker">测评暂时不可用</div>
          <h2>测评题暂时无法生成</h2>
        </div>
        <span>已答 {progress.diagnostic.answered} 题</span>
      </div>
      <div className="diagnostic-summary-grid">
        <div>
          <span>状态</span>
          <strong>生成不可用</strong>
        </div>
        <div>
          <span>当前关注</span>
          <strong>{focus}</strong>
        </div>
      </div>
      <p>这是技术状态，不是学习起点判断。请稍后继续测评；系统不会因为生成失败给出低置信起点。</p>
      <div className="diagnostic-footer">
        <span>普通练习仍会保持锁定，直到高置信学习起点完成。</span>
      </div>
    </article>
  );
}

function diagnosticProgressText(diagnostic: ProgressResponse["diagnostic"]): string {
  if (diagnostic.completed) {
    return "测评已完成";
  }
  const focus = diagnostic.current_focus_concept_ids.map(conceptLabel).join("、") || "起点水平";
  const range = diagnostic.estimated_remaining_max > 0
    ? `约剩 ${diagnostic.estimated_remaining_min}-${diagnostic.estimated_remaining_max} 题`
    : "继续收集证据";
  return `自适应测评 已答 ${diagnostic.answered} 题 · ${focus} · 置信度 ${percent(diagnostic.placement_confidence)} · ${range}`;
}

function isDiagnosticTechnicalUnavailable(progress: ProgressResponse | null, diagnostic: DiagnosticResponse | null): boolean {
  return progress?.diagnostic.completed === false
    && (progress.diagnostic.diagnostic_status === "technical_unavailable"
      || diagnostic?.progress.diagnostic_status === "technical_unavailable");
}

function fallbackDiagnosticFeedback(progress: ProgressResponse): NonNullable<ProgressResponse["diagnostic_feedback"]> {
  const learningStart = progress.diagnostic.leading_start_label
    ?? (progress.current_level !== "未诊断" ? progress.current_level : null)
    ?? progress.current_chapter_title
    ?? "入门基础";
  return {
    performance_summary: "已完成初始测评，表现可作为起点判断参考。",
    mastery_summary: progress.current_goal ?? "已识别出适合继续学习的基础范围。",
    learning_start: learningStart,
  };
}

function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function conceptLabel(conceptId: string): string {
  const labels: Record<string, string> = {
    variable: "变量",
    expression: "表达式",
    condition: "条件",
    loop: "循环",
    list: "列表",
    function: "函数",
    dict: "字典",
    string: "字符串",
    file_io: "文件",
    exception: "异常",
    module_package: "模块",
    oop: "对象",
    debugging_testing: "调试",
    project_practice: "项目",
  };
  return labels[conceptId] ?? conceptId;
}

function actionLabel(actionKind: string): string {
  const labels: Record<string, string> = {
    explain_concept: "概念解释",
    ask_guided_question: "引导追问",
    evaluate_guided_answer: "理解判断",
    remediate_concept: "补前置概念",
    request_structured_practice: "结构化练习",
    review_practice_result: "练习复盘",
    propose_next_concept: "推进概念",
    explain_status: "状态说明",
  };
  return labels[actionKind] ?? actionKind;
}

function reviewStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    passed: "通过",
    partial: "部分完成",
    needs_revision: "需要修改",
    blocked_by_error: "暂不可判定",
  };
  return labels[status] ?? status;
}

function confidenceLabel(confidence: string): string {
  const labels: Record<string, string> = { high: "高", medium: "中", low: "低" };
  return labels[confidence] ?? confidence;
}

function progressEffectLabel(effect: string): string {
  const labels: Record<string, string> = { recorded: "已记录", not_recorded: "未记录", pending: "待确认" };
  return labels[effect] ?? effect;
}

function ExerciseBlock({
  exercise,
  status,
  submitting,
  onSubmit,
  onEditorReady,
}: {
  exercise: ExerciseResponse["exercise"];
  status: string;
  submitting: boolean;
  onSubmit: () => void;
  onEditorReady: (editor: PythonEditor | null) => void;
}) {
  return (
    <article className="exercise-card">
      <div className="exercise-header">
        <div>
          <div className="exercise-kicker">当前练习</div>
          <h1>{exercise.title}</h1>
        </div>
        <div className="exercise-meta">
          <span>难度 {difficultyLabel(exercise.difficulty)}</span>
          <span>预计 6 分钟</span>
        </div>
      </div>
      <SafeMarkdown className="exercise-prompt" text={exercise.prompt_md} variant="prompt" />
      {exercise.acceptance_checklist?.length ? (
        <ul className="exercise-checklist">
          {exercise.acceptance_checklist.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      <div className="embedded-editor">
          <CodeEditor key={exercise.id} initialValue={exercise.starter_code ?? ""} onReady={onEditorReady} />
        <div className="editor-footer">
          <span>{status}</span>
          <button className="primary submit-exercise" type="button" onClick={onSubmit} disabled={submitting}>
            {submitting ? "提交中..." : "提交练习"}
          </button>
        </div>
      </div>
    </article>
  );
}

function MessageItem({
  role,
  text,
  onLineClick,
  annotations,
  toolSummaries,
  tone,
}: {
  role: "assistant" | "user";
  text: string;
  onLineClick: (lineNumber: number) => void;
  annotations?: SessionSnapshotResponse["turns"][number]["annotations"];
  toolSummaries?: SessionSnapshotResponse["turns"][number]["tool_summaries"];
  tone?: "error";
}) {
  return (
    <article className={`message ${role} ${tone ?? ""}`.trim()}>
      <div className="avatar" aria-hidden="true">{role === "assistant" ? "师" : "你"}</div>
      <div className="message-body">
        <div className="message-author">{role === "assistant" ? "Python 导师" : "你"}</div>
        <SafeMarkdown onLineClick={onLineClick} text={text} variant="message" />
        {role === "assistant" ? <TurnEvidencePanel annotations={annotations} toolSummaries={toolSummaries ?? []} /> : null}
      </div>
    </article>
  );
}

function TurnEvidencePanel({
  annotations,
  toolSummaries,
}: {
  annotations?: SessionSnapshotResponse["turns"][number]["annotations"];
  toolSummaries: SessionSnapshotResponse["turns"][number]["tool_summaries"];
}) {
  const latestAction = annotations?.tutor_actions.at(-1) ?? null;
  const hasTutorState = Boolean(latestAction || annotations?.guidance_loop_state);
  const hasReview = Boolean(annotations?.practice_review);
  const hasTools = toolSummaries.length > 0 && !hasReview;
  if (!hasTutorState && !hasReview && !hasTools) return null;
  return (
    <div className="turn-evidence" aria-label="本轮导师证据">
      {hasTutorState ? <CurrentLearningStrip action={latestAction} loopState={annotations?.guidance_loop_state ?? null} /> : null}
      {annotations?.practice_review ? <ReviewEvidenceBlock review={annotations.practice_review} recentEvidence={annotations.progress_evidence ?? null} /> : null}
      {hasTools ? (
        <ul className="turn-tool-list">
          {toolSummaries.map((item) => (
            <li key={item.tool_call_id}>{item.tool_name} · {item.code} · {item.summary}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}) {
  return (
    <div className="composer">
      <textarea
        aria-label="向导师提问或说明你的思路"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="向导师提问或说明你的思路..."
        rows={3}
      />
      <div className="composer-actions">
        <button className="primary" type="button" onClick={onSend} disabled={disabled || !value.trim()}>
          发送
        </button>
      </div>
    </div>
  );
}

function messagesFromSnapshot(snapshot: SessionSnapshotResponse): LocalMessage[] {
  const messages: LocalMessage[] = [];
  for (const turn of snapshot.turns) {
    if (turn.user_message.text) {
      messages.push({
        id: `${turn.turn_id}-user`,
        role: "user",
        text: turn.user_message.text,
      });
    }
    for (const [index, message] of turn.assistant_messages.entries()) {
      messages.push({
        id: `${turn.turn_id}-${message.message_id}`,
        role: "assistant",
        text: message.text,
        annotations: index === turn.assistant_messages.length - 1 ? turn.annotations : undefined,
        toolSummaries: index === turn.assistant_messages.length - 1 ? turn.tool_summaries : undefined,
      });
    }
    if (turn.turn_error) {
      messages.push({
        id: `${turn.turn_id}-error`,
        role: "assistant",
        text: `系统错误：${turn.turn_error.message}`,
        tone: "error",
        annotations: turn.annotations,
        toolSummaries: turn.tool_summaries,
      });
    }
  }
  return messages;
}

function buildPracticeSubmissionMessage(exercise: ExerciseResponse["exercise"], code: string): string {
  return [
    `提交练习：${exercise.title}`,
    "",
    "```python",
    code.trimEnd(),
    "```",
  ].join("\n");
}

function ReviewEvidenceBlock({
  review,
  recentEvidence,
}: {
  review: NonNullable<SessionSnapshotResponse["latest_agent_practice_review"]>;
  recentEvidence?: ProgressResponse["recent_progress_evidence"] | null;
}) {
  const recordedConceptLabels = recentEvidence?.review_id === review.id
    ? recentEvidence.concepts.map((concept) => concept.label)
    : (review.recorded_concept_ids ?? []).map(conceptLabel);
  const evidenceSuffix = recordedConceptLabels.length > 0 ? `：${recordedConceptLabels.join("、")}` : "";
  return (
    <article className="review-evidence" aria-label="练习评阅证据">
      <div>
        <strong>评阅结果 {reviewStatusLabel(review.review_status)}</strong>
        <span>置信度 {confidenceLabel(review.confidence)} · 概念证据 {progressEffectLabel(review.progress_effect)}{review.progress_effect === "recorded" ? evidenceSuffix : ""}</span>
      </div>
      <ul>
        {review.evidence_refs.map((item) => (
          <li key={`${item.tool_name}:${item.result_code}`}>{item.tool_name} · {item.result_code} · {item.summary}</li>
        ))}
      </ul>
    </article>
  );
}

function difficultyLabel(difficulty: number): string {
  if (difficulty <= 1) return "入门";
  if (difficulty === 2) return "基础";
  if (difficulty === 3) return "进阶";
  return `Level ${difficulty}`;
}

function userFacingError(error: unknown): string {
  const message = error instanceof Error ? error.message : "本地服务暂时不可用。";
  if (/频繁|rate/i.test(message)) {
    return `${message}\n\n请稍等后重试，当前草稿已保留。`;
  }
  if (/沙箱|sandbox/i.test(message)) {
    return `${message}\n\n请保留当前代码，稍后再提交。`;
  }
  return `${message}\n\n请保留当前输入，稍后重试。`;
}
