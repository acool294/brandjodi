import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BUCKETS, formatINR, labelFor } from "@brandjodi/shared";
import { Pill } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

async function load(username: string) {
  const db = await createClient();
  const { data: creator } = await db
    .from("creator_profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .eq("is_public", true)
    .maybeSingle();
  return { db, creator };
}

export async function generateMetadata({ params }: PageProps<"/c/[username]">): Promise<Metadata> {
  const { username } = await params;
  const { creator } = await load(username);
  return creator
    ? {
        title: `${creator.display_name} (@${creator.username})`,
        description: creator.bio ?? "Creator media kit on BrandJodi",
      }
    : { title: "Creator not found" };
}

/** Public media kit / rate card page (plan B11: creators share this link before brands arrive). */
export default async function MediaKitPage({ params }: PageProps<"/c/[username]">) {
  const { username } = await params;
  const { db, creator } = await load(username);
  if (!creator) notFound();

  const { data: portfolio } = await db
    .from("portfolio_items")
    .select("id, title, brand_name, link, media_path")
    .eq("creator_id", creator.user_id)
    .order("sort_order");

  const publicUrl = (path: string) =>
    `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKETS.portfolio}/${path}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <p className="text-sm font-semibold">
        Brand<span className="text-primary">Jodi</span> media kit
      </p>
      <h1 className="mt-4 text-3xl font-bold">{creator.display_name}</h1>
      <p className="text-muted-foreground">
        @{creator.username}
        {creator.city && ` · ${creator.city}`}
      </p>
      {creator.bio && <p className="mt-4 whitespace-pre-wrap">{creator.bio}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {[...(creator.categories as string[]), ...(creator.creator_types as string[])].map((c) => (
          <Pill key={c}>{labelFor(c)}</Pill>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted-foreground">Instagram</p>
          <p className="text-xl font-bold">
            {creator.instagram_followers?.toLocaleString("en-IN") ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {creator.instagram_handle ? `@${creator.instagram_handle}` : ""}{" "}
            {creator.metrics_verified ? "✓ verified" : "self-reported"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">YouTube</p>
          <p className="text-xl font-bold">
            {creator.youtube_subscribers?.toLocaleString("en-IN") ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground">{creator.youtube_handle ?? ""}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">On BrandJodi</p>
          <p className="text-xl font-bold">{creator.completed_count} jobs</p>
          <p className="text-xs text-muted-foreground">
            {creator.rating_avg
              ? `${creator.rating_avg} ★ (${creator.rating_count} reviews)`
              : "No reviews yet"}
          </p>
        </Card>
      </div>

      {creator.starting_price != null && (
        <p className="mt-6 text-lg">
          Collaborations from <strong>{formatINR(creator.starting_price)}</strong>
        </p>
      )}

      {portfolio && portfolio.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Portfolio</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {portfolio.map((p) => (
              <Card key={p.id} className="space-y-2">
                {p.media_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={publicUrl(p.media_path)}
                    alt={p.title}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                )}
                <p className="font-medium">{p.title}</p>
                {p.brand_name && (
                  <p className="text-sm text-muted-foreground">for {p.brand_name}</p>
                )}
                {p.link && (
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-primary underline"
                  >
                    View
                  </a>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      <p className="mt-12 text-center text-sm text-muted-foreground">
        Brands: hire {creator.display_name} safely on BrandJodi. Payment is held until you approve
        the work.
      </p>
    </main>
  );
}
