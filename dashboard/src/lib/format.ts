const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const number = new Intl.NumberFormat("en-US");

/** "awaiting_approval" -> "Awaiting approval" */
export function humanize(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : "—";
}

export function formatNumber(value: number): string {
  return number.format(value);
}

export function formatPercent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

/** Only allow same-site relative paths as a post-login redirect target. */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  return value;
}
