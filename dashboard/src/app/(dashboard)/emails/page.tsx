import type { Metadata } from "next";
import Link from "next/link";

import { AutoRefresh } from "@/components/auto-refresh";
import { FilterTabs } from "@/components/filter-tabs";
import { EmptyRow, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDateTime, humanize } from "@/lib/format";
import type { EmailStatus, EmailSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Emails" };

const STATUSES: EmailStatus[] = ["awaiting_approval", "processing", "completed", "failed", "rejected", "ignored"];

export default async function EmailsPage({ searchParams }: PageProps<"/emails">) {
  const requested = (await searchParams).status;
  const status = STATUSES.find((s) => s === requested);
  const emails = await api<EmailSummary[]>(`/emails?limit=100${status ? `&status=${status}` : ""}`);
  const busy = emails.some((e) => e.status === "received" || e.status === "processing");

  return (
    <>
      {busy && <AutoRefresh intervalMs={5000} />}
      <PageHeader title="Emails" description="Inbound email and what the agent decided, newest first." />
      <FilterTabs
        label="Filter by status"
        tabs={[
          { label: "All", href: "/emails", active: !status },
          ...STATUSES.map((s) => ({ label: humanize(s), href: `/emails?status=${s}`, active: s === status })),
        ]}
      />
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.length === 0 && (
                <EmptyRow colSpan={6}>{status ? `No ${humanize(status).toLowerCase()} emails.` : "No emails yet."}</EmptyRow>
              )}
              {emails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell className="max-w-48">
                    <div className="truncate font-medium">{email.from_name || email.from_email}</div>
                    {email.from_name && <div className="truncate text-xs text-muted-foreground">{email.from_email}</div>}
                  </TableCell>
                  <TableCell className="max-w-80 truncate">
                    <Link href={`/emails/${email.id}`} className="font-medium hover:text-primary hover:underline">
                      {email.subject}
                    </Link>
                  </TableCell>
                  <TableCell>{email.classification ? humanize(email.classification.category) : "—"}</TableCell>
                  <TableCell>{email.classification ? <StatusBadge status={email.classification.urgency} /> : "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={email.status} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDateTime(email.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
