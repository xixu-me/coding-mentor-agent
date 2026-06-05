import { build } from "vite";
import { createRuntime } from "../runtime.js";
import { createApp } from "./app.js";

console.log("building client assets...");
await build({ configFile: "vite.config.ts" });

const runtime = createRuntime();
const server = createApp(runtime);

server.listen(runtime.port, "127.0.0.1", () => {
  console.log(`coding-mentor-agent listening on http://127.0.0.1:${runtime.port}`);
});

process.on("SIGINT", () => {
  server.close(() => {
    runtime.db.close();
    process.exit(0);
  });
});
