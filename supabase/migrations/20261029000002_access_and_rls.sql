-- Access helpers, row-level security policies and column-level grants.
-- Rule of thumb: clients READ through these policies; anything involving money or contract state is
-- written by the server (service role bypasses RLS) through the workflow functions.

-- ---------------------------------------------------------------------------
-- Access helpers (security definer so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin(p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = coalesce(p_user, (select auth.uid()))),
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
    where m.org_id = p_org and m.user_id = coalesce(p_user, (select auth.uid()))
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
      and m.user_id = coalesce(p_user, (select auth.uid()))
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
        c.creator_id = coalesce(p_user, (select auth.uid()))
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
        c.creator_id = coalesce(p_user, (select auth.uid()))
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
    where a.campaign_id = p_campaign and a.creator_id = coalesce(p_user, (select auth.uid()))
  );
$$;

create or replace function public.is_campaign_member(p_campaign uuid, p_user uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campaigns c
    where c.id = p_campaign and public.is_org_member(c.org_id, p_user)
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.platform_settings enable row level security;
alter table public.organisations enable row level security;
alter table public.organisation_billing enable row level security;
alter table public.organisation_members enable row level security;
alter table public.creator_profiles enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.payout_accounts enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_deliverables enable row level security;
alter table public.applications enable row level security;
alter table public.offers enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_deliverables enable row level security;
alter table public.submissions enable row level security;
alter table public.payments enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.payouts enable row level security;
alter table public.webhook_events enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;
alter table public.consents enable row level security;
alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, avatar_url, is_adult, last_active_at) on public.profiles to authenticated;

create policy "settings: anyone can read" on public.platform_settings
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.platform_settings from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Brands
-- ---------------------------------------------------------------------------

create policy "organisations: public read" on public.organisations
  for select to anon, authenticated using (true);
create policy "organisations: admins of the org can update" on public.organisations
  for update to authenticated using (public.is_org_admin(id)) with check (public.is_org_admin(id));

revoke insert, update, delete on public.organisations from anon, authenticated;
grant update (name, logo_url, website, industry, city, about) on public.organisations to authenticated;

create policy "billing: members read" on public.organisation_billing
  for select to authenticated using (public.is_org_member(org_id));
create policy "billing: org admins update" on public.organisation_billing
  for update to authenticated using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
revoke insert, delete on public.organisation_billing from anon, authenticated;

create policy "members: members read their org" on public.organisation_members
  for select to authenticated using (user_id = (select auth.uid()) or public.is_org_member(org_id));
revoke insert, update, delete on public.organisation_members from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Creators
-- ---------------------------------------------------------------------------

create policy "creators: public profiles are readable" on public.creator_profiles
  for select to anon, authenticated
  using (is_public or user_id = (select auth.uid()) or public.is_admin());
create policy "creators: create own" on public.creator_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "creators: update own" on public.creator_profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Ratings, counts and the verified badge are maintained by the server only.
revoke insert, update, delete on public.creator_profiles from anon, authenticated;
grant insert (user_id, username, display_name, bio, city, languages, categories, creator_types,
  instagram_handle, instagram_followers, youtube_handle, youtube_subscribers, starting_price, is_public)
  on public.creator_profiles to authenticated;
grant update (username, display_name, bio, city, languages, categories, creator_types,
  instagram_handle, instagram_followers, youtube_handle, youtube_subscribers, starting_price, is_public)
  on public.creator_profiles to authenticated;

create policy "portfolio: readable with the profile" on public.portfolio_items
  for select to anon, authenticated
  using (exists (select 1 from public.creator_profiles cp where cp.user_id = creator_id));
create policy "portfolio: owner manages" on public.portfolio_items
  for all to authenticated
  using (creator_id = (select auth.uid())) with check (creator_id = (select auth.uid()));

create policy "payout accounts: read own" on public.payout_accounts
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());
revoke insert, update, delete on public.payout_accounts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Campaigns and hiring
-- ---------------------------------------------------------------------------

create policy "campaigns: public listings, own org, or applied" on public.campaigns
  for select to anon, authenticated
  using (
    (status in ('published', 'paused', 'closed') and visibility = 'public')
    or public.is_org_member(org_id)
    or public.has_applied(id)
    or public.is_admin()
  );
create policy "campaigns: org members create" on public.campaigns
  for insert to authenticated
  with check (public.is_org_member(org_id) and created_by = (select auth.uid()));
create policy "campaigns: org members update" on public.campaigns
  for update to authenticated using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "campaigns: org members delete drafts" on public.campaigns
  for delete to authenticated using (public.is_org_member(org_id) and status = 'draft');

revoke update on public.campaigns from anon, authenticated;
grant update (title, brief, category, compensation_type, budget_per_creator, creators_needed, deadline,
  is_remote, location, revisions_included, usage_rights, exclusivity_days, disclosure_required,
  product_info, visibility, status) on public.campaigns to authenticated;

create policy "campaign deliverables: visible with campaign" on public.campaign_deliverables
  for select to anon, authenticated
  using (exists (select 1 from public.campaigns c where c.id = campaign_id));
create policy "campaign deliverables: org members manage" on public.campaign_deliverables
  for all to authenticated
  using (public.is_campaign_member(campaign_id))
  with check (public.is_campaign_member(campaign_id));

create policy "applications: creator or brand" on public.applications
  for select to authenticated
  using (
    creator_id = (select auth.uid())
    or public.is_campaign_member(campaign_id)
    or public.is_admin()
  );
create policy "applications: creators apply to live campaigns" on public.applications
  for insert to authenticated
  with check (
    creator_id = (select auth.uid())
    and status = 'submitted'
    and exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.status = 'published' and not public.is_org_member(c.org_id)
    )
  );
revoke update, delete on public.applications from anon, authenticated;
revoke insert on public.applications from anon, authenticated;
grant insert (campaign_id, creator_id, quoted_price, delivery_days, pitch) on public.applications to authenticated;

-- ---------------------------------------------------------------------------
-- Agreements (read-only for clients)
-- ---------------------------------------------------------------------------

create policy "offers: parties read" on public.offers
  for select to authenticated
  using (creator_id = (select auth.uid()) or public.is_org_member(org_id) or public.is_admin());

create policy "contracts: parties read" on public.contracts
  for select to authenticated
  using (creator_id = (select auth.uid()) or public.is_org_member(org_id) or public.is_admin());

create policy "contract deliverables: parties read" on public.contract_deliverables
  for select to authenticated using (public.can_access_contract(contract_id));

create policy "submissions: parties read" on public.submissions
  for select to authenticated using (public.can_access_contract(contract_id));

revoke insert, update, delete on public.offers, public.contracts, public.contract_deliverables,
  public.submissions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Money (read-only for clients)
-- ---------------------------------------------------------------------------

create policy "payments: brand and admin read" on public.payments
  for select to authenticated
  using (exists (
    select 1 from public.contracts c
    where c.id = contract_id and (public.is_org_member(c.org_id) or public.is_admin())
  ));

create policy "payouts: parties read" on public.payouts
  for select to authenticated using (public.can_access_contract(contract_id));

create policy "ledger: admin read" on public.ledger_entries
  for select to authenticated using (public.is_admin());

-- webhook_events: no policies, so only the service role can touch it.

revoke insert, update, delete on public.payments, public.payouts, public.ledger_entries,
  public.webhook_events from anon, authenticated;
revoke select on public.webhook_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Communication
-- ---------------------------------------------------------------------------

create policy "conversations: parties read" on public.conversations
  for select to authenticated
  using (creator_id = (select auth.uid()) or public.is_org_member(org_id) or public.is_admin());
revoke insert, update, delete on public.conversations from anon, authenticated;

create policy "messages: parties read" on public.messages
  for select to authenticated using (public.can_access_conversation(conversation_id));
create policy "messages: parties send" on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.can_access_conversation(conversation_id));
revoke update, delete on public.messages from anon, authenticated;
revoke insert on public.messages from anon, authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;

create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: mark own read" on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "push tokens: own" on public.push_tokens
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Trust and operations
-- ---------------------------------------------------------------------------

create policy "reviews: revealed or own" on public.reviews
  for select to anon, authenticated
  using (visible_at <= now() or author_id = (select auth.uid()) or public.is_admin());
revoke insert, update, delete on public.reviews from anon, authenticated;

create policy "reports: create own" on public.reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "reports: read own" on public.reports
  for select to authenticated using (reporter_id = (select auth.uid()) or public.is_admin());
revoke update, delete on public.reports from anon, authenticated;

create policy "blocks: own" on public.blocks
  for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

create policy "consents: own" on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "consents: grant own" on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "audit: admin read" on public.audit_log
  for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.audit_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: chat and in-app notifications
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;

-- TRUNCATE bypasses RLS, so clients must never have it.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
