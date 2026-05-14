import { copyFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDirectory = path.resolve(__dirname, "..");
const serverEnvPath = path.join(rootDirectory, "server", ".env");
const serverEnvExamplePath = path.join(rootDirectory, "server", ".env.example");
const schemaPath = path.join(rootDirectory, "server", "supabase", "schema.sql");

const mode = process.argv[2] ?? "check";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const parseEnvFile = (filePath) => {
  const raw = readFileSync(filePath, "utf8");
  const entries = {};

  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    entries[key] = value;
  });

  return entries;
};

const ensureServerEnv = () => {
  if (existsSync(serverEnvPath)) {
    console.log("server/.env already exists.");
    return false;
  }

  mkdirSync(path.dirname(serverEnvPath), { recursive: true });
  copyFileSync(serverEnvExamplePath, serverEnvPath);
  console.log("Created server/.env from server/.env.example.");
  return true;
};

const validateServerEnv = () => {
  if (!existsSync(serverEnvPath)) {
    return {
      ok: false,
      issues: ["server/.env is missing. Run `npm run setup` first."]
    };
  }

  const env = parseEnvFile(serverEnvPath);
  const issues = [];
  const databaseUrl = env.DATABASE_URL ?? "";
  const jwtSecret = env.JWT_SECRET ?? "";

  if (!databaseUrl || databaseUrl.includes("<password>") || databaseUrl.includes("<project-ref>")) {
    issues.push("Set DATABASE_URL in server/.env to your real Supabase Postgres connection string.");
  }

  if (!jwtSecret || jwtSecret === "replace-with-a-long-random-secret") {
    issues.push("Set JWT_SECRET in server/.env to a long random secret.");
  }

  return {
    ok: issues.length === 0,
    issues
  };
};

const printValidationResult = () => {
  const result = validateServerEnv();

  if (result.ok) {
    console.log("Unified app config looks good.");
    console.log(`Remember to apply the Supabase schema at ${schemaPath} if you have not already.`);
    return true;
  }

  console.error("Unified app config is incomplete:");
  result.issues.forEach((issue) => {
    console.error(`- ${issue}`);
  });
  console.error(`Apply the SQL schema from ${schemaPath} in your Supabase project before first run.`);
  return false;
};

const runNpm = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(npmCommand, args, {
      cwd: rootDirectory,
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`npm ${args.join(" ")} failed with exit code ${code ?? "unknown"}.`));
    });
  });

const runServer = () =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(rootDirectory, "server", "dist", "index.js")], {
      cwd: rootDirectory,
      stdio: "inherit"
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code) => {
      reject(new Error(`server exited with code ${code ?? "unknown"}.`));
    });
  });

const main = async () => {
  if (mode === "setup") {
    ensureServerEnv();
    printValidationResult();
    return;
  }

  if (mode === "check") {
    const isValid = printValidationResult();

    if (!isValid) {
      process.exitCode = 1;
    }

    return;
  }

  if (mode === "launch") {
    ensureServerEnv();

    if (!printValidationResult()) {
      process.exitCode = 1;
      return;
    }

    await runNpm(["run", "build"]);
    await runServer();
    return;
  }

  console.error(`Unknown mode: ${mode}`);
  console.error("Use one of: setup, check, launch");
  process.exitCode = 1;
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
