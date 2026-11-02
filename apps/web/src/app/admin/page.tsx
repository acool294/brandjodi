import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { formatINR } from "@brandjodi/shared";
import { verifyOrganisationAction } from "@/actions/admin";
import { ActionButton } from "@/components/action-button";
import { AppShell, PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";
import { getWebActor } from "@/server/auth";
import { RunJobsButton, SettingsForm } from "./admin-forms";

export const metadata: Metadata = { title: "Admin" };

/** Ops console. Reads with the service role after checking profiles.is_admin. */
export default async function AdminPage() {
  const actor = await getWebActor();
  if (!actor) redirect("/login?next=/admin");
  const admin = createAdminClient();
  const { data: me } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", actor.userId)
    .single();
  if (!me?.is_admin) notFound();

  const [settings, orgs, payments, ledger, payouts] = await Promise.all([
    admin.from("platform_settings").select("*").single(),
    admin
      .from("organisations")
      .select("id, name, website, verification_status, created_at, organisation_billing(gstin)")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("payments")
      .select("id, provider, provider_order_id, amount, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    admin.from("ledger_entries").select("account, debit, credit"),
    admin
      .from("payouts")
      .select("id, amount, status, provider, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const balances = new Map<string, number>();
  let totalDebit = 0;
  let totalCredit = 0;
  for (const e of ledger.data ?? []) {
    balances.set(e.account, (balances.get(e.account) ?? 0) + e.debit - e.credit);
    totalDebit += e.debit;
    totalCredit += e.credit;
  }
  const gmv = (payments.data ?? [])
    .filter((p) => p.status === "captured")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <AppShell isAdmin>
      <PageHeader title="Admin" subtitle="Fees, brand verification, payments and the ledger." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <CardTitle>Fees and timers</CardTitle>
          {settings.data && <SettingsForm settings={settings.data} />}
        </Card>

        <Card className="space-y-3">
          <CardTitle>Ledger</CardTitle>
          <p className="text-sm text-muted-foreground">
            Debits {formatINR(totalDebit)} · Credits {formatINR(totalCredit)} ·{" "}
            {totalDebit === totalCredit ? (
              <span className="text-success">balanced</span>
            ) : (
              <span className="text-danger">NOT balanced</span>
            )}
          </p>
          <ul className="divide-y text-sm">
            {[...balances.entries()].map(([account, bal]) => (
              <li key={account} className="flex justify-between py-1.5">
                <span className="font-mono">{account}</span>
                <span>
                  {formatINR(Math.abs(bal))} {bal >= 0 ? "Dr" : "Cr"}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm">Captured GMV (last 20 payments): {formatINR(gmv)}</p>
          <RunJobsButton />
        </Card>

        <Card className="space-y-3 lg:col-span-2">
          <CardTitle>Brands</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {(orgs.data ?? []).map((o) => (
                  <tr key={o.id}>
                    <td className="py-2">{o.name}</td>
                    <td className="py-2 text-muted-foreground">{o.website ?? "—"}</td>
                    <td className="py-2 font-mono text-xs">
                      {(o.organisation_billing as unknown as { gstin: string | null } | null)
                        ?.gstin ?? "no GSTIN"}
                    </td>
                    <td className="py-2">
                      <StatusBadge status={o.verification_status} />
                    </td>
                    <td className="py-2 text-right">
                      {o.verification_status !== "verified" && (
                        <ActionButton
                          size="sm"
                          variant="outline"
                          action={verifyOrganisationAction.bind(null, o.id, "verified")}
                        >
                          Verify
                        </ActionButton>
                      )}
                      {o.verification_status === "pending" && (
                        <ActionButton
                          size="sm"
                          variant="ghost"
                          action={verifyOrganisationAction.bind(null, o.id, "rejected")}
                        >
                          Reject
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="space-y-2">
          <CardTitle>Recent payments</CardTitle>
          <ul className="divide-y text-sm">
            {(payments.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="truncate font-mono text-xs">{p.provider_order_id}</span>
                <span>{formatINR(p.amount)}</span>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-2">
          <CardTitle>Recent payouts</CardTitle>
          <ul className="divide-y text-sm">
            {(payouts.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                <span>{formatDate(p.created_at)}</span>
                <span>{formatINR(p.amount)}</span>
                <span className="text-xs text-muted-foreground">{p.provider}</span>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
