import { loadConfig } from "../config.js";
import { DockerSandboxClient } from "./docker-runner.js";
import { createSandboxService } from "./service.js";

const config = loadConfig();
const port = Number(process.env.SANDBOX_PORT ?? 3001);
const host = process.env.SANDBOX_HOST ?? "127.0.0.1";
const sandbox = new DockerSandboxClient({
  image: config.sandboxImage,
  timeoutMs: config.sandboxHardLimits.timeoutMs,
  pytestTimeoutMs: config.sandboxHardLimits.pytestTimeoutMs,
  memoryMb: config.sandboxHardLimits.memoryMb,
  outputBytes: config.sandboxHardLimits.outputBytes,
});

createSandboxService(sandbox).listen(port, host, () => {
  console.log(`sandbox-service listening on http://${host}:${port}`);
});
