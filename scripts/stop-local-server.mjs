import { existsSync, readFileSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const rootDirectory = path.resolve(currentDirectory, "..");
const pidPath = path.join(rootDirectory, ".pulsebridge", "server.pid");

if (!existsSync(pidPath)) {
  console.log("No saved PulseBridge server process was found.");
  process.exit(0);
}

const pid = readFileSync(pidPath, "utf8").trim();

if (!pid) {
  rmSync(pidPath, { force: true });
  console.log("No saved PulseBridge server process was found.");
  process.exit(0);
}

spawnSync("taskkill", ["/PID", pid, "/T", "/F"], { stdio: "inherit" });
rmSync(pidPath, { force: true });
console.log("PulseBridge server stop requested.");
