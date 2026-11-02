// Creates demo accounts and a live campaign so the full loop can be tried immediately.
//   pnpm --filter @brandjodi/web seed:demo
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from apps/web/.env.local.
// Sign in with email + password (set NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN=true / EXPO_PUBLIC_ENABLE_PASSWORD_LOGIN=true).
// Test accounts only: never run this against a production project.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key)
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in apps/web/.env.local");

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "BrandJodi-demo-2026";
const db = createClient(url, key, { auth: { persistSession: false } });

async function user(email, fullName) {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  const existing = list.users.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  return data.user.id;
}

const must = ({ error, data }) => {
  if (error) throw error;
  return data;
};

const adminId = await user("admin@demo.brandjodi.test", "BrandJodi Ops");
const brandId = await user("brand@demo.brandjodi.test", "Glow Co Owner");
const creatorId = await user("creator@demo.brandjodi.test", "Priya Sharma");

must(await db.from("profiles").update({ is_admin: true, is_adult: true }).eq("id", adminId));
must(await db.from("profiles").update({ is_adult: true }).eq("id", creatorId));

let org = must(await db.from("organisations").select("id").eq("created_by", brandId).maybeSingle());
if (!org) {
  org = must(
    await db
      .from("organisations")
      .insert({
        name: "Glow Co",
        slug: "glow-co-demo",
        website: "https://example.com",
        industry: "Skincare",
        city: "Mumbai",
        created_by: brandId,
        verification_status: "verified",
        verified_at: new Date().toISOString(),
      })
      .select("id")
      .single(),
  );
  must(
    await db
      .from("organisation_members")
      .insert({ org_id: org.id, user_id: brandId, role: "owner" }),
  );
  must(await db.from("organisation_billing").insert({ org_id: org.id, gstin: "27ABCDE1234F1Z5" }));
}

must(
  await db.from("creator_profiles").upsert({
    user_id: creatorId,
    username: "priya.creates",
    display_name: "Priya Sharma",
    bio: "Skincare and everyday makeup reels. Pune. Hindi + English.",
    city: "Pune",
    languages: ["english", "hindi"],
    categories: ["skincare", "beauty"],
    creator_types: ["ugc", "influencer"],
    instagram_handle: "priya.creates",
    instagram_followers: 24800,
    starting_price: 4000_00,
  }),
);

const existingCampaign = must(
  await db.from("campaigns").select("id").eq("org_id", org.id).limit(1).maybeSingle(),
);
if (!existingCampaign) {
  const campaign = must(
    await db
      .from("campaigns")
      .insert({
        org_id: org.id,
        created_by: brandId,
        title: "Monsoon sunscreen launch: 2 UGC reels",
        brief:
          "Show our SPF 50 gel in your morning routine. Hook in the first 2 seconds, mention it's non-greasy and white-cast free. Natural light, no heavy filters.",
        category: "skincare",
        budget_per_creator: 6000_00,
        creators_needed: 3,
        revisions_included: 1,
        usage_rights: {
          channels: ["organic_social", "paid_ads"],
          duration_days: 90,
          territory: "India",
        },
        status: "published",
      })
      .select("id")
      .single(),
  );
  must(
    await db.from("campaign_deliverables").insert([
      {
        campaign_id: campaign.id,
        kind: "ugc_asset",
        platform: "instagram",
        format: "reel",
        quantity: 2,
        specs: "9:16, 20-30 seconds",
      },
    ]),
  );
}

console.log("Demo data ready. Accounts (password from DEMO_PASSWORD, default in this file):");
console.log("  admin@demo.brandjodi.test   -> web /admin");
console.log("  brand@demo.brandjodi.test   -> web dashboard");
console.log("  creator@demo.brandjodi.test -> mobile app");
