#!/usr/bin/env node
/**
 * 引导 Supabase CLI 登录并部署 Edge（需先在 Dashboard 创建 Access Token）
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const projectRef = "fmhxulxydthrldwuavuc";
const tokenUrl = "https://supabase.com/dashboard/account/tokens";
const sqlUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;

function run(cmd, args) {
  return spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: true });
}

function loadTokenFromEnvFile() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return "";
  const text = readFileSync(envPath, "utf8");
  const m = text.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
}

const token = (process.env.SUPABASE_ACCESS_TOKEN || loadTokenFromEnvFile()).trim();

console.log("=== Echo Chamber · Supabase 配置 ===\n");

if (!token) {
  console.log("1) 打开令牌页面，新建 Access Token（勾选需要的项目权限）:");
  console.log(`   ${tokenUrl}\n`);
  console.log("2) 在项目根目录创建 .env（可复制 .env.example），加入一行:");
  console.log("   SUPABASE_ACCESS_TOKEN=sbp_你的令牌\n");
  console.log("3) 再运行:");
  console.log("   pnpm setup:supabase\n");
  console.log("或在 PowerShell 临时设置后部署:");
  console.log('   $env:SUPABASE_ACCESS_TOKEN="sbp_..."');
  console.log("   pnpm deploy:edge\n");
  process.exit(1);
}

console.log("使用 SUPABASE_ACCESS_TOKEN 登录 CLI…");
const login = run("npx", ["supabase", "login", "--token", token]);
if (login.status !== 0) process.exit(login.status ?? 1);

console.log("\n部署 Edge Function make-server-2914ec93 …");
const deploy = run("npx", [
  "supabase",
  "functions",
  "deploy",
  "make-server-2914ec93",
  "--project-ref",
  projectRef,
]);
if (deploy.status !== 0) process.exit(deploy.status ?? 1);

const sql = readFileSync(
  join(root, "supabase/migrations/20260602120000_kv_store_anon_policies.sql"),
  "utf8"
);
console.log("\n✓ Edge 已部署。若留言/点赞仍失败，请在 SQL Editor 执行一次策略 SQL:\n");
console.log(sqlUrl);
console.log("\n" + sql);
