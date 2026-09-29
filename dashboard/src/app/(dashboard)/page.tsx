import Link from "next/link";
import { ArrowRight, Clock, Inbox, Sparkles, Ticket, TriangleAlert, type LucideIcon } from "lucide-react";

import { CategoryChart } from "@/components/charts/category-chart";
import { DailyVolumeChart } from "@/components/charts/daily-volume-chart";
import { FilterTabs } from "@/components/filter-tabs";
import { EmptyRow, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDateTime, formatNumber, formatPercent, humanize } from "@/lib/format";
import type { Category, EmailSummary, Stats } from "@/lib/types";
import { cn } from "@/lib/utils";

const RANGES = [7, 14, 30];
const CATEGORIES: Category[] = ["support", "billing", "sales_lead", "cancellation", "other", "spam"];
const DELIVERY = ["queued", "sending", "sent", "failed"] as const;

// Icon chip colours per tile; the label and value stay in the normal text colours.
const TILE_TONES = {
  warning: "bg-status-warning/15 text-status-warning",
  primary: "bg-primary/10 text-primary",
  good: "bg-status-good/15 text-status-good",
  info: "bg-chart-1/15 text-chart-1",
  neutral: "bg-muted text-muted-foreground",
};

function StatTile({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  href,
  hero = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: keyof typeof TILE_TONES;
  href?: string;
  hero?: boolean;
}) {
  const body = (
    <Card
      className={cn(
        "h-full transition-all",
        href && "hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/30",
      )}
    >
      <CardHeader>
        <CardDescription className="font-medium">{label}</CardDescription>
        <CardAction>
          <span className={cn("flex size-9 items-center justify-center rounded-lg", TILE_TONES[tone])}>
            <Icon className="size-4.5" aria-hidden />
          </span>
        </CardAction>
        <CardTitle className={cn("font-semibold tracking-tight", hero ? "text-5xl" : "text-3xl")}>{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{detail}</CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function OverviewPage({ searchParams }: PageProps<"/">) {
  const requested = Number((await searchParams).days);
  const days = RANGES.includes(requested) ? requested : 14;

  const [stats, awaiting] = await Promise.all([
    api<Stats>(`/stats?days=${days}`),
    api<EmailSummary[]>("/emails?status=awaiting_approval&limit=6"),
  ]);

  const auto = stats.daily.reduce((sum, d) => sum + d.auto, 0);
  const approval = stats.daily.reduce((sum, d) => sum + d.approval, 0);
  const awaitingCount = stats.emails_by_status.awaiting_approval ?? 0;
  const failedEmails = stats.emails_by_status.failed ?? 0;
  const failedReplies = stats.outbound_by_status.failed ?? 0;
  const categories = CATEGORIES.map((c) => ({ label: humanize(c), count: stats.recent_by_category[c] ?? 0 })).sort(
    (a, b) => b.count - a.count,
  );

  return (
    <>
      <PageHeader title="Overview" description={`Email activity over the last ${days} days (UTC).`}>
        <FilterTabs
          label="Time range"
          tabs={RANGES.map((r) => ({ label: `${r} days`, href: r === 14 ? "/" : `/?days=${r}`, active: r === days }))}
        />
      </PageHeader>

      {(failedEmails > 0 || failedReplies > 0) && (
        <div role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-status-critical/30 bg-status-critical/5 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <TriangleAlert className="size-4 text-status-critical" aria-hidden />
            Needs attention
          </span>
          {failedEmails > 0 && (
            <Link href="/emails?status=failed" className="font-medium text-primary underline underline-offset-4">
              {failedEmails} failed {failedEmails === 1 ? "email" : "emails"}
            </Link>
          )}
          {failedReplies > 0 && (
            <span>
              {failedReplies} {failedReplies === 1 ? "reply" : "replies"} could not be delivered
            </span>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          hero
          icon={Clock}
          tone={awaitingCount ? "warning" : "neutral"}
          label="Awaiting approval"
          value={formatNumber(awaitingCount)}
          detail={awaitingCount ? "Plans paused for a human decision" : "Nothing waiting on you"}
          href="/emails?status=awaiting_approval"
        />
        <StatTile
          icon={Inbox}
          tone="primary"
          label="Emails received"
          value={formatNumber(stats.recent_total)}
          detail={`Last ${days} days`}
          href="/emails"
        />
        <StatTile
          icon={Sparkles}
          tone="good"
          label="Handled without approval"
          value={formatPercent(auto + approval ? auto / (auto + approval) : null)}
          detail={`${auto} of ${auto + approval} planned emails · avg confidence ${formatPercent(stats.avg_confidence)}`}
        />
        <StatTile
          icon={Ticket}
          tone="info"
          label="Open tickets"
          value={formatNumber(stats.open_tickets)}
          detail={`${stats.open_escalations} open ${stats.open_escalations === 1 ? "escalation" : "escalations"}`}
          href="/tickets"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Emails per day</CardTitle>
            <CardDescription>What the agent did with each email it received</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyVolumeChart data={stats.daily} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
            <CardDescription>Classified emails, last {days} days</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryChart data={categories} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Waiting for your approval</CardTitle>
            <CardDescription>Customer replies are held until you decide</CardDescription>
            <CardAction>
              <Link
                href="/emails?status=awaiting_approval"
                className="flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                View all <ArrowRight className="size-4" aria-hidden />
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {awaiting.length === 0 && <EmptyRow colSpan={4}>No plans are waiting for approval.</EmptyRow>}
                {awaiting.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell className="max-w-40 truncate">{email.from_name || email.from_email}</TableCell>
                    <TableCell className="max-w-64 truncate">
                      <Link href={`/emails/${email.id}`} className="font-medium hover:text-primary hover:underline">
                        {email.subject}
                      </Link>
                    </TableCell>
                    <TableCell>{email.classification ? humanize(email.classification.category) : "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatDateTime(email.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Reply delivery</CardTitle>
            <CardDescription>Replies sent by n8n through Gmail, all time</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {DELIVERY.map((status) => (
                <li key={status} className="flex items-center justify-between py-2.5">
                  <StatusBadge status={status} />
                  <span className="font-medium tabular-nums">{formatNumber(stats.outbound_by_status[status] ?? 0)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">{formatNumber(stats.customers)} customers in the CRM</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
