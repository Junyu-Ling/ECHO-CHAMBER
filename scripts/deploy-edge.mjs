#!/usr/bin/env node
/**
 * 方案 B：部署 make-server-2914ec93 Edge Function
 *
 * 用法（二选一）：
 *   1. 先登录：npx supabase login  →  pnpm deploy:edge
 *   2. 用令牌：在 https://supabase.com/dashboard/account/tokens 创建 token，然后：
 *      $env:SUPABASE_ACCESS_TOKEN="sbp_..."   # PowerShell
 *      pnpm deploy:edge
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectRef = "fmhxulxydthrldwuavuc";
const fnDir = join(root, "supabase", "functions", "make-server-2914ec93", "index.ts");

if (!existsSync(fnDir)) {
  console.error("缺少 Edge 入口 index.ts（CLI 不认 .tsx）:", fnDir);
  process.exit(1);
}

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (token) {
  console.log("使用 SUPABASE_ACCESS_TOKEN 登录 CLI…");
  const login = spawnSync(
    "npx",
    ["supabase", "login", "--token", token],
    { cwd: root, stdio: "inherit", shell: true }
  );
  if (login.status !== 0) process.exit(login.status ?? 1);
}

console.log("\n部署 Edge Function: make-server-2914ec93 …\n");
const deploy = spawnSync(
  "npx",
  [
    "supabase",
    "functions",
    "deploy",
    "make-server-2914ec93",
    "--project-ref",
    projectRef,
  ],
  { cwd: root, stdio: "inherit", shell: true }
);

if (deploy.status !== 0) {
  console.error(`
部署失败。若提示未登录，请任选其一：

  A) 在本机 PowerShell（可开浏览器）执行：
     cd "${root}"
     npx supabase login
     pnpm deploy:edge

  B) 创建 Personal Access Token 后执行：
     $env:SUPABASE_ACCESS_TOKEN="你的sbp_令牌"
     pnpm deploy:edge

令牌页面: https://supabase.com/dashboard/account/tokens
`);
  process.exit(deploy.status ?? 1);
}

console.log("\n部署完成。验证：点赞 POST 不应再创建 comments:[] 的空歌曲。");
