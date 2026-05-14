import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const rootDirectory = path.resolve(currentDirectory, "..");
const logsDirectory = path.join(rootDirectory, ".pulsebridge");
const stdoutPath = path.join(logsDirectory, "server.out.log");
const stderrPath = path.join(logsDirectory, "server.err.log");
const pidPath = path.join(logsDirectory, "server.pid");
const healthUrl = "http://localhost:4000/health";

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const canReachHealth = async () => {
  try {
    const response = await fetch(healthUrl);
    return response.ok;
  } catch {
    return false;
  }
};

const readTail = (filePath) => {
  if (!existsSync(filePath)) {
    return "";
  }

  const content = readFileSync(filePath, "utf8").trim();
  if (!content) {
    return "";
  }

  const lines = content.split(/\r?\n/);
  return lines.slice(-20).join("\n");
};

const openBrowser = () => {
  const child = spawn("cmd.exe", ["/c", "start", "", "http://localhost:4000"], {
    cwd: rootDirectory,
    detached: true,
    stdio: "ignore"
  });

  child.unref();
};

const main = async () => {
  mkdirSync(logsDirectory, { recursive: true });

  if (await canReachHealth()) {
    console.log("PulseBridge is already running.");
    openBrowser();
    return;
  }

  const serverEntryPath = path.join(rootDirectory, "server", "dist", "index.js");

  if (!existsSync(serverEntryPath)) {
    console.error("Missing built server file. Run launch.cmd first.");
    process.exit(1);
  }

  const stdoutFd = openSync(stdoutPath, "w");
  const stderrFd = openSync(stderrPath, "w");

  const child = spawn(process.execPath, [serverEntryPath], {
    cwd: rootDirectory,
    detached: true,
    stdio: ["ignore", stdoutFd, stderrFd]
  });

  child.unref();
  writeFileSync(pidPath, String(child.pid));

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await sleep(1500);

    if (await canReachHealth()) {
      console.log("PulseBridge server is ready.");
      openBrowser();
      return;
    }
  }

  console.error("PulseBridge server did not become healthy.");

  const stdoutTail = readTail(stdoutPath);
  const stderrTail = readTail(stderrPath);

  if (stdoutTail) {
    console.error("\nLast server output:\n" + stdoutTail);
  }

  if (stderrTail) {
    console.error("\nLast server errors:\n" + stderrTail);
  }

  process.exit(1);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
