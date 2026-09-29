"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";

import { decideApproval, retryEmail, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: FormState = { error: null };

export function ApprovalForm({
  emailId,
  replyDraft,
  sendsReply,
  defaultReviewer,
}: {
  emailId: string;
  replyDraft: string;
  sendsReply: boolean;
  defaultReviewer: string;
}) {
  const [state, action, pending] = useActionState(decideApproval.bind(null, emailId), initial);

  return (
    <form action={action} className="space-y-4">
      {sendsReply && (
        <div className="space-y-2">
          <Label htmlFor="reply">Reply to send</Label>
          <Textarea id="reply" name="reply" defaultValue={replyDraft} rows={10} className="font-mono text-sm" />
          <input type="hidden" name="original_reply" value={replyDraft} />
          <p className="text-xs text-muted-foreground">Edit the text to replace the AI draft. Unchanged, the draft is sent as is.</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reviewer">Reviewer</Label>
          <Input id="reviewer" name="reviewer" defaultValue={defaultReviewer} required autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="note">Note (optional)</Label>
          <Input id="note" name="note" />
        </div>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="approve" disabled={pending}>
          Approve and run plan
        </Button>
        <Button type="submit" name="decision" value="reject" variant="outline" disabled={pending}>
          Reject
        </Button>
      </div>
    </form>
  );
}

export function RetryForm({ emailId }: { emailId: string }) {
  const [state, action, pending] = useActionState(retryEmail.bind(null, emailId), initial);
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="outline" disabled={pending}>
        <RefreshCw className={pending ? "animate-spin" : undefined} aria-hidden />
        Retry from last checkpoint
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
