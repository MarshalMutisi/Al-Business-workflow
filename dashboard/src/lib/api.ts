import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// The dashboard talks only to FastAPI, never to Supabase. Calls run on the Next.js server,
// so the admin key stays in an httpOnly cookie and never reaches browser JavaScript.
export const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const SESSION_COOKIE = "admin_key";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Checks a key against the API. Throws if the API cannot be reached. */
export async function isValidKey(key: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/check`, { headers: { "X-API-Key": key }, cache: "no-store" });
  return res.ok;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!key) redirect("/login");

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "X-API-Key": key, "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 401) redirect("/login?expired=1");
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, typeof body?.detail === "string" ? body.detail : `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}
