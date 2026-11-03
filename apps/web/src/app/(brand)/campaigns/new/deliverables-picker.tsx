"use client";

import {
  Camera,
  Clapperboard,
  Image as ImageIcon,
  Minus,
  Plus,
  Smartphone,
  Video,
  MonitorPlay,
} from "lucide-react";
import type { DeliverableFormat, DeliverableInput } from "@brandjodi/shared";
import { cn } from "@/lib/utils";

type Kind = DeliverableInput["kind"];

interface FormatOption {
  format: DeliverableFormat;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  platform: DeliverableInput["platform"];
  defaultKind: Kind;
}

/** The menu of content formats, shown like products in a cart. */
export const FORMAT_OPTIONS: FormatOption[] = [
  {
    format: "reel",
    label: "Reel",
    hint: "15–60s vertical video",
    icon: Clapperboard,
    platform: "instagram",
    defaultKind: "ugc_asset",
  },
  {
    format: "story",
    label: "Story",
    hint: "24h story frames",
    icon: Smartphone,
    platform: "instagram",
    defaultKind: "influencer_post",
  },
  {
    format: "post",
    label: "Feed post",
    hint: "Single image or carousel",
    icon: ImageIcon,
    platform: "instagram",
    defaultKind: "influencer_post",
  },
  {
    format: "video",
    label: "UGC video",
    hint: "Ad-ready video files",
    icon: Video,
    platform: "none",
    defaultKind: "ugc_asset",
  },
  {
    format: "photo_set",
    label: "Photo set",
    hint: "Product / lifestyle photos",
    icon: Camera,
    platform: "none",
    defaultKind: "ugc_asset",
  },
  {
    format: "yt_integration",
    label: "YouTube integration",
    hint: "Mention in a YouTube video",
    icon: MonitorPlay,
    platform: "youtube",
    defaultKind: "influencer_post",
  },
];

export type Selection = Partial<
  Record<DeliverableFormat, { quantity: number; kind: Kind; specs: string }>
>;

export function selectionToDeliverables(selection: Selection): DeliverableInput[] {
  return FORMAT_OPTIONS.flatMap((o) => {
    const s = selection[o.format];
    if (!s || s.quantity < 1) return [];
    const platform =
      s.kind === "influencer_post" && o.platform === "none" ? "instagram" : o.platform;
    return [
      {
        kind: s.kind,
        platform,
        format: o.format,
        quantity: s.quantity,
        specs: s.specs || undefined,
      },
    ];
  });
}

export function DeliverablesPicker({
  value,
  onChange,
}: {
  value: Selection;
  onChange: (next: Selection) => void;
}) {
  const setQty = (o: FormatOption, quantity: number) => {
    const next = { ...value };
    if (quantity <= 0) delete next[o.format];
    else
      next[o.format] = {
        kind: value[o.format]?.kind ?? o.defaultKind,
        specs: value[o.format]?.specs ?? "",
        quantity: Math.min(quantity, 20),
      };
    onChange(next);
  };
  const patch = (format: DeliverableFormat, p: Partial<{ kind: Kind; specs: string }>) =>
    onChange({ ...value, [format]: { ...value[format]!, ...p } });

  const total = Object.values(value).reduce((n, s) => n + (s?.quantity ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FORMAT_OPTIONS.map((o) => {
          const qty = value[o.format]?.quantity ?? 0;
          const Icon = o.icon;
          return (
            <div
              key={o.format}
              className={cn(
                "relative rounded-2xl border p-4 transition",
                qty
                  ? "border-primary/50 bg-brand-soft ring-2 ring-primary/15"
                  : "bg-card hover:border-primary/30",
              )}
            >
              <button
                type="button"
                className="flex w-full items-start gap-3 text-left"
                onClick={() => setQty(o, qty ? qty : 1)}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    qty ? "bg-brand-gradient text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </span>
              </button>
              <div className="mt-3 flex items-center justify-between">
                {qty ? (
                  <span className="text-xs font-medium text-primary">{qty} selected</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Tap to add</span>
                )}
                <div className="flex items-center rounded-full border bg-card">
                  <button
                    type="button"
                    aria-label={`Fewer ${o.label}`}
                    className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    disabled={!qty}
                    onClick={() => setQty(o, qty - 1)}
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
                  <button
                    type="button"
                    aria-label={`More ${o.label}`}
                    className="p-1.5 text-primary hover:text-foreground"
                    onClick={() => setQty(o, qty + 1)}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {total > 0 && (
        <div className="space-y-2 rounded-2xl border bg-card p-4">
          <p className="text-sm font-semibold">
            Your basket · {total} item{total === 1 ? "" : "s"}
          </p>
          {FORMAT_OPTIONS.filter((o) => value[o.format]).map((o) => {
            const s = value[o.format]!;
            return (
              <div
                key={o.format}
                className="grid items-center gap-2 border-t pt-2 sm:grid-cols-[150px_auto_1fr]"
              >
                <span className="text-sm font-medium">
                  {s.quantity} × {o.label}
                </span>
                <div className="flex rounded-lg bg-muted p-0.5 text-xs">
                  {(["ugc_asset", "influencer_post"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => patch(o.format, { kind: k })}
                      className={cn(
                        "rounded-md px-2.5 py-1",
                        s.kind === k ? "bg-card font-semibold shadow-sm" : "text-muted-foreground",
                      )}
                    >
                      {k === "ugc_asset" ? "Files to us" : "Posted by creator"}
                    </button>
                  ))}
                </div>
                <input
                  className="h-8 rounded-lg border bg-card px-2 text-xs outline-none focus:border-primary/50"
                  placeholder="Specs (optional): length, hooks, hashtags…"
                  value={s.specs}
                  onChange={(e) => patch(o.format, { specs: e.target.value })}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
