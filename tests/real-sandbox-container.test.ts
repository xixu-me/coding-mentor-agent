import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { DockerSandboxClient } from "../src/sandbox/docker-runner.js";

const REAL_SANDBOX_IMAGE = process.env.SANDBOX_IMAGE ?? "coding-mentor-python-runner:0.1.0";

describe("real one-shot sandbox container", () => {
  it("runs student Python in the fixed Docker runner image", async () => {
    const info = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8" });
    expect(info.status, `Docker daemon is required for the sandbox release gate: ${info.stderr}`).toBe(0);

    const image = spawnSync("docker", ["image", "inspect", REAL_SANDBOX_IMAGE], { encoding: "utf8" });
    expect(image.status, `Build ${REAL_SANDBOX_IMAGE} before running this test`).toBe(0);

    const sandbox = new DockerSandboxClient({
      image: REAL_SANDBOX_IMAGE,
      timeoutMs: 3000,
      pytestTimeoutMs: 8000,
      memoryMb: 128,
      outputBytes: 20000,
    });
    const result = await sandbox.runPython({
      request_id: "run_real_container",
      code: "print('hello from sandbox')\n",
    });

    expect(result.status).toBe("passed");
    expect(result.stdout).toBe("hello from sandbox\n");
    expect(result.stderr).toBe("");
  }, 60000);

  it("blocks outbound network access inside the real runner container", async () => {
    const sandbox = new DockerSandboxClient({
      image: REAL_SANDBOX_IMAGE,
      timeoutMs: 3000,
      pytestTimeoutMs: 8000,
      memoryMb: 128,
      outputBytes: 20000,
    });
    const result = await sandbox.runPython({
      request_id: "run_real_network_block",
      code: [
        "import socket",
        "sock = socket.socket()",
        "sock.settimeout(1)",
        "try:",
        "    sock.connect(('1.1.1.1', 80))",
        "    print('network-open')",
        "except OSError as exc:",
        "    print(type(exc).__name__)",
      ].join("\n"),
    });

    expect(result.status).toBe("passed");
    expect(result.stdout).not.toContain("network-open");
  }, 60000);

  it("does not mount the host source tree, KB, database, or Docker socket into the runner", async () => {
    const sandbox = new DockerSandboxClient({
      image: REAL_SANDBOX_IMAGE,
      timeoutMs: 3000,
      pytestTimeoutMs: 8000,
      memoryMb: 128,
      outputBytes: 20000,
    });
    const result = await sandbox.runPython({
      request_id: "run_real_no_host_mounts",
      code: [
        "from pathlib import Path",
        "checks = {",
        "    'source_tree': '/work/package.json',",
        "    'kb_tree': '/work/kb',",
        "    'progress_db': '/work/.app/progress.db',",
        "    'docker_socket': '/var/run/docker.sock',",
        "}",
        "for label, path in checks.items():",
        "    print(label, Path(path).exists())",
      ].join("\n"),
    });

    expect(result.status).toBe("passed");
    expect(result.stdout).toContain("source_tree False");
    expect(result.stdout).toContain("kb_tree False");
    expect(result.stdout).toContain("progress_db False");
    expect(result.stdout).toContain("docker_socket False");
  }, 60000);
});
