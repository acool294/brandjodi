import { NextResponse } from "next/server";
import { envProblems } from "@/lib/env";

/** Deployment check. Reports which settings are missing, never their values. */
export function GET() {
  const problems = [...envProblems];
  if (!process.env.SUPABASE_SECRET_KEY) problems.push("SUPABASE_SECRET_KEY (missing)");
  return NextResponse.json(
    { ok: problems.length === 0, service: "brandjodi-web", problems },
    { status: problems.length ? 500 : 200 },
  );
}
