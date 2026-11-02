"use client";

import { useActionState } from "react";
import { runJobsAction, updateSettingsAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function SettingsForm({
  settings,
}: {
  settings: {
    brand_fee_bps: number;
    creator_fee_bps: number;
    gst_on_fee_bps: number;
    auto_approve_days: number;
  };
}) {
  const [state, action, pending] = useActionState(updateSettingsAction, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Brand fee (%)">
        <Input
          name="brand_fee_pct"
          type="number"
          step="0.01"
          min={0}
          max={50}
          defaultValue={settings.brand_fee_bps / 100}
        />
      </Field>
      <Field label="Creator fee (%)">
        <Input
          name="creator_fee_pct"
          type="number"
          step="0.01"
          min={0}
          max={50}
          defaultValue={settings.creator_fee_bps / 100}
        />
      </Field>
      <Field label="GST on fee (%)">
        <Input
          name="gst_pct"
          type="number"
          step="0.01"
          min={0}
          max={50}
          defaultValue={settings.gst_on_fee_bps / 100}
        />
      </Field>
      <Field label="Auto-approve after (days)">
        <Input
          name="auto_approve_days"
          type="number"
          min={1}
          max={30}
          defaultValue={settings.auto_approve_days}
        />
      </Field>
      <div className="sm:col-span-2">
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        {state?.message && <p className="text-sm text-success">{state.message}</p>}
        <Button type="submit" disabled={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}

export function RunJobsButton() {
  const [state, action, pending] = useActionState(runJobsAction, null);
  return (
    <form action={action}>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Run scheduled jobs now (auto-approval)
      </Button>
      {state?.message && <p className="mt-1 text-xs text-muted-foreground">{state.message}</p>}
      {state?.error && <p className="mt-1 text-xs text-danger">{state.error}</p>}
    </form>
  );
}
