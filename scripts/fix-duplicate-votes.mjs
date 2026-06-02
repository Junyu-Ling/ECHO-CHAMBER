#!/usr/bin/env node
/**
 * 检查并修复「同一设备对一首歌多条留言/投票」的脏数据。
 *
 * 用法：
 *   node scripts/fix-duplicate-votes.mjs          # 仅报告
 *   node scripts/fix-duplicate-votes.mjs --apply  # 写回（需 SUPABASE_SERVICE_ROLE_KEY）
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const infoPath = join(root, "utils/supabase/info.tsx");
const info = readFileSync(infoPath, "utf8");
const projectId = info.match(/projectId = "([^"]+)"/)?.[1];
const anonKey = info.match(/publicAnonKey = "([^"]+)"/)?.[1];

const TABLE = "kv_store_2914ec93";
const apply = process.argv.includes("--apply");

function commentSortKey(c) {
  const m = /^(\d{10,13})/.exec(c.commentId || "");
  const fromId = m ? Number(m[1]) : 0;
  const ts = typeof c.createdAt === "number" ? c.createdAt : fromId < 1e12 ? fromId * 1000 : fromId;
  return ts || 0;
}

function dedupeOwnerComments(comments) {
  const withoutOwner = comments.filter((c) => !c.ownerId);
  const byOwner = new Map();
  for (const c of comments) {
    if (!c.ownerId) continue;
    const list = byOwner.get(c.ownerId) || [];
    list.push(c);
    byOwner.set(c.ownerId, list);
  }
  const kept = [...withoutOwner];
  for (const [ownerId, list] of byOwner) {
    if (list.length === 1) {
      kept.push(list[0]);
      continue;
    }
    const messages = list.filter((c) => c.isVote !== true);
    const pick =
      messages.length > 0
        ? messages.sort((a, b) => commentSortKey(a) - commentSortKey(b))[0]
        : [...list].sort((a, b) => commentSortKey(a) - commentSortKey(b))[0];
    kept.push(pick);
    console.log(
      `  - 去重 owner ${ownerId}: ${list.length} → 1（保留 ${pick.commentId}）`
    );
  }
  return kept.sort((a, b) => commentSortKey(b) - commentSortKey(a));
}

function fixTrack(req) {
  const before = req.comments?.length ?? 0;
  const comments = dedupeOwnerComments(req.comments || []);
  const after = comments.length;
  if (after === before) return null;
  return {
    ...req,
    comments,
    votes: comments.length,
    updatedAt: Date.now(),
  };
}

async function loadViaEdge() {
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-2914ec93/requests`,
    {
      headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
    }
  );
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Edge list failed");
  return json.data || [];
}

async function loadViaDb(serviceKey) {
  const supabase = createClient(
    `https://${projectId}.supabase.co`,
    serviceKey
  );
  const { data, error } = await supabase
    .from(TABLE)
    .select("key, value")
    .like("key", "req:%");
  if (error) throw error;
  return data.map((row) => ({ key: row.key, value: row.value }));
}

async function main() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  let rows;

  if (serviceKey) {
    console.log("从数据库读取 kv_store…");
    rows = await loadViaDb(serviceKey);
  } else {
    console.log("从 Edge API 读取（无 service role 时无法 --apply）…");
    const list = await loadViaEdge();
    rows = list.map((v) => ({ key: `req:${v.id}`, value: v }));
  }

  let fixCount = 0;
  const updates = [];

  for (const row of rows) {
    const fixed = fixTrack(row.value);
    if (!fixed) continue;
    fixCount++;
    console.log(
      `\n${row.key} 《${fixed.song}》: ${row.value.comments.length} 条 → ${fixed.comments.length} 条`
    );
    updates.push({ key: row.key, value: fixed });
  }

  if (fixCount === 0) {
    console.log("\n未发现重复投票/留言，数据正常。");
    return;
  }

  console.log(`\n共 ${fixCount} 首歌需要修正。`);

  if (!apply) {
    console.log("加上 --apply 且设置 SUPABASE_SERVICE_ROLE_KEY 可写回数据库。");
    return;
  }

  if (!serviceKey) {
    console.error("写回需要 SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(
    `https://${projectId}.supabase.co`,
    serviceKey
  );
  for (const u of updates) {
    const { error } = await supabase.from(TABLE).upsert({ key: u.key, value: u.value });
    if (error) throw error;
  }
  console.log("已写回数据库。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
