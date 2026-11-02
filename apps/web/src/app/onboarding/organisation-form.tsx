"use client";

import { useActionState } from "react";
import { createOrganisationAction } from "@/actions/brand";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";

export function OrganisationForm() {
  const [state, action, pending] = useActionState(createOrganisationAction, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <Field label="Brand name">
        <Input name="name" required minLength={2} />
      </Field>
      <Field label="Website">
        <Input name="website" type="url" placeholder="https://" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Industry">
          <Input name="industry" placeholder="Skincare" />
        </Field>
        <Field label="City">
          <Input name="city" placeholder="Mumbai" />
        </Field>
      </div>
      <Field label="About the brand">
        <Textarea name="about" />
      </Field>
      <Field label="GSTIN (optional)" hint="15 characters. Used for verification and fee invoices.">
        <Input name="gstin" maxLength={15} />
      </Field>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
