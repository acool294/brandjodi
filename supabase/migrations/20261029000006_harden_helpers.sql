-- Hardening after the Supabase security advisor run.
-- The RLS helpers must stay executable by anon/authenticated (policies call them as the caller),
-- but their optional p_user argument is now honoured only for the server (service role, cron,
-- migrations). A signed-in client calling /rpc/is_org_member(org, someone_else) gets an answer about
-- itself, so it can't probe other users.

create or replace function public.effective_user(p_user uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select case
    when p_user is not null and coalesce(auth.role(), 'service_role') = 'service_role' then p_user
    else (select auth.uid())
  end;
$$;

create or replace function public.is_admin(p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = public.effective_user(p_user)),
    false
  );
$$;

create or replace function public.is_org_member(p_org uuid, p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organisation_members m
    where m.org_id = p_org and m.user_id = public.effective_user(p_user)
  );
$$;

create or replace function public.is_org_admin(p_org uuid, p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organisation_members m
    where m.org_id = p_org
      and m.user_id = public.effective_user(p_user)
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.can_access_contract(p_contract uuid, p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contracts c
    where c.id = p_contract
      and (
        c.creator_id = public.effective_user(p_user)
        or public.is_org_member(c.org_id, p_user)
        or public.is_admin(p_user)
      )
  );
$$;

create or replace function public.can_access_conversation(p_conversation uuid, p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation
      and (
        c.creator_id = public.effective_user(p_user)
        or public.is_org_member(c.org_id, p_user)
        or public.is_admin(p_user)
      )
  );
$$;

create or replace function public.has_applied(p_campaign uuid, p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.applications a
    where a.campaign_id = p_campaign and a.creator_id = public.effective_user(p_user)
  );
$$;

-- Trigger functions are never meant to be called through the API.
revoke execute on function public.applications_after_insert() from public, anon, authenticated;
revoke execute on function public.messages_before_insert() from public, anon, authenticated;
