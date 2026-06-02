#!/usr/bin/env node
/** 将 server/ 同步到 make-server-2914ec93/（部署用 index.ts） */
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fn = join(root, "supabase", "functions");
const src = join(fn, "server");
const dst = join(fn, "make-server-2914ec93");

let index = readFileSync(join(src, "index.tsx"), "utf8");
index = index.replace("./kv_store.tsx", "./kv_store.ts");
writeFileSync(join(dst, "index.ts"), index, "utf8");
copyFileSync(join(src, "kv_store.tsx"), join(dst, "kv_store.ts"));
console.log("已同步 → supabase/functions/make-server-2914ec93/index.ts");
