#!/usr/bin/env node
/**
 * Stage, commit (if needed), and push to origin/ECHO-CHAMBER.
 * Set GITHUB_REPO once via scripts/setup-github-remote.ps1
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BRANCH = "ECHO-CHAMBER";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...opts }).trim();
}

function hasRemote() {
  try {
    run("git remote get-url origin");
    return true;
  } catch {
    return false;
  }
}

if (!existsSync(`${root}/.git`)) {
  console.error("[git-sync] Not a git repository. Run: git init");
  process.exit(1);
}

if (!hasRemote()) {
  console.error(
    "[git-sync] No origin remote. Run once:\n  powershell -File scripts/setup-github-remote.ps1 -RepoUrl https://github.com/YOU/REPO.git"
  );
  process.exit(1);
}

try {
  run(`git rev-parse --verify ${BRANCH}`);
} catch {
  run(`git checkout -b ${BRANCH}`);
}

const current = run("git branch --show-current");
if (current !== BRANCH) {
  run(`git checkout ${BRANCH}`);
}

const status = run("git status --porcelain");
if (!status) {
  console.log("[git-sync] Working tree clean — nothing to push.");
  try {
    run(`git push origin ${BRANCH}`);
    console.log("[git-sync] Push OK (up to date).");
  } catch (e) {
    console.error(String(e.stderr || e.message));
    process.exit(1);
  }
  process.exit(0);
}

run("git add -A");
const msg =
  process.env.GIT_SYNC_MESSAGE ||
  `sync: ${new Date().toISOString().replace("T", " ").slice(0, 19)}`;
const commit = spawnSync("git", ["commit", "-m", msg], { cwd: root, encoding: "utf8" });
if (commit.status !== 0) {
  console.error(commit.stderr || commit.stdout);
  process.exit(commit.status ?? 1);
}

const push = spawnSync("git", ["push", "-u", "origin", BRANCH], { cwd: root, encoding: "utf8" });
if (push.status !== 0) {
  console.error(push.stderr || push.stdout);
  process.exit(push.status ?? 1);
}

console.log(`[git-sync] Committed and pushed to origin/${BRANCH}`);
