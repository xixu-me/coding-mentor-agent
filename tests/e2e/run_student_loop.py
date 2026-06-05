from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]


def main() -> int:
    run_id = os.environ.get("STUDENT_LOOP_RUN_ID") or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    port = int(os.environ.get("PORT") or find_free_port())
    run_dir = REPO_ROOT / ".app" / "student-loop" / "runs" / run_id
    base_url = f"http://127.0.0.1:{port}"
    env = {
        **os.environ,
        "AI_PROVIDER": "",
        "AI_MODEL": "",
        "AI_API_KEY": "",
        "AI_BASE_URL": "",
        "LLM_PROVIDER": "",
        "LLM_MODEL": "",
        "LLM_API_KEY": "",
        "LLM_RESPONSES_ENDPOINT": "",
        "PORT": str(port),
        "BASE_URL": base_url,
        "STUDENT_LOOP_RUN_ID": run_id,
        "STUDENT_LOOP_EVIDENCE_MODE": "local_only",
        "APP_DATA_DIR": str(run_dir / "data"),
        "PROGRESS_DB_PATH": str(run_dir / "data" / "progress.db"),
        "STUDENT_LOOP_ARTIFACT_DIR": str(run_dir / "artifacts"),
    }
    run_dir.mkdir(parents=True, exist_ok=True)
    artifact_dir = run_dir / "artifacts"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    startup_log_path = artifact_dir / "server-startup.log"

    with startup_log_path.open("wb") as startup_log:
        server = subprocess.Popen(
            [npm_executable(), "start"],
            cwd=REPO_ROOT,
            env=env,
            stdout=startup_log,
            stderr=subprocess.STDOUT,
        )
        try:
            wait_for_http_ready(base_url, server, timeout_seconds=45, startup_log_path=startup_log_path)
            return subprocess.call([sys.executable, str(SCRIPT_DIR / "student_loop.py")], cwd=REPO_ROOT, env=env)
        finally:
            stop_process(server)


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def npm_executable() -> str:
    command = shutil.which("npm") or shutil.which("npm.cmd")
    if not command:
        raise FileNotFoundError("npm executable was not found on PATH")
    return command


def wait_for_http_ready(
    base_url: str,
    server: subprocess.Popen[bytes],
    *,
    timeout_seconds: int,
    startup_log_path: Path,
) -> None:
    deadline = time.time() + timeout_seconds
    last_error = ""
    while time.time() < deadline:
        if server.poll() is not None:
            startup_log_tail = tail_file_text(startup_log_path)
            raise RuntimeError(
                "server exited before HTTP readiness check completed: "
                f"{server.returncode}; startup log: {startup_log_path}; tail: {startup_log_tail}"
            )
        try:
            with urlopen(base_url, timeout=1.0) as response:
                if 200 <= int(response.status) < 500:
                    return
        except HTTPError as error:
            last_error = f"HTTP {error.code}"
            if 400 <= int(error.code) < 500:
                return
        except (OSError, URLError) as error:
            last_error = f"{type(error).__name__}: {error}"
        time.sleep(0.25)
    suffix = f": {last_error}" if last_error else ""
    startup_log_tail = tail_file_text(startup_log_path)
    raise TimeoutError(
        f"server did not become HTTP-ready at {base_url} within {timeout_seconds}s{suffix}; "
        f"startup log: {startup_log_path}; tail: {startup_log_tail}"
    )


def tail_file_text(path: Path, *, limit: int = 4000) -> str:
    try:
        data = path.read_bytes()
    except OSError as error:
        return f"<unable to read startup log: {type(error).__name__}: {error}>"
    if not data:
        return "<empty startup log>"
    return data[-limit:].decode("utf-8", errors="replace").replace("\r", "")


def stop_process(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=10)
        return
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=10)


if __name__ == "__main__":
    raise SystemExit(main())
