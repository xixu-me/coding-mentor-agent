import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { SandboxClient, SandboxResult, SandboxRunRequest } from "../types.js";
import { assertSandboxFilePath } from "../security/path.js";
import { createId } from "../security/ids.js";
import { redactText } from "../security/redaction.js";

export class DockerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DockerUnavailableError";
  }
}

export function buildDockerRunArgs(input: { image: string; workDir: string; timeoutMs: number; memoryMb: number }): string[] {
  return [
    "run",
    "--rm",
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--user",
    "65534:65534",
    "--memory",
    `${input.memoryMb}m`,
    "--pids-limit",
    "64",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,nodev,size=32m",
    "--mount",
    `type=bind,source=${input.workDir},target=/work,readonly=false`,
    "--workdir",
    "/work",
    input.image,
  ];
}

const DOCKER_CLI_STARTUP_GRACE_MS = 30000;

export function calculateDockerCliTimeoutMs(codeTimeoutMs: number): number {
  return Math.max(codeTimeoutMs + 10000, DOCKER_CLI_STARTUP_GRACE_MS);
}

export class DockerSandboxClient implements SandboxClient {
  constructor(private readonly config: { image: string; timeoutMs: number; pytestTimeoutMs: number; memoryMb: number; outputBytes: number }) {}

  async runPython(request: SandboxRunRequest): Promise<SandboxResult> {
    return this.runInContainer(request, ["python", "-I", "/work/main.py"], this.config.timeoutMs);
  }

  async runPytest(request: SandboxRunRequest & { public_tests: string }): Promise<SandboxResult> {
    return this.runInContainer(
      {
        ...request,
        files: [
          ...(request.files ?? []),
          { path: "test_public.py", content: request.public_tests },
        ],
      },
      ["python", "-m", "pytest", "-q", "/work/test_public.py"],
      this.config.pytestTimeoutMs,
    );
  }

  async lint(request: SandboxRunRequest): Promise<SandboxResult> {
    return this.runInContainer(request, ["python", "-m", "py_compile", "/work/main.py"], this.config.timeoutMs);
  }

  private async runInContainer(request: SandboxRunRequest, command: string[], defaultTimeoutMs: number): Promise<SandboxResult> {
    const workDir = join(tmpdir(), createId("run"));
    mkdirSync(workDir, { recursive: true });
    try {
      writeSandboxFiles(workDir, request);
      const timeoutMs = Math.min(request.limits?.timeout_ms ?? defaultTimeoutMs, defaultTimeoutMs);
      const memoryMb = Math.min(request.limits?.memory_mb ?? this.config.memoryMb, this.config.memoryMb);
      const codeTimeout = `${(timeoutMs / 1000).toFixed(3)}s`;
      const args = [...buildDockerRunArgs({ image: this.config.image, workDir, timeoutMs, memoryMb }), "timeout", codeTimeout, ...command];
      const started = Date.now();
      const { stdout, stderr, exitCode, timedOut } = await spawnDocker(args, request.stdin ?? "", calculateDockerCliTimeoutMs(timeoutMs));
      const normalized = normalizeSandboxResult({
        request_id: request.request_id,
        status: timedOut || exitCode === 124 ? "timeout" : inferStatus(exitCode, stderr),
        exit_code: exitCode,
        stdout,
        stderr,
        traceback: stderr,
        duration_ms: Date.now() - started,
        truncated: stdout.length + stderr.length > this.config.outputBytes,
      });
      return truncateResult(normalized, request.limits?.output_bytes ?? this.config.outputBytes);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
}

export function normalizeSandboxResult(result: SandboxResult): SandboxResult {
  const clean = (value: string) => redactText(value
    .replace(/[A-Za-z]:[\\/][^\s"']*main\.py/g, "<student-code>")
    .replace(/\/(?:tmp|work|private)\/[^\s"']*main\.py/g, "<student-code>")
    .replace(/[A-Za-z]:[\\/][^\s"']*test_public\.py/g, "<public-test>")
    .replace(/\/(?:tmp|work|private)\/[^\s"']*test_public\.py/g, "<public-test>")
    .replace(/\/tmp\/sandbox-[^\s"']+/g, "<student-code>"), 20000);
  return {
    ...result,
    stdout: clean(result.stdout),
    stderr: clean(result.stderr),
    traceback: clean(result.traceback || result.stderr),
    test_results: result.test_results?.map((test) => ({ ...test, message: clean(test.message) })),
  };
}

function writeSandboxFiles(workDir: string, request: SandboxRunRequest): void {
  writeFileSync(join(workDir, "main.py"), request.code, "utf8");
  for (const file of request.files ?? []) {
    assertSandboxFilePath(file.path);
    writeFileSync(join(workDir, file.path), file.content, "utf8");
  }
}

function spawnDocker(args: string[], stdin: string, timeoutMs: number): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"], shell: false, windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGKILL");
      resolve({ stdout, stderr, exitCode: 124, timedOut: true });
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new DockerUnavailableError(error.message));
    });
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("close", (code) => {
      if (settled) return;
      clearTimeout(timer);
      if (/Cannot connect to the Docker daemon|docker API|daemon unavailable|not found/i.test(stderr)) {
        reject(new DockerUnavailableError(stderr));
        return;
      }
      resolve({ stdout, stderr, exitCode: code ?? 1, timedOut: false });
    });
    child.stdin.end(stdin);
  });
}

function inferStatus(exitCode: number, stderr: string): SandboxResult["status"] {
  if (exitCode === 0) return "passed";
  if (/SyntaxError|IndentationError/.test(stderr)) return "syntax_error";
  if (/MemoryError|Killed/.test(stderr)) return "resource_limit";
  if (/Traceback/.test(stderr)) return "runtime_error";
  return "failed";
}

function truncateResult(result: SandboxResult, maxBytes: number): SandboxResult {
  const truncate = (value: string) => (Buffer.byteLength(value, "utf8") > maxBytes ? `${value.slice(0, maxBytes)}\n[truncated]` : value);
  return {
    ...result,
    stdout: truncate(result.stdout),
    stderr: truncate(result.stderr),
    traceback: truncate(result.traceback ?? ""),
    truncated: result.truncated || Buffer.byteLength(result.stdout + result.stderr + result.traceback, "utf8") > maxBytes,
  };
}
