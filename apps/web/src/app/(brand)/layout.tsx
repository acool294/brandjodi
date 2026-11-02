import { AppShell } from "@/components/app-shell";
import { getBrandSession } from "@/server/session";

export default async function BrandLayout({ children }: LayoutProps<"/">) {
  const { org, isAdmin } = await getBrandSession();
  return (
    <AppShell
      orgName={org.name}
      verified={org.verification_status === "verified"}
      isAdmin={isAdmin}
    >
      {children}
    </AppShell>
  );
}
