import type { Metadata } from "next";
import { BadgeCheck, Star } from "lucide-react";
import { CATEGORIES, formatINR, labelFor } from "@brandjodi/shared";
import { PageHeader } from "@/components/app-shell";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, Card, EmptyState } from "@/components/ui/card";
import { CreatorQuickView } from "@/components/creator-quick-view";
import { Input, Select } from "@/components/ui/input";
import { getBrandSession } from "@/server/session";

const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export const metadata: Metadata = { title: "Find creators" };

export default async function CreatorsPage({ searchParams }: PageProps<"/creators">) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = one("q");
  const category = one("category");
  const city = one("city");
  const minFollowers = Number(one("min_followers") || 0);
  const maxPrice = Number(one("max_price") || 0);

  const { actor } = await getBrandSession();
  let query = actor.db
    .from("creator_profiles")
    .select(
      "username, display_name, city, categories, creator_types, instagram_followers, starting_price, rating_avg, rating_count, completed_count, metrics_verified",
    )
    .eq("is_public", true)
    .order("completed_count", { ascending: false })
    .limit(48);
  if (q)
    query = query.or(
      `display_name.ilike.%${q.replace(/[%,()]/g, "")}%,username.ilike.%${q.replace(/[%,()]/g, "")}%`,
    );
  if (category) query = query.contains("categories", [category]);
  if (city) query = query.ilike("city", `%${city}%`);
  if (minFollowers) query = query.gte("instagram_followers", minFollowers);
  if (maxPrice) query = query.lte("starting_price", maxPrice * 100);
  const { data: creators } = await query;

  return (
    <>
      <PageHeader title="Find creators" subtitle="Search the BrandJodi creator network." />
      <form className="mb-6 grid gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:grid-cols-6">
        <Input
          name="q"
          placeholder="Name or @username"
          defaultValue={q}
          className="sm:col-span-2"
        />
        <Select name="category" defaultValue={category}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {labelFor(c)}
            </option>
          ))}
        </Select>
        <Input name="city" placeholder="City" defaultValue={city} />
        <Select name="min_followers" defaultValue={one("min_followers")}>
          <option value="">Any followers</option>
          <option value="1000">1K+</option>
          <option value="10000">10K+</option>
          <option value="50000">50K+</option>
          <option value="100000">100K+</option>
        </Select>
        <div className="flex gap-2">
          <Input
            name="max_price"
            type="number"
            placeholder="Max ₹"
            defaultValue={one("max_price")}
          />
          <Button type="submit">Search</Button>
        </div>
      </form>

      {!creators?.length ? (
        <EmptyState title="No creators match">Try fewer filters.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((c) => (
            <CreatorQuickView key={c.username} username={c.username} className="group">
              <Card className="h-full space-y-3 transition group-hover:-translate-y-0.5 group-hover:border-primary/40">
                <div className="flex items-center gap-3">
                  <Avatar name={c.display_name} className="size-12" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate font-bold">
                      {c.display_name}
                      {c.metrics_verified && <BadgeCheck className="size-4 shrink-0 text-accent" />}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{c.username}
                      {c.city && ` · ${c.city}`}
                    </p>
                  </div>
                  {c.rating_avg && (
                    <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                      <Star className="size-3 fill-current" /> {Number(c.rating_avg).toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(c.categories as string[]).map((cat) => (
                    <Pill key={cat}>{labelFor(cat)}</Pill>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t pt-3 text-sm">
                  <span className="text-muted-foreground">
                    {c.instagram_followers != null
                      ? `${compact.format(c.instagram_followers)} followers`
                      : "No social stats"}
                  </span>
                  {c.starting_price != null && (
                    <span className="font-semibold text-primary">
                      from {formatINR(c.starting_price)}
                    </span>
                  )}
                </div>
              </Card>
            </CreatorQuickView>
          ))}
        </div>
      )}
    </>
  );
}
