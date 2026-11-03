import type { Metadata } from "next";
import Link from "next/link";
import { Eye, Inbox, Megaphone, Plus, Wallet } from "lucide-react";
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
    { label: "Live campaigns", value: campaigns.count ?? 0, href: "/campaigns", icon: Megaphone },
    { label: "New applications", value: applications.count ?? 0, href: "/campaigns", icon: Inbox },
    {
      label: "Awaiting your payment",
      value: byStatus(["awaiting_funding"]),
      href: "/contracts",
      icon: Wallet,
    },
    {
      label: "Waiting for your review",
      value: byStatus(["in_review"]),
      href: "/contracts",
      icon: Eye,
    },
  ];

  return (
    <>
      <section className="relative mb-8 overflow-hidden rounded-3xl bg-brand-gradient p-6 text-white sm:p-8">
        <div
          className="absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-24 right-24 size-56 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-white/80">Welcome back</p>
            <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{org.name}</h1>
            <p className="mt-2 max-w-md text-sm text-white/85">
              Post a brief, pick your creators and pay safely. Payment is released only when you
              approve the work.
            </p>
          </div>
          <Link
            href="/campaigns/new"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-primary shadow-lg transition hover:bg-white/90"
          >
            <Plus className="size-4" /> New campaign
          </Link>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, href, icon: Icon }) => (
          <Link key={label} href={href}>
            <Card className="group flex items-center gap-4 transition hover:-translate-y-0.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-primary transition group-hover:bg-brand-gradient group-hover:text-white">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-extrabold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
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
