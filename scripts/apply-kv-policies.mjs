#!/usr/bin/env node
/**
 * Prints SQL to enable anon read/write on kv_store_2914ec93.
 * Paste into Supabase Dashboard → SQL Editor → Run.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../supabase/migrations/20260602120000_kv_store_anon_policies.sql"),
  "utf8"
);

console.log("=== 请在 Supabase SQL Editor 中执行以下 SQL（只需一次）===\n");
console.log(sql);
console.log("\n项目: https://supabase.com/dashboard/project/fmhxulxydthrldwuavuc/sql/new");
