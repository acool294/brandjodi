import type { Metadata } from "next";
import Link from "next/link";
import { formatINR } from "@brandjodi/shared";
import { PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { getBrandSession } from "@/server/session";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const { actor, org } = await getBrandSession();
  const { data: campaigns } = await actor.db
    .from("campaigns")
    .select(
      "id, title, status, category, budget_per_creator, creators_needed, deadline, created_at, applications(count)",
    )
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Campaigns"
        actions={
          <Link href="/campaigns/new" className={buttonClasses()}>
            New campaign
          </Link>
        }
      />
      {!campaigns?.length ? (
        <EmptyState title="No campaigns yet">
          Create your first brief. It takes about five minutes.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Campaign</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Budget / creator</th>
                <th className="p-3 font-medium">Applications</th>
                <th className="p-3 font-medium">Deadline</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-muted/50">
                  <td className="p-3">
                    <Link href={`/campaigns/${c.id}`} className="font-medium hover:underline">
                      {c.title}
                    </Link>
                    <p className="text-xs capitalize text-muted-foreground">{c.category}</p>
                  </td>
                  <td className="p-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="p-3">{formatINR(c.budget_per_creator)}</td>
                  <td className="p-3">
                    {(c.applications as unknown as { count: number }[])[0]?.count ?? 0}
                  </td>
                  <td className="p-3">{formatDate(c.deadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
