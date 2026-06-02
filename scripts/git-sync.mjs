#!/usr/bin/env node
/**
 * Stage, commit (if needed), push to origin/ECHO-CHAMBER and sync main.
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BRANCH = "ECHO-CHAMBER";
const SYNC_MAIN = "main";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || "LingJ",
  GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || "noreply@local",
  GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || process.env.GIT_AUTHOR_NAME || "LingJ",
  GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL || process.env.GIT_AUTHOR_EMAIL || "noreply@local",
};

function run(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: root,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: gitEnv,
    ...opts,
  }).trim();
}

function git(args) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8", env: gitEnv });
}

function hasRemote() {
  try {
    run("git remote get-url origin");
    return true;
  } catch {
    return false;
  }
}

if (!existsSync(join(root, ".git"))) {
  console.error("[git-sync] Not a git repository.");
  process.exit(1);
}

if (!hasRemote()) {
  console.error(
    "[git-sync] No origin. Run:\n  powershell -File scripts/setup-github-remote.ps1 -RepoUrl https://github.com/Miyeon-0131/ECHO-CHAMBER.git"
  );
  process.exit(1);
}

try {
  run(`git rev-parse --verify ${BRANCH}`);
} catch {
  run(`git checkout -b ${BRANCH}`);
}

if (run("git branch --show-current") !== BRANCH) {
  run(`git checkout ${BRANCH}`);
}

const status = run("git status --porcelain");
if (status) {
  run("git add -A");
  const msg =
    process.env.GIT_SYNC_MESSAGE ||
    `sync: ${new Date().toISOString().replace("T", " ").slice(0, 19)}`;
  const commit = git(["commit", "-m", msg]);
  if (commit.status !== 0) {
    const out = `${commit.stderr || ""}${commit.stdout || ""}`.trim();
    if (!out.includes("nothing to commit")) {
      console.error("[git-sync] Commit failed:\n", out);
      process.exit(commit.status ?? 1);
    }
  } else {
    console.log(`[git-sync] Committed: ${msg}`);
  }
} else {
  console.log("[git-sync] Working tree clean.");
}

for (const ref of [BRANCH, `${BRANCH}:${SYNC_MAIN}`]) {
  const push = git(["push", "-u", "origin", ref]);
  if (push.status !== 0) {
    console.error(`[git-sync] Push failed (origin ${ref}):\n`, push.stderr || push.stdout);
    process.exit(push.status ?? 1);
  }
}

console.log(`[git-sync] Pushed to origin/${BRANCH} and origin/${SYNC_MAIN}`);
