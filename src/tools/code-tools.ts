import type { AppRuntime, SandboxResult, ToolEnvelope } from "../types.js";
import { AppError } from "../types.js";
import { createId } from "../security/ids.js";
import { assertSandboxFilePath } from "../security/path.js";
import { errorEnvelope, okEnvelope } from "./envelope.js";
import { assertValid, RunPythonParams, RunPytestParams } from "./schemas.js";

export async function runPython(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<SandboxResult>> {
  const started = Date.now();
  try {
    const input = assertValid<{ code: string; stdin?: string; files?: Array<{ path: string; content: string }>; limits?: { timeout_ms?: number; memory_mb?: number; output_bytes?: number } }>(RunPythonParams, params);
    validateSandboxFiles(input.files);
    const result = await runtime.sandbox.runPython({
      request_id: createId("run"),
      code: input.code,
      stdin: input.stdin,
      files: input.files,
      limits: clampPythonLimits(runtime, input.limits),
    });
    if (result.status === "sandbox_error") {
      throw new AppError("SANDBOX_INTERNAL_ERROR", "沙箱服务暂时不可用，代码没有在宿主机上执行。", 503, true);
    }
    return okEnvelope("run_python", started, result, result.status);
  } catch (error) {
    return errorEnvelope("run_python", started, error, emptySandboxResult());
  }
}

export async function runPytest(runtime: AppRuntime, params: unknown): Promise<ToolEnvelope<SandboxResult>> {
  const started = Date.now();
  try {
    const input = assertValid<{ code: string; public_tests: string; limits?: { timeout_ms?: number; memory_mb?: number } }>(RunPytestParams, params);
    const result = await runtime.sandbox.runPytest({
      request_id: createId("run"),
      code: input.code,
      public_tests: input.public_tests,
      files: [],
      limits: {
        timeout_ms: Math.min(input.limits?.timeout_ms ?? runtime.config.sandboxHardLimits.pytestTimeoutMs, runtime.config.sandboxHardLimits.pytestTimeoutMs),
        memory_mb: Math.min(input.limits?.memory_mb ?? runtime.config.sandboxHardLimits.memoryMb, runtime.config.sandboxHardLimits.memoryMb),
      },
    });
    if (result.status === "sandbox_error") {
      throw new AppError("SANDBOX_INTERNAL_ERROR", "沙箱服务暂时不可用，测试没有在宿主机上执行。", 503, true);
    }
    return okEnvelope("run_pytest", started, result, result.status);
  } catch (error) {
    return errorEnvelope("run_pytest", started, error, emptySandboxResult());
  }
}

function validateSandboxFiles(files?: Array<{ path: string; content: string }>): void {
  for (const file of files ?? []) {
    assertSandboxFilePath(file.path);
  }
}

function clampPythonLimits(runtime: AppRuntime, limits?: { timeout_ms?: number; memory_mb?: number; output_bytes?: number }) {
  return {
    timeout_ms: Math.min(limits?.timeout_ms ?? runtime.config.sandboxHardLimits.timeoutMs, runtime.config.sandboxHardLimits.timeoutMs),
    memory_mb: Math.min(limits?.memory_mb ?? runtime.config.sandboxHardLimits.memoryMb, runtime.config.sandboxHardLimits.memoryMb),
    output_bytes: Math.min(limits?.output_bytes ?? runtime.config.sandboxHardLimits.outputBytes, runtime.config.sandboxHardLimits.outputBytes),
  };
}

function emptySandboxResult(): SandboxResult {
  return {
    status: "sandbox_error",
    exit_code: 1,
    stdout: "",
    stderr: "",
    traceback: "",
    duration_ms: 0,
    truncated: false,
    test_results: [],
  };
}
