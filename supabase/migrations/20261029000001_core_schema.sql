-- BrandJodi POC: core schema
-- Money is stored as integer paise. Every table the clients read has row-level security.
-- Clients may write only "low-risk" rows directly (own profile, campaigns of their org, applications,
-- chat messages). Offers, contracts, submissions, payments, payouts and the ledger change only through
-- the functions in 20261029000003_workflows.sql, which the Next.js server calls with the service role.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  is_adult boolean not null default false,
  is_admin boolean not null default false,
  status text not null default 'active' check (status in ('active', 'suspended', 'banned')),
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.profiles.is_adult is 'User declared they are 18+ (plan B10: 18+ only at launch).';

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Single-row configuration table: fees and timers can change without a deploy.
create table public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  brand_fee_bps integer not null default 1000 check (brand_fee_bps between 0 and 5000),
  creator_fee_bps integer not null default 0 check (creator_fee_bps between 0 and 5000),
  gst_on_fee_bps integer not null default 1800 check (gst_on_fee_bps between 0 and 5000),
  auto_approve_days integer not null default 5 check (auto_approve_days between 1 and 30),
  review_reveal_days integer not null default 14 check (review_reveal_days between 1 and 60),
  currency text not null default 'INR',
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id) values (1);

create trigger platform_settings_updated_at before update on public.platform_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Brands
-- ---------------------------------------------------------------------------

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  logo_url text,
  website text,
  industry text,
  city text,
  about text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  verified_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organisations_updated_at before update on public.organisations
  for each row execute function public.set_updated_at();

-- Private billing details live in their own table so the public organisation row can be read by anyone.
create table public.organisation_billing (
  org_id uuid primary key references public.organisations (id) on delete cascade,
  legal_name text,
  gstin text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z0-9]{13}$'),
  billing_address text,
  updated_at timestamptz not null default now()
);

create table public.organisation_members (
  org_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index organisation_members_user_idx on public.organisation_members (user_id);

-- ---------------------------------------------------------------------------
-- Creators
-- ---------------------------------------------------------------------------

create table public.creator_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,30}$'),
  display_name text not null,
  bio text,
  city text,
  languages text[] not null default '{}',
  categories text[] not null default '{}',
  creator_types text[] not null default '{}',
  instagram_handle text,
  instagram_followers integer check (instagram_followers >= 0),
  youtube_handle text,
  youtube_subscribers integer check (youtube_subscribers >= 0),
  starting_price integer check (starting_price >= 0),
  -- Self-reported in the POC. Becomes true only after an Instagram/YouTube OAuth sync (later phase).
  metrics_verified boolean not null default false,
  rating_avg numeric(3, 2),
  rating_count integer not null default 0,
  completed_count integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index creator_profiles_categories_idx on public.creator_profiles using gin (categories);
create index creator_profiles_search_idx on public.creator_profiles
  using gin ((username || ' ' || display_name || ' ' || coalesce(bio, '')) extensions.gin_trgm_ops);

create trigger creator_profiles_updated_at before update on public.creator_profiles
  for each row execute function public.set_updated_at();

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles (user_id) on delete cascade,
  title text not null,
  brand_name text,
  link text,
  media_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index portfolio_items_creator_idx on public.portfolio_items (creator_id, sort_order);

-- Payout KYC. The POC keeps only masked values; real bank details stay with Razorpay (plan B14).
create table public.payout_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  account_holder text not null,
  pan_last4 text not null,
  bank_last4 text not null,
  ifsc text not null,
  kyc_status text not null default 'submitted' check (kyc_status in ('submitted', 'verified', 'rejected')),
  provider_linked_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger payout_accounts_updated_at before update on public.payout_accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Campaigns and hiring
-- ---------------------------------------------------------------------------

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  title text not null,
  brief text not null,
  category text not null,
  compensation_type text not null default 'paid' check (compensation_type in ('paid', 'paid_plus_product')),
  budget_per_creator integer not null check (budget_per_creator >= 0),
  creators_needed integer not null default 1 check (creators_needed > 0),
  deadline date,
  is_remote boolean not null default true,
  location text,
  revisions_included integer not null default 1 check (revisions_included between 0 and 5),
  usage_rights jsonb not null default '{"channels":["organic_social"],"duration_days":90,"territory":"India"}',
  exclusivity_days integer not null default 0,
  disclosure_required boolean not null default true,
  product_info text,
  visibility text not null default 'public' check (visibility in ('public', 'invite_only')),
  status text not null default 'draft' check (status in ('draft', 'published', 'paused', 'closed')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_org_idx on public.campaigns (org_id);
create index campaigns_feed_idx on public.campaigns (status, category, published_at desc);

create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();

create table public.campaign_deliverables (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  kind text not null check (kind in ('ugc_asset', 'influencer_post')),
  platform text not null default 'instagram' check (platform in ('instagram', 'youtube', 'none')),
  format text not null check (format in ('reel', 'story', 'post', 'video', 'photo_set', 'yt_integration')),
  quantity integer not null default 1 check (quantity between 1 and 20),
  specs text,
  sort_order integer not null default 0
);
create index campaign_deliverables_campaign_idx on public.campaign_deliverables (campaign_id);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  creator_id uuid not null references public.creator_profiles (user_id) on delete cascade,
  quoted_price integer not null check (quoted_price >= 0),
  delivery_days integer not null check (delivery_days > 0),
  pitch text not null,
  status text not null default 'submitted'
    check (status in ('submitted', 'shortlisted', 'rejected', 'offered', 'hired', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);
create index applications_creator_idx on public.applications (creator_id);

create trigger applications_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Agreements
-- ---------------------------------------------------------------------------

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id),
  org_id uuid not null references public.organisations (id),
  creator_id uuid not null references public.creator_profiles (user_id),
  version integer not null,
  parent_offer_id uuid references public.offers (id),
  created_by uuid not null references public.profiles (id),
  created_by_side text not null check (created_by_side in ('brand', 'creator')),
  price integer not null check (price >= 0),
  delivery_days integer not null check (delivery_days > 0),
  revisions_included integer not null check (revisions_included between 0 and 5),
  message text,
  status text not null default 'sent' check (status in ('sent', 'countered', 'accepted', 'declined', 'withdrawn')),
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  unique (application_id, version)
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.offers (id),
  application_id uuid not null references public.applications (id),
  campaign_id uuid not null references public.campaigns (id),
  org_id uuid not null references public.organisations (id),
  creator_id uuid not null references public.creator_profiles (user_id),
  terms_snapshot jsonb not null,
  terms_hash text not null,
  terms_version text not null default 'poc-2026-10',
  price integer not null,
  brand_fee integer not null,
  creator_fee integer not null,
  platform_fee integer not null,
  gst_on_fee integer not null,
  brand_total integer not null,
  creator_payout integer not null,
  currency text not null default 'INR',
  revisions_included integer not null,
  status text not null default 'awaiting_funding' check (status in (
    'awaiting_funding', 'active', 'in_review', 'revision_requested', 'approved',
    'paid_out', 'closed', 'cancelled', 'disputed'
  )),
  accepted_by uuid not null references public.profiles (id),
  accepted_at timestamptz not null default now(),
  accept_ip text,
  due_at timestamptz,
  funded_at timestamptz,
  approved_at timestamptz,
  paid_out_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (brand_total = price + brand_fee + gst_on_fee),
  check (creator_payout = price - creator_fee)
);
create index contracts_org_idx on public.contracts (org_id);
create index contracts_creator_idx on public.contracts (creator_id);

create trigger contracts_updated_at before update on public.contracts
  for each row execute function public.set_updated_at();

create table public.contract_deliverables (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  kind text not null check (kind in ('ugc_asset', 'influencer_post')),
  platform text not null,
  format text not null,
  quantity integer not null,
  specs text,
  sort_order integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'changes_requested', 'approved')),
  revisions_used integer not null default 0,
  approved_at timestamptz
);
create index contract_deliverables_contract_idx on public.contract_deliverables (contract_id);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  contract_deliverable_id uuid not null references public.contract_deliverables (id) on delete cascade,
  version integer not null,
  submitted_by uuid not null references public.profiles (id),
  media_paths text[] not null default '{}',
  caption text,
  live_url text,
  status text not null default 'submitted' check (status in ('submitted', 'changes_requested', 'approved', 'auto_approved')),
  reviewer_note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  auto_approve_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (contract_deliverable_id, version)
);
create index submissions_due_idx on public.submissions (auto_approve_at) where status = 'submitted';

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id),
  provider text not null check (provider in ('razorpay', 'mock')),
  provider_order_id text not null unique,
  provider_payment_id text unique,
  amount integer not null check (amount > 0),
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created', 'captured', 'failed', 'refunded')),
  raw jsonb,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_contract_idx on public.payments (contract_id);

create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- Double-entry ledger. Every txn_id has debits = credits. Append-only (see trigger below).
create table public.ledger_entries (
  id bigint generated always as identity primary key,
  txn_id uuid not null,
  account text not null check (account in (
    'escrow_hold', 'creator_payable', 'platform_revenue', 'gst_payable', 'tds_payable', 'refunds'
  )),
  debit integer not null default 0 check (debit >= 0),
  credit integer not null default 0 check (credit >= 0),
  contract_id uuid references public.contracts (id),
  memo text,
  created_at timestamptz not null default now(),
  check ((debit = 0) <> (credit = 0))
);
create index ledger_entries_txn_idx on public.ledger_entries (txn_id);
create index ledger_entries_contract_idx on public.ledger_entries (contract_id);

create or replace function public.ledger_is_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'ledger_entries is append-only';
end;
$$;

create trigger ledger_entries_no_update before update or delete on public.ledger_entries
  for each row execute function public.ledger_is_append_only();

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null unique references public.contracts (id),
  creator_id uuid not null references public.creator_profiles (user_id),
  amount integer not null check (amount >= 0),
  tds_withheld integer not null default 0,
  -- 'simulated' in the POC. 'razorpay_route' once Route transfers on hold are wired up.
  provider text not null default 'simulated' check (provider in ('simulated', 'razorpay_route')),
  provider_transfer_id text,
  status text not null default 'scheduled' check (status in ('pending_kyc', 'scheduled', 'processing', 'paid', 'failed')),
  failure_reason text,
  attempted_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payouts_creator_idx on public.payouts (creator_id);

create trigger payouts_updated_at before update on public.payouts
  for each row execute function public.set_updated_at();

-- Webhook idempotency (plan B8).
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

-- ---------------------------------------------------------------------------
-- Communication
-- ---------------------------------------------------------------------------

-- One conversation per application. It carries on into the contract after hire.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications (id) on delete cascade,
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  org_id uuid not null references public.organisations (id) on delete cascade,
  creator_id uuid not null references public.creator_profiles (user_id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);
create index conversations_org_idx on public.conversations (org_id);
create index conversations_creator_idx on public.conversations (creator_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  sender_side text not null check (sender_side in ('brand', 'creator', 'system')),
  body text not null check (char_length(body) between 1 and 4000),
  masked boolean not null default false,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Trust and operations
-- ---------------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  author_side text not null check (author_side in ('brand', 'creator')),
  overall integer not null check (overall between 1 and 5),
  ratings jsonb not null default '{}',
  text text,
  -- Double-blind: hidden until both sides review or review_reveal_days pass.
  visible_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (contract_id, author_side)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id),
  target_type text not null check (target_type in ('user', 'creator', 'organisation', 'campaign', 'message')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  purpose text not null,
  policy_version text not null,
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  target_type text not null,
  target_id text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
