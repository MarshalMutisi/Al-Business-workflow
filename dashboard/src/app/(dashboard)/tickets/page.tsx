import type { Metadata } from "next";
import Link from "next/link";

import { FilterTabs } from "@/components/filter-tabs";
import { EmptyRow, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDateTime, humanize } from "@/lib/format";
import type { Ticket } from "@/lib/types";

export const metadata: Metadata = { title: "Tickets" };

const STATUSES: Ticket["status"][] = ["open", "pending", "resolved", "closed"];

export default async function TicketsPage({ searchParams }: PageProps<"/tickets">) {
  const requested = (await searchParams).status;
  const status = STATUSES.find((s) => s === requested);
  const tickets = await api<Ticket[]>(`/tickets?limit=100${status ? `&status=${status}` : ""}`);

  return (
    <>
      <PageHeader title="Tickets" description="Tickets the agent opened from inbound email." />
      <FilterTabs
        label="Filter by status"
        tabs={[
          { label: "All", href: "/tickets", active: !status },
          ...STATUSES.map((s) => ({ label: humanize(s), href: `/tickets?status=${s}`, active: s === status })),
        ]}
      />
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 && <EmptyRow colSpan={6}>No tickets.</EmptyRow>}
              {tickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="max-w-80">
                    {t.email_id ? (
                      <Link href={`/emails/${t.email_id}`} className="block truncate font-medium hover:text-primary hover:underline">
                        {t.subject}
                      </Link>
                    ) : (
                      <span className="block truncate font-medium">{t.subject}</span>
                    )}
                    <span className="block truncate text-xs text-muted-foreground">{t.description}</span>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{t.customer?.name || t.customer?.email || "—"}</TableCell>
                  <TableCell>{t.category ? humanize(t.category) : "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={t.priority} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDateTime(t.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
