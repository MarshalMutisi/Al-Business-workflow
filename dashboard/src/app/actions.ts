"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { api, ApiError, isValidKey, SESSION_COOKIE } from "@/lib/api";
import { safeRedirectPath } from "@/lib/format";

export type FormState = { error: string | null };

const WEEK = 60 * 60 * 24 * 7;

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const key = String(formData.get("key") ?? "").trim();
  if (!key) return { error: "Enter the admin API key." };

  let valid: boolean;
  try {
    valid = await isValidKey(key);
  } catch {
    return { error: "Cannot reach the API. Check that it is running and that API_URL is set." };
  }
  if (!valid) {
    await new Promise((resolve) => setTimeout(resolve, 500)); // slow down guessing
    return { error: "That key was not accepted." };
  }

  (await cookies()).set(SESSION_COOKIE, key, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WEEK,
  });
  redirect(safeRedirectPath(formData.get("next")));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// Browsers submit textarea line breaks as \r\n, so compare replies with normalised line endings.
function normalise(text: FormDataEntryValue | null): string {
  return typeof text === "string" ? text.replace(/\r\n/g, "\n").trim() : "";
}

export async function decideApproval(emailId: string, _: FormState, formData: FormData): Promise<FormState> {
  const approved = formData.get("decision") === "approve";
  const reviewer = String(formData.get("reviewer") ?? "").trim();
  if (!reviewer) return { error: "Enter your name as the reviewer." };

  const reply = normalise(formData.get("reply"));
  const editedReply = approved && reply && reply !== normalise(formData.get("original_reply")) ? reply : null;

  try {
    // api() verifies the session: server actions are reachable by direct POST, not only from this UI.
    await api(`/emails/${encodeURIComponent(emailId)}/approval`, {
      method: "POST",
      body: JSON.stringify({
        approved,
        reviewer,
        note: String(formData.get("note") ?? "").trim() || null,
        edited_reply: editedReply,
      }),
    });
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }

  // Pre-fill the reviewer name next time.
  (await cookies()).set("reviewer", reviewer, { sameSite: "strict", path: "/", maxAge: WEEK * 52 });
  revalidatePath("/", "layout");
  return { error: null };
}

export async function retryEmail(emailId: string): Promise<FormState> {
  try {
    await api(`/emails/${encodeURIComponent(emailId)}/retry`, { method: "POST" });
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  return { error: null };
}
