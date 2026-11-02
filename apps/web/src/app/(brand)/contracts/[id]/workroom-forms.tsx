"use client";

import { useActionState } from "react";
import { reviewSubmissionAction, submitReviewAction } from "@/actions/brand";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

export function SubmissionDecision({
  submissionId,
  revisionsLeft,
}: {
  submissionId: string;
  revisionsLeft: number;
}) {
  const [state, action, pending] = useActionState(reviewSubmissionAction, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="submission_id" value={submissionId} />
      <Input name="note" placeholder="Feedback for the creator (required for changes)" />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="approve" disabled={pending}>
          Approve and release payment
        </Button>
        <Button
          type="submit"
          name="decision"
          value="request_changes"
          variant="outline"
          disabled={pending || revisionsLeft <= 0}
        >
          Request changes ({Math.max(0, revisionsLeft)} left)
        </Button>
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}

export function ReviewForm({ contractId }: { contractId: string }) {
  const [state, action, pending] = useActionState(submitReviewAction, null);
  if (state?.ok) return <p className="text-sm text-success">{state.message}</p>;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="contract_id" value={contractId} />
      <Select name="overall" defaultValue="5" className="w-40">
        {[5, 4, 3, 2, 1].map((n) => (
          <option key={n} value={n}>
            {"★".repeat(n)} ({n})
          </option>
        ))}
      </Select>
      <Textarea name="text" placeholder="How was working with this creator?" />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        Submit review
      </Button>
    </form>
  );
}
