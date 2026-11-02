import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireWebActor } from "@/server/auth";
import { getMyOrganisation } from "@/server/services";
import { OrganisationForm } from "./organisation-form";

export const metadata: Metadata = { title: "Set up your brand" };

export default async function OnboardingPage() {
  const actor = await requireWebActor();
  if (await getMyOrganisation(actor)) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <h1 className="text-2xl font-bold">Set up your brand</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Creators see this on your campaigns. Add your GSTIN to get a verified badge (checked by our
        team).
      </p>
      <OrganisationForm />
    </main>
  );
}
