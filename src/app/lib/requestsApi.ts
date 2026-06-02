import { projectId, publicAnonKey } from "../../../utils/supabase/info";

const SUPABASE_REQUESTS = `https://${projectId}.supabase.co/functions/v1/make-server-2914ec93/requests`;

function isLocalDevHost() {
  if (typeof window === "undefined") return import.meta.env.DEV;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/** Production uses Vercel `/api/requests`; local dev uses Supabase Edge Function. */
export const requestsApiBase =
  import.meta.env.VITE_REQUESTS_API ||
  (isLocalDevHost() ? SUPABASE_REQUESTS : "/api/requests");

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (publicAnonKey) {
    headers.Authorization = `Bearer ${publicAnonKey}`;
    headers.apikey = publicAnonKey;
  }
  return headers;
}

export async function postRequestsBody(body: Record<string, unknown>) {
  const res = await fetch(requestsApiBase, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}
