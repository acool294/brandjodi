import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES, formatINR, labelFor } from "@brandjodi/shared";
import { PageHeader } from "@/components/app-shell";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { getBrandSession } from "@/server/session";

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
      <form className="mb-6 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-6">
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
            <Link key={c.username} href={`/c/${c.username}`} target="_blank">
              <Card className="h-full space-y-2 transition hover:border-primary">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{c.display_name}</p>
                  {c.rating_avg && (
                    <span className="text-sm">
                      {c.rating_avg} ★{" "}
                      <span className="text-muted-foreground">({c.rating_count})</span>
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  @{c.username}
                  {c.city && ` · ${c.city}`}
                </p>
                <div className="flex flex-wrap gap-1">
                  {(c.categories as string[]).map((cat) => (
                    <Pill key={cat}>{labelFor(cat)}</Pill>
                  ))}
                </div>
                <p className="text-sm">
                  {c.instagram_followers != null
                    ? `${c.instagram_followers.toLocaleString("en-IN")} followers${c.metrics_verified ? " ✓" : " (unverified)"}`
                    : "No social stats"}
                  {c.starting_price != null && ` · from ${formatINR(c.starting_price)}`}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
