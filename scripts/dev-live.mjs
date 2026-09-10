import { accessSync, constants, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultPython = path.join(projectRoot, "backend", ".venv", "bin", "python");
const python = process.env.PYTHON_BIN || defaultPython;
const projectEnv = path.join(projectRoot, ".env");
const localPldEnv = path.resolve(projectRoot, "..", "pld_calculator", ".env");
const dorisEnvFile = process.env.PRECOOL_DORIS_ENV_FILE || (existsSync(projectEnv) ? projectEnv : localPldEnv);

try {
  accessSync(python, constants.X_OK);
} catch {
  console.error("Doris API Python environment is missing. Create backend/.venv and install backend/requirements.txt.");
  process.exit(1);
}

const children = [];
const api = spawn(python, [path.join(projectRoot, "backend", "app.py")], {
  cwd: projectRoot,
  env: {...process.env, PRECOOL_DORIS_ENV_FILE: dorisEnvFile},
  stdio: "inherit",
});
children.push(api);

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const frontend = spawn(npmCommand, ["run", "dev:frontend"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    DORIS_API_BASE_URL: process.env.DORIS_API_BASE_URL || "http://127.0.0.1:8788",
  },
  stdio: "inherit",
});
children.push(frontend);

let shuttingDown = false;
function stop(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stop(signal));
}

for (const child of children) {
  child.on("exit", (code) => {
    if (!shuttingDown) {
      stop();
      process.exitCode = code ?? 1;
    }
  });
}
