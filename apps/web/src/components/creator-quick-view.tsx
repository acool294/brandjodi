"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, ExternalLink, MapPin, Star, X } from "lucide-react";
import { formatINR, labelFor } from "@brandjodi/shared";
import { getCreatorDetailsAction } from "@/actions/brand";
import type { CreatorDetails } from "@/server/services/creators";
import { Pill } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

/** Wraps any content (a card, a name) so clicking it opens the creator's details in a pop-up. */
export function CreatorQuickView({
  username,
  className,
  children,
}: {
  username: string;
  className?: string;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [creator, setCreator] = useState<CreatorDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    dialog.current?.showModal();
    if (creator) return;
    const result = await getCreatorDetailsAction(username);
    if (result && "creator" in result) setCreator(result.creator);
    else setError(result?.error ?? "Could not load this creator");
  }

  // Close when clicking the backdrop.
  useEffect(() => {
    const d = dialog.current;
    const onClick = (e: MouseEvent) => {
      if (e.target === d) d?.close();
    };
    d?.addEventListener("click", onClick);
    return () => d?.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <button type="button" onClick={open} className={cn("w-full text-left", className)}>
        {children}
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-[min(640px,calc(100vw-2rem))] overflow-hidden rounded-3xl border bg-card p-0 text-foreground shadow-2xl backdrop:bg-[#17122b]/50 backdrop:backdrop-blur-sm"
      >
        <div className="max-h-[85vh] overflow-y-auto">
          <div className="relative bg-brand-gradient px-6 pb-14 pt-6 text-white">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="absolute right-4 top-4 rounded-full bg-white/20 p-1.5 hover:bg-white/30"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
            <p className="text-xs font-medium uppercase tracking-wider text-white/80">
              Creator profile
            </p>
          </div>

          {!creator && !error && <div className="h-64 animate-pulse bg-muted/40" />}
          {error && <p className="p-6 text-sm text-danger">{error}</p>}

          {creator && (
            <div className="relative z-10 -mt-10 space-y-5 px-6 pb-6">
              <div className="flex items-end gap-4">
                <Avatar
                  name={creator.display_name}
                  className="size-20 border-4 border-card text-2xl"
                />
                <div className="min-w-0 pb-1">
                  <h2 className="flex items-center gap-1.5 truncate text-xl font-extrabold">
                    {creator.display_name}
                    {creator.metrics_verified && (
                      <BadgeCheck className="size-5 text-accent" aria-label="Verified" />
                    )}
                  </h2>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    @{creator.username}
                    {creator.city && (
                      <>
                        <MapPin className="ml-1 size-3.5" /> {creator.city}
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                  label="Instagram"
                  value={
                    creator.instagram_followers != null
                      ? compact.format(creator.instagram_followers)
                      : "—"
                  }
                />
                <Stat
                  label="YouTube"
                  value={
                    creator.youtube_subscribers != null
                      ? compact.format(creator.youtube_subscribers)
                      : "—"
                  }
                />
                <Stat
                  label="Rating"
                  value={creator.rating_avg ? `${creator.rating_avg.toFixed(1)} ★` : "New"}
                />
                <Stat label="Jobs done" value={String(creator.completed_count)} />
              </div>
              {!creator.metrics_verified && (
                <p className="text-xs text-warning">
                  Follower numbers are self-reported and not yet verified.
                </p>
              )}

              {creator.bio && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{creator.bio}</p>
              )}

              <div className="flex flex-wrap gap-1.5">
                {[...creator.categories, ...creator.creator_types, ...creator.languages].map(
                  (t) => (
                    <Pill key={t}>{labelFor(t)}</Pill>
                  ),
                )}
              </div>

              {creator.starting_price != null && (
                <div className="flex items-center justify-between rounded-2xl bg-brand-soft p-4">
                  <span className="text-sm text-muted-foreground">Collaborations from</span>
                  <span className="text-lg font-extrabold text-primary">
                    {formatINR(creator.starting_price)}
                  </span>
                </div>
              )}

              {creator.portfolio.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-bold">Portfolio</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {creator.portfolio.map((p) =>
                      p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={p.id}
                          src={p.image_url}
                          alt={p.title}
                          className="aspect-square w-full rounded-xl object-cover"
                        />
                      ) : (
                        <a
                          key={p.id}
                          href={p.link ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="flex aspect-square items-center justify-center rounded-xl bg-muted p-2 text-center text-xs"
                        >
                          {p.title}
                          {p.brand_name && ` · ${p.brand_name}`}
                        </a>
                      ),
                    )}
                  </div>
                </section>
              )}

              <section>
                <h3 className="mb-2 text-sm font-bold">Reviews from brands</h3>
                {creator.reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reviews yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {creator.reviews.map((r, i) => (
                      <li key={i} className="rounded-xl border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{r.brand}</span>
                          <span className="flex items-center gap-0.5 text-warning">
                            {Array.from({ length: r.overall }, (_, k) => (
                              <Star key={k} className="size-3.5 fill-current" />
                            ))}
                          </span>
                        </div>
                        {r.text && <p className="mt-1 text-muted-foreground">{r.text}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <a
                href={`/c/${creator.username}`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Open shareable media kit <ExternalLink className="size-3.5" />
              </a>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3 text-center">
      <p className="text-lg font-extrabold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
