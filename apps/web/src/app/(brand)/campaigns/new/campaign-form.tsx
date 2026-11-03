"use client";

import { useState, useTransition } from "react";
import {
  CATEGORIES,
  USAGE_RIGHTS_CHANNELS,
  computeFees,
  formatINR,
  labelFor,
  type CampaignInput,
  type FeeSettings,
} from "@brandjodi/shared";
import { createCampaignAction } from "@/actions/brand";
import { DeliverablesPicker, selectionToDeliverables, type Selection } from "./deliverables-picker";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

export function CampaignForm({ fees }: { fees: FeeSettings }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState(5000);
  const [selection, setSelection] = useState<Selection>({
    reel: { quantity: 1, kind: "ugc_asset", specs: "" },
  });
  const [channels, setChannels] = useState<string[]>(["organic_social"]);

  const breakdown = computeFees(Math.max(0, Math.round(budget * 100)), fees);

  function submit(form: HTMLFormElement, publish: boolean) {
    const fd = new FormData(form);
    const s = (k: string) => String(fd.get(k) ?? "");
    const input: CampaignInput = {
      title: s("title"),
      brief: s("brief"),
      category: s("category") as CampaignInput["category"],
      compensation_type: s("compensation_type") as CampaignInput["compensation_type"],
      budget_per_creator: Math.round(budget * 100),
      creators_needed: Number(s("creators_needed")),
      deadline: s("deadline") || undefined,
      is_remote: s("is_remote") === "on",
      location: s("location") || undefined,
      revisions_included: Number(s("revisions_included")),
      usage_rights: {
        channels: channels as CampaignInput["usage_rights"]["channels"],
        duration_days: Number(s("usage_days")),
        territory: "India",
      },
      exclusivity_days: Number(s("exclusivity_days")),
      disclosure_required: true,
      product_info: s("product_info") || undefined,
      deliverables: selectionToDeliverables(selection),
    };
    setError(null);
    startTransition(async () => {
      const result = await createCampaignAction(input, publish);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        submit(e.currentTarget, submitter?.value === "publish");
      }}
    >
      <div className="space-y-6">
        <Card className="space-y-4">
          <CardTitle>The brief</CardTitle>
          <Field label="Campaign title">
            <Input
              name="title"
              required
              minLength={5}
              placeholder="Summer sunscreen launch: 3 UGC reels"
            />
          </Field>
          <Field
            label="Brief"
            hint="What you're promoting, the key message, must-show shots, do's and don'ts."
          >
            <Textarea name="brief" required minLength={20} rows={6} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <Select name="category" defaultValue="beauty">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {labelFor(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Compensation">
              <Select name="compensation_type" defaultValue="paid">
                <option value="paid">Paid</option>
                <option value="paid_plus_product">Paid + product</option>
              </Select>
            </Field>
          </div>
          <Field label="Product details (if you ship a product)">
            <Textarea name="product_info" rows={2} />
          </Field>
        </Card>

        <Card className="space-y-4">
          <div>
            <CardTitle>What do you need?</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick formats and quantities per creator. &ldquo;Posted by creator&rdquo; content
              always carries an #ad / paid partnership label (ASCI guidelines).
            </p>
          </div>
          <DeliverablesPicker value={selection} onChange={setSelection} />
        </Card>

        <Card className="space-y-4">
          <CardTitle>Rights and timeline</CardTitle>
          <div>
            <p className="mb-2 text-sm font-medium">Where you may use the content</p>
            <div className="flex flex-wrap gap-3 text-sm">
              {USAGE_RIGHTS_CHANNELS.map((c) => (
                <label key={c} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={channels.includes(c)}
                    onChange={(e) =>
                      setChannels((l) => (e.target.checked ? [...l, c] : l.filter((x) => x !== c)))
                    }
                  />
                  {labelFor(c)}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Usage period (days)">
              <Input name="usage_days" type="number" min={0} defaultValue={90} />
            </Field>
            <Field label="Exclusivity (days)" hint="Creator won't work with competitors">
              <Input name="exclusivity_days" type="number" min={0} defaultValue={0} />
            </Field>
            <Field label="Revisions included">
              <Input name="revisions_included" type="number" min={0} max={5} defaultValue={1} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Deadline">
              <Input name="deadline" type="date" />
            </Field>
            <Field label="Location (for shoots)">
              <Input name="location" placeholder="Mumbai" />
            </Field>
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" name="is_remote" defaultChecked /> Remote is fine
            </label>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="space-y-4 lg:sticky lg:top-6">
          <CardTitle>Budget</CardTitle>
          <Field label="Budget per creator (₹)">
            <Input
              type="number"
              min={500}
              step={100}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
            />
          </Field>
          <Field label="Creators needed">
            <Input name="creators_needed" type="number" min={1} max={100} defaultValue={1} />
          </Field>
          <dl className="space-y-1 rounded-lg bg-muted p-3 text-sm">
            <div className="flex justify-between">
              <dt>Creator price</dt>
              <dd>{formatINR(breakdown.price)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Platform fee ({fees.brandFeeBps / 100}%)</dt>
              <dd>{formatINR(breakdown.brandFee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>GST on fee</dt>
              <dd>{formatINR(breakdown.gstOnFee)}</dd>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold">
              <dt>You pay per creator</dt>
              <dd>{formatINR(breakdown.brandTotal)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            Final price is agreed per creator in the offer.
          </p>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex flex-col gap-2">
            <Button type="submit" value="publish" disabled={pending}>
              {pending ? "Saving…" : "Publish campaign"}
            </Button>
            <Button type="submit" value="draft" variant="outline" disabled={pending}>
              Save as draft
            </Button>
          </div>
        </Card>
      </div>
    </form>
  );
}
