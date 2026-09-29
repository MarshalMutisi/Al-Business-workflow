import {
  Ban,
  Check,
  CircleCheck,
  CircleDot,
  CircleX,
  Clock,
  Eye,
  Inbox,
  LoaderCircle,
  Send,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tone = "good" | "warning" | "critical" | "info" | "neutral";

// Colour sits on the icon only; the text label always stays in the normal ink, so status never relies on colour.
const TONE_CLASS: Record<Tone, string> = {
  good: "text-status-good",
  warning: "text-status-warning",
  critical: "text-status-critical",
  info: "text-chart-1",
  neutral: "text-muted-foreground",
};

// Covers email, ticket, escalation and reply-delivery statuses, plus ticket priorities.
const STATUSES: Record<string, { tone: Tone; icon: LucideIcon; label?: string }> = {
  received: { tone: "neutral", icon: Inbox },
  processing: { tone: "info", icon: LoaderCircle },
  awaiting_approval: { tone: "warning", icon: Clock },
  completed: { tone: "good", icon: CircleCheck },
  rejected: { tone: "neutral", icon: CircleX },
  ignored: { tone: "neutral", icon: Ban },
  failed: { tone: "critical", icon: TriangleAlert },
  open: { tone: "info", icon: CircleDot },
  pending: { tone: "neutral", icon: Clock },
  acknowledged: { tone: "info", icon: Eye },
  resolved: { tone: "good", icon: CircleCheck },
  closed: { tone: "neutral", icon: CircleCheck },
  queued: { tone: "neutral", icon: Clock },
  sending: { tone: "info", icon: Send },
  sent: { tone: "good", icon: Check },
  low: { tone: "neutral", icon: CircleDot, label: "Low" },
  medium: { tone: "info", icon: CircleDot, label: "Medium" },
  high: { tone: "warning", icon: TriangleAlert, label: "High" },
  urgent: { tone: "critical", icon: TriangleAlert, label: "Urgent" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = STATUSES[status] ?? { tone: "neutral" as const, icon: CircleDot };
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("font-normal", className)}>
      <Icon className={cn(TONE_CLASS[meta.tone], status === "processing" && "animate-spin")} aria-hidden />
      {meta.label ?? humanize(status)}
    </Badge>
  );
}
