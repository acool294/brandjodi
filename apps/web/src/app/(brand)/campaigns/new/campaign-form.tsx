"use client";

import { useState, useTransition } from "react";
import {
  CATEGORIES,
  DELIVERABLE_FORMATS,
  USAGE_RIGHTS_CHANNELS,
  computeFees,
  formatINR,
  labelFor,
  type CampaignInput,
  type DeliverableInput,
  type FeeSettings,
} from "@brandjodi/shared";
import { createCampaignAction } from "@/actions/brand";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

const emptyDeliverable: DeliverableInput = {
  kind: "ugc_asset",
  platform: "instagram",
  format: "reel",
  quantity: 1,
};

export function CampaignForm({ fees }: { fees: FeeSettings }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [budget, setBudget] = useState(5000);
  const [deliverables, setDeliverables] = useState<DeliverableInput[]>([emptyDeliverable]);
  const [channels, setChannels] = useState<string[]>(["organic_social"]);

  const breakdown = computeFees(Math.max(0, Math.round(budget * 100)), fees);

  function updateDeliverable(i: number, patch: Partial<DeliverableInput>) {
    setDeliverables((list) => list.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  }

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
      deliverables,
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
          <div className="flex items-center justify-between">
            <CardTitle>Deliverables</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeliverables((l) => [...l, emptyDeliverable])}
            >
              Add deliverable
            </Button>
          </div>
          {deliverables.map((d, i) => (
            <div
              key={i}
              className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1.3fr_1fr_1fr_80px_auto]"
            >
              <Select
                aria-label="Type"
                value={d.kind}
                onChange={(e) =>
                  updateDeliverable(i, { kind: e.target.value as DeliverableInput["kind"] })
                }
              >
                <option value="ugc_asset">UGC (files to the brand)</option>
                <option value="influencer_post">Post on creator&apos;s account</option>
              </Select>
              <Select
                aria-label="Platform"
                value={d.platform}
                onChange={(e) =>
                  updateDeliverable(i, { platform: e.target.value as DeliverableInput["platform"] })
                }
              >
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
                <option value="none">No platform</option>
              </Select>
              <Select
                aria-label="Format"
                value={d.format}
                onChange={(e) =>
                  updateDeliverable(i, { format: e.target.value as DeliverableInput["format"] })
                }
              >
                {DELIVERABLE_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {labelFor(f)}
                  </option>
                ))}
              </Select>
              <Input
                aria-label="Quantity"
                type="number"
                min={1}
                max={20}
                value={d.quantity}
                onChange={(e) => updateDeliverable(i, { quantity: Number(e.target.value) })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={deliverables.length === 1}
                onClick={() => setDeliverables((l) => l.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
              <Input
                className="sm:col-span-5"
                placeholder="Specs: length, aspect ratio, hooks, hashtags…"
                value={d.specs ?? ""}
                onChange={(e) => updateDeliverable(i, { specs: e.target.value })}
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Posts on the creator&apos;s account always carry an #ad / paid partnership label (ASCI
            guidelines).
          </p>
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
