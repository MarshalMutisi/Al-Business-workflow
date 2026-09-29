"use client";

import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlert className="size-5 text-status-critical" aria-hidden />
          Could not load this page
        </CardTitle>
        <CardDescription>
          The dashboard could not get data from the API. Check that the FastAPI server is running and that
          API_URL in dashboard/.env.local points to it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error.digest && <p className="font-mono text-xs text-muted-foreground">Error id: {error.digest}</p>}
        <Button onClick={() => retry()}>Try again</Button>
      </CardContent>
    </Card>
  );
}
