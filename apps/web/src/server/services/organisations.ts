import "server-only";
import { organisationSchema, type OrganisationInput } from "@brandjodi/shared";
import type { Actor } from "../auth";
import { DomainError, fromDbError } from "../errors";

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  industry: string | null;
  city: string | null;
  about: string | null;
  verification_status: string;
}

/** POC: a user belongs to at most one brand organisation in the UI (the data model allows many). */
export async function getMyOrganisation(actor: Actor): Promise<Organisation | null> {
  const { data, error } = await actor.db
    .from("organisation_members")
    .select(
      "role, organisations(id, name, slug, website, industry, city, about, verification_status)",
    )
    .eq("user_id", actor.userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw fromDbError(error);
  return (data?.organisations as Organisation | undefined) ?? null;
}

export async function requireMyOrganisation(actor: Actor): Promise<Organisation> {
  const org = await getMyOrganisation(actor);
  if (!org) throw new DomainError("no_org");
  return org;
}

export async function createOrganisation(actor: Actor, input: OrganisationInput): Promise<string> {
  const parsed = organisationSchema.parse(input);
  const { data, error } = await actor.db.rpc("create_organisation", {
    p_name: parsed.name,
    p_website: parsed.website,
    p_industry: parsed.industry,
    p_city: parsed.city,
    p_about: parsed.about,
    p_gstin: parsed.gstin,
  });
  if (error) throw fromDbError(error);
  return data as string;
}
