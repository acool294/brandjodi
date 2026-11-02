import type { Metadata } from "next";
import Link from "next/link";
import { formatINR } from "@brandjodi/shared";
import { PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { getBrandSession } from "@/server/session";

export const metadata: Metadata = { title: "Contracts" };

export default async function ContractsPage() {
  const { actor, org } = await getBrandSession();
  const { data: contracts } = await actor.db
    .from("contracts")
    .select(
      "id, status, price, brand_total, due_at, created_at, campaigns(title), creator_profiles(display_name)",
    )
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Contracts" subtitle="Every hire becomes a contract with frozen terms." />
      {!contracts?.length ? (
        <EmptyState title="No contracts yet">
          Send an offer to an applicant. When they accept, the contract appears here.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Creator</th>
                <th className="p-3 font-medium">Campaign</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">You pay</th>
                <th className="p-3 font-medium">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-muted/50">
                  <td className="p-3">
                    <Link href={`/contracts/${c.id}`} className="font-medium hover:underline">
                      {(c.creator_profiles as unknown as { display_name: string }).display_name}
                    </Link>
                  </td>
                  <td className="p-3">{(c.campaigns as unknown as { title: string }).title}</td>
                  <td className="p-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="p-3">{formatINR(c.brand_total)}</td>
                  <td className="p-3">{formatDate(c.due_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
