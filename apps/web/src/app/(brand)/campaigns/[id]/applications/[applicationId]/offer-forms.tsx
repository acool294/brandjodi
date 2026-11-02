"use client";

import { useActionState } from "react";
import { counterOfferAction, sendOfferAction } from "@/actions/brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function OfferForm({
  applicationId,
  defaultPrice,
  defaultDays,
  defaultRevisions,
  isRevision,
}: {
  applicationId: string;
  defaultPrice: number;
  defaultDays: number;
  defaultRevisions: number;
  isRevision: boolean;
}) {
  const [state, action, pending] = useActionState(sendOfferAction, null);
  return (
    <form action={action} className="space-y-3 rounded-lg bg-muted p-3">
      <p className="text-sm font-medium">{isRevision ? "Send a revised offer" : "Send an offer"}</p>
      <input type="hidden" name="application_id" value={applicationId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Price (₹)">
          <Input
            name="price"
            type="number"
            min={100}
            step={1}
            defaultValue={defaultPrice}
            required
          />
        </Field>
        <Field label="Delivery (days)">
          <Input
            name="delivery_days"
            type="number"
            min={1}
            max={90}
            defaultValue={defaultDays}
            required
          />
        </Field>
        <Field label="Revisions">
          <Input
            name="revisions_included"
            type="number"
            min={0}
            max={5}
            defaultValue={defaultRevisions}
            required
          />
        </Field>
      </div>
      <Field label="Message (optional)">
        <Input name="message" />
      </Field>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.message && <p className="text-sm text-success">{state.message}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send offer"}
      </Button>
    </form>
  );
}

export function CounterForm({ offerId }: { offerId: string }) {
  const [state, action, pending] = useActionState(counterOfferAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="offer_id" value={offerId} />
      <Field label="Counter price (₹)">
        <Input name="price" type="number" min={100} required className="w-40" />
      </Field>
      <Button type="submit" variant="outline" disabled={pending}>
        Counter
      </Button>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
