import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardTitle, EmptyState } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { getBrandSession } from "@/server/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { actor, org } = await getBrandSession();
  const db = actor.db;

  const [campaigns, applications, contracts, notifications] = await Promise.all([
    db
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("status", "published"),
    db
      .from("applications")
      .select("id, campaigns!inner(org_id)", { count: "exact", head: true })
      .eq("campaigns.org_id", org.id)
      .eq("status", "submitted"),
    db.from("contracts").select("status").eq("org_id", org.id),
    db
      .from("notifications")
      .select("id, title, body, created_at, data")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const byStatus = (s: string[]) =>
    (contracts.data ?? []).filter((c) => s.includes(c.status)).length;
  const stats = [
    { label: "Live campaigns", value: campaigns.count ?? 0, href: "/campaigns" },
    { label: "New applications", value: applications.count ?? 0, href: "/campaigns" },
    { label: "Awaiting your payment", value: byStatus(["awaiting_funding"]), href: "/contracts" },
    { label: "Waiting for your review", value: byStatus(["in_review"]), href: "/contracts" },
  ];

  return (
    <>
      <PageHeader
        title={`Hi, ${org.name}`}
        subtitle="Your campaigns and contracts at a glance."
        actions={
          <Link href="/campaigns/new" className={buttonClasses()}>
            New campaign
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition hover:border-primary">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-3xl font-bold">{s.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <CardTitle>Recent activity</CardTitle>
        {notifications.data?.length ? (
          <ul className="mt-3 divide-y">
            {notifications.data.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="text-muted-foreground">{n.body}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(n.created_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing yet">
            Publish a campaign to start getting applications.
          </EmptyState>
        )}
      </Card>
    </>
  );
}
