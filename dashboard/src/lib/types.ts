// Shapes returned by the FastAPI backend (see src/ai_bussiness_workflow/main.py).

export type EmailStatus =
  | "received"
  | "processing"
  | "awaiting_approval"
  | "completed"
  | "rejected"
  | "ignored"
  | "failed";

export type Category = "billing" | "support" | "sales_lead" | "cancellation" | "spam" | "other";

export interface Classification {
  category: Category;
  urgency: "low" | "medium" | "high";
  sentiment: "positive" | "neutral" | "negative";
  confidence: number;
}

export interface Extracted {
  customer_name: string | null;
  order_id: string | null;
  product: string | null;
  amount: number | null;
  summary: string;
}

export interface PlannedAction {
  type: "create_ticket" | "update_customer" | "send_reply" | "escalate";
  params: Record<string, unknown>;
}

export interface Plan {
  actions: PlannedAction[];
  reply_draft: string;
  ai_reply_draft?: string;
  reasoning: string;
  requires_approval: boolean;
  approval_reasons?: string[];
}

export interface Approval {
  approved: boolean;
  reviewer: string;
  note?: string | null;
  edited_reply?: string | null;
}

export interface EmailSummary {
  id: string;
  message_id: string;
  from_email: string;
  from_name: string | null;
  subject: string;
  status: EmailStatus;
  classification: Classification | null;
  plan: Plan | null;
  error: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  plan: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

type CustomerRef = Pick<Customer, "name" | "email" | "company"> | null;

export interface Ticket {
  id: string;
  email_id: string | null;
  subject: string;
  description: string;
  category: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "pending" | "resolved" | "closed";
  created_at: string;
  customer?: CustomerRef;
}

export interface Escalation {
  id: string;
  email_id: string | null;
  reason: string;
  status: "open" | "acknowledged" | "resolved";
  assigned_to: string | null;
  created_at: string;
  customer?: CustomerRef;
}

export interface OutboundEmail {
  id: string;
  to_email: string;
  subject: string;
  body: string;
  status: "queued" | "sending" | "sent" | "failed";
  attempts: number;
  error: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  event: string;
  actor: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface EmailDetail extends EmailSummary {
  thread_id: string | null;
  to_email: string;
  body_text: string;
  received_at: string;
  extracted: Extracted | null;
  approval: Approval | null;
  results: { action: string; output: unknown }[] | null;
  tickets: Ticket[];
  escalations: Escalation[];
  outbound_emails: OutboundEmail[];
  audit_log: AuditEntry[];
}

export interface DailyVolume {
  day: string;
  auto: number;
  approval: number;
  ignored: number;
  other: number;
}

export interface Stats {
  days: number;
  recent_total: number;
  avg_confidence: number | null;
  emails_by_status: Partial<Record<EmailStatus, number>>;
  recent_by_category: Partial<Record<Category, number>>;
  daily: DailyVolume[];
  open_tickets: number;
  open_escalations: number;
  customers: number;
  outbound_by_status: Partial<Record<OutboundEmail["status"], number>>;
}
