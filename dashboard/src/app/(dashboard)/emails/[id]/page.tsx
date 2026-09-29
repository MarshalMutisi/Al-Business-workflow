import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";

import { AutoRefresh } from "@/components/auto-refresh";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, formatPercent, humanize } from "@/lib/format";
import type { EmailDetail } from "@/lib/types";
import { ApprovalForm, RetryForm } from "./decision-forms";

export const metadata: Metadata = { title: "Email" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getEmail(id: string): Promise<EmailDetail> {
  if (!UUID.test(id)) notFound();
  try {
    return await api<EmailDetail>(`/emails/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

function Params({ params }: { params: Record<string, unknown> }) {
  const entries = Object.entries(params).filter(([, v]) => v !== null && v !== "");
  if (!entries.length) return null;
  return (
    <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-muted-foreground">{humanize(key)}</dt>
          <dd className="break-words">{typeof value === "string" ? value : JSON.stringify(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function EmailPage({ params }: PageProps<"/emails/[id]">) {
  const { id } = await params;
  const email = await getEmail(id);
  const reviewer = (await cookies()).get("reviewer")?.value ?? "";
  const { classification: c, extracted, plan } = email;
  const working = email.status === "received" || email.status === "processing";

  return (
    <>
      {working && <AutoRefresh />}
      <div className="space-y-3">
        <Link href="/emails" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Emails
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight">{email.subject}</h1>
          <StatusBadge status={email.status} className="h-6 text-sm" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {email.status === "awaiting_approval" && plan && (
            <Card className="ring-2 ring-status-warning/60">
              <CardHeader>
                <CardTitle>Your decision</CardTitle>
                <CardDescription>
                  Paused because: {(plan.approval_reasons ?? []).join("; ") || "approval required"}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ApprovalForm
                  emailId={email.id}
                  replyDraft={plan.reply_draft}
                  sendsReply={plan.actions.some((a) => a.type === "send_reply")}
                  defaultReviewer={reviewer}
                />
              </CardContent>
            </Card>
          )}

          {email.status === "failed" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TriangleAlert className="size-5 text-status-critical" aria-hidden /> Agent run failed
                </CardTitle>
                {email.error && <CardDescription className="break-words font-mono text-xs">{email.error}</CardDescription>}
              </CardHeader>
              <CardContent>
                <RetryForm emailId={email.id} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Message</CardTitle>
              <CardDescription>
                From {email.from_name ? `${email.from_name} <${email.from_email}>` : email.from_email} to {email.to_email} ·{" "}
                {formatDateTime(email.received_at)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{email.body_text}</p>
            </CardContent>
          </Card>

          {plan && (
            <Card>
              <CardHeader>
                <CardTitle>Plan</CardTitle>
                <CardDescription>{plan.reasoning}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <ol className="space-y-3">
                  {plan.actions.map((action, i) => (
                    <li key={i} className="rounded-lg border p-3">
                      <span className="text-sm font-medium">
                        {i + 1}. {humanize(action.type)}
                      </span>
                      <Params params={action.params ?? {}} />
                    </li>
                  ))}
                  {plan.actions.length === 0 && <li className="text-sm text-muted-foreground">No actions planned.</li>}
                </ol>
                {plan.reply_draft && email.status !== "awaiting_approval" && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">
                      Reply {plan.ai_reply_draft ? "(edited by reviewer)" : "draft"}
                    </h3>
                    <p className="whitespace-pre-wrap break-words rounded-lg bg-muted p-3 font-mono text-sm">{plan.reply_draft}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {c ? (
                <dl className="grid grid-cols-2 gap-4">
                  <Field label="Category">{humanize(c.category)}</Field>
                  <Field label="Confidence">{formatPercent(c.confidence)}</Field>
                  <Field label="Urgency">
                    <StatusBadge status={c.urgency} />
                  </Field>
                  <Field label="Sentiment">{humanize(c.sentiment)}</Field>
                  {extracted && (
                    <>
                      <div className="col-span-2">
                        <Field label="Summary">{extracted.summary}</Field>
                      </div>
                      {extracted.customer_name && <Field label="Customer">{extracted.customer_name}</Field>}
                      {extracted.order_id && <Field label="Order">{extracted.order_id}</Field>}
                      {extracted.product && <Field label="Product">{extracted.product}</Field>}
                      {extracted.amount !== null && <Field label="Amount">{extracted.amount}</Field>}
                    </>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Not classified yet.</p>
              )}
            </CardContent>
          </Card>

          {email.approval && (
            <Card>
              <CardHeader>
                <CardTitle>Decision</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>
                  {email.approval.approved ? "Approved" : "Rejected"} by {email.approval.reviewer}
                </p>
                {email.approval.note && <p className="text-muted-foreground">“{email.approval.note}”</p>}
              </CardContent>
            </Card>
          )}

          {(email.tickets.length > 0 || email.escalations.length > 0 || email.outbound_emails.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Created records</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  {email.tickets.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <Badge variant="secondary" className="mr-1.5">Ticket</Badge>
                        {t.subject}
                      </span>
                      <StatusBadge status={t.status} />
                    </li>
                  ))}
                  {email.escalations.map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <Badge variant="secondary" className="mr-1.5">Escalation</Badge>
                        {e.reason}
                      </span>
                      <StatusBadge status={e.status} />
                    </li>
                  ))}
                  {email.outbound_emails.map((o) => (
                    <li key={o.id} className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <Badge variant="secondary" className="mr-1.5">Reply</Badge>
                        to {o.to_email}
                        {o.error && <span className="block text-xs text-muted-foreground">{o.error}</span>}
                      </span>
                      <StatusBadge status={o.status} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Audit trail</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-3 border-l pl-4">
                {email.audit_log.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <span className="absolute -left-[4.5px] mt-1.5 size-2 rounded-full bg-border" aria-hidden />
                    <div className="font-medium">{humanize(entry.event)}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.actor} · {formatDateTime(entry.created_at)}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
