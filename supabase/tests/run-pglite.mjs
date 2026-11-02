import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import fs from "node:fs";
import path from "node:path";

/**
 * Runs every migration plus supabase/tests/*.test.sql against an in-memory Postgres (PGlite), with
 * small stubs for the Supabase-managed schemas (auth, storage, cron, net). No Docker needed.
 *   pnpm test:db
 * This checks SQL syntax, RLS and the money workflows. Use `supabase db reset` for a full local stack.
 */
const here = path.dirname(new URL(import.meta.url).pathname);
const migDir = path.join(here, "..", "migrations");
const db = new PGlite({ extensions: { pg_trgm } });

const stubs = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema extensions; create extension pg_trgm with schema extensions;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid(), auth.role() to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
create publication supabase_realtime;
create schema cron; create function cron.schedule(a text, b text, c text) returns bigint language sql as $$ select 1::bigint $$;
create schema net; create table net.calls (body jsonb);
create function net.http_post(url text, body jsonb, headers jsonb) returns bigint language sql as $$ insert into net.calls values (body); select 1::bigint $$;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;
await db.exec(stubs);
for (const f of fs.readdirSync(migDir).sort()) {
  let sql = fs.readFileSync(path.join(migDir, f), "utf8");
  sql = sql
    .replace(/create extension if not exists (pg_cron|pg_net)[^;]*;/g, "")
    .replace(/create extension if not exists pg_trgm[^;]*;/g, "");
  try {
    await db.exec(sql);
    console.log("applied", f);
  } catch (e) {
    console.error("FAILED", f, e.message);
    process.exit(1);
  }
}
for (const f of fs
  .readdirSync(here)
  .filter((n) => n.endsWith(".test.sql"))
  .sort()) {
  try {
    const results = await db.exec(fs.readFileSync(path.join(here, f), "utf8"));
    for (const r of results)
      for (const row of r.rows) if (typeof row.check === "string") console.log("  " + row.check);
    console.log("PASS", f);
  } catch (e) {
    console.error("FAIL", f, "-", e.message);
    process.exit(1);
  }
}
