import type { Metadata } from "next";
import { Search } from "lucide-react";

import { EmptyRow, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDateTime, humanize } from "@/lib/format";
import type { Customer } from "@/lib/types";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const raw = (await searchParams).search;
  const search = typeof raw === "string" ? raw.trim().slice(0, 100) : "";
  const customers = await api<Customer[]>(`/customers?limit=100${search ? `&search=${encodeURIComponent(search)}` : ""}`);

  return (
    <>
      <PageHeader title="Customers" description="CRM records the agent looked up or created.">
        <form role="search" className="flex w-full gap-2 sm:w-auto">
          <Input
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Name, email or company"
            aria-label="Search customers"
            className="sm:w-64"
          />
          <Button type="submit" variant="outline">
            <Search aria-hidden />
            Search
          </Button>
        </form>
      </PageHeader>
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 && (
                <EmptyRow colSpan={5}>{search ? `No customers match “${search}”.` : "No customers yet."}</EmptyRow>
              )}
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="max-w-64">
                    <div className="truncate font-medium">{c.name || "—"}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.email}</div>
                  </TableCell>
                  <TableCell>{c.company || "—"}</TableCell>
                  <TableCell>{c.plan || "—"}</TableCell>
                  <TableCell>{humanize(c.status)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDateTime(c.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
