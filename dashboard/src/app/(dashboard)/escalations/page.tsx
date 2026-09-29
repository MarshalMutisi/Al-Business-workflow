import type { Metadata } from "next";
import Link from "next/link";

import { FilterTabs } from "@/components/filter-tabs";
import { EmptyRow, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDateTime, humanize } from "@/lib/format";
import type { Escalation } from "@/lib/types";

export const metadata: Metadata = { title: "Escalations" };

const STATUSES: Escalation["status"][] = ["open", "acknowledged", "resolved"];

export default async function EscalationsPage({ searchParams }: PageProps<"/escalations">) {
  const requested = (await searchParams).status;
  const status = STATUSES.find((s) => s === requested);
  const escalations = await api<Escalation[]>(`/escalations?limit=100${status ? `&status=${status}` : ""}`);

  return (
    <>
      <PageHeader title="Escalations" description="Emails the agent handed to a person." />
      <FilterTabs
        label="Filter by status"
        tabs={[
          { label: "All", href: "/escalations", active: !status },
          ...STATUSES.map((s) => ({ label: humanize(s), href: `/escalations?status=${s}`, active: s === status })),
        ]}
      />
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reason</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {escalations.length === 0 && <EmptyRow colSpan={5}>No escalations.</EmptyRow>}
              {escalations.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="max-w-96 whitespace-normal">
                    {e.email_id ? (
                      <Link href={`/emails/${e.email_id}`} className="line-clamp-2 hover:text-primary hover:underline">
                        {e.reason}
                      </Link>
                    ) : (
                      <span className="line-clamp-2">{e.reason}</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{e.customer?.name || e.customer?.email || "—"}</TableCell>
                  <TableCell>{e.assigned_to || "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={e.status} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDateTime(e.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
