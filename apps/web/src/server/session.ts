import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getWebActor } from "./auth";
import { getMyOrganisation } from "./services";

/** Per-request: the signed-in brand user and their organisation, or a redirect to sign in / onboarding. */
export const getBrandSession = cache(async () => {
  const actor = await getWebActor();
  if (!actor) redirect("/login");
  const [org, profile] = await Promise.all([
    getMyOrganisation(actor),
    actor.db.from("profiles").select("is_admin, full_name").eq("id", actor.userId).single(),
  ]);
  if (!org) redirect("/onboarding");
  return { actor, org, isAdmin: Boolean(profile.data?.is_admin) };
});
