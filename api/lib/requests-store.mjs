import { createClient } from "@supabase/supabase-js";

const TABLE = "kv_store_2914ec93";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

export async function kvGet(key) {
  const { data, error } = await getClient()
    .from(TABLE)
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value ?? null;
}

export async function kvSet(key, value) {
  const { error } = await getClient().from(TABLE).upsert({ key, value });
  if (error) throw new Error(error.message);
}

export async function kvDel(key) {
  const { error } = await getClient().from(TABLE).delete().eq("key", key);
  if (error) throw new Error(error.message);
}

export async function kvGetByPrefix(prefix) {
  const { data, error } = await getClient()
    .from(TABLE)
    .select("key, value")
    .like("key", `${prefix}%`);
  if (error) throw new Error(error.message);
  return data?.map((d) => d.value) ?? [];
}
