-- Workflow functions: every state change for offers, contracts, submissions, money and reviews.
-- Each function runs in one transaction, checks who is acting (p_user) and the current state, and
-- raises an exception with a short machine-readable message on failure (e.g. 'not_allowed').
-- They are executable only by the service role (the Next.js server) and by pg_cron.
-- Exception: create_organisation() is callable by signed-in users and acts as auth.uid().

-- ---------------------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------------------

create or replace function public.format_inr(p_paise integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select '₹' || regexp_replace(to_char(p_paise / 100.0, 'FM99,99,99,99,990.00'), '\.00$', '');
$$;

create or replace function public.compute_fees(p_price integer)
returns table (
  brand_fee integer,
  creator_fee integer,
  platform_fee integer,
  gst_on_fee integer,
  brand_total integer,
  creator_payout integer
)
language plpgsql
stable
set search_path = ''
as $$
declare
  s public.platform_settings;
  v_brand_fee integer;
  v_creator_fee integer;
  v_gst integer;
begin
  select * into s from public.platform_settings where id = 1;
  v_brand_fee := round(p_price::numeric * s.brand_fee_bps / 10000);
  v_creator_fee := round(p_price::numeric * s.creator_fee_bps / 10000);
  v_gst := round((v_brand_fee + v_creator_fee)::numeric * s.gst_on_fee_bps / 10000);
  return query select
    v_brand_fee,
    v_creator_fee,
    v_brand_fee + v_creator_fee,
    v_gst,
    p_price + v_brand_fee + v_gst,
    p_price - v_creator_fee;
end;
$$;

create or replace function public.notify_user(p_user uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}')
returns void
language sql
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, data)
  values (p_user, p_type, p_title, p_body, coalesce(p_data, '{}'));
$$;

create or replace function public.notify_org(p_org uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}')
returns void
language sql
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, data)
  select m.user_id, p_type, p_title, p_body, coalesce(p_data, '{}')
  from public.organisation_members m where m.org_id = p_org;
$$;

create or replace function public.post_system_message(p_application uuid, p_actor uuid, p_body text)
returns void
language sql
set search_path = ''
as $$
  insert into public.messages (conversation_id, sender_id, sender_side, body)
  select c.id, p_actor, 'system', p_body
  from public.conversations c where c.application_id = p_application;
$$;

create or replace function public.audit(p_actor uuid, p_action text, p_target_type text, p_target_id text, p_details jsonb default '{}')
returns void
language sql
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (p_actor, p_action, p_target_type, p_target_id, coalesce(p_details, '{}'));
$$;

-- ---------------------------------------------------------------------------
-- Triggers: campaigns, applications, messages
-- ---------------------------------------------------------------------------

create or replace function public.campaigns_set_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger campaigns_published_at before insert or update of status on public.campaigns
  for each row execute function public.campaigns_set_published_at();

-- Every application gets a conversation; the brand is notified.
create or replace function public.applications_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.campaigns;
  v_creator public.creator_profiles;
begin
  select * into v_campaign from public.campaigns where id = new.campaign_id;
  select * into v_creator from public.creator_profiles where user_id = new.creator_id;

  insert into public.conversations (application_id, campaign_id, org_id, creator_id)
  values (new.id, new.campaign_id, v_campaign.org_id, new.creator_id);

  perform public.notify_org(
    v_campaign.org_id, 'application.new',
    'New application',
    v_creator.display_name || ' applied to ' || v_campaign.title || ' at ' || public.format_inr(new.quoted_price),
    jsonb_build_object('campaign_id', new.campaign_id, 'application_id', new.id)
  );
  return new;
end;
$$;

create trigger applications_after_insert after insert on public.applications
  for each row execute function public.applications_after_insert();

-- Mask contact details in chat until the contract is funded (plan B4), set the sender side,
-- and bump the conversation.
create or replace function public.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations;
  v_funded boolean;
  v_body text;
begin
  select * into v_conv from public.conversations where id = new.conversation_id;

  if new.sender_side is distinct from 'system' then
    new.sender_side := case when new.sender_id = v_conv.creator_id then 'creator' else 'brand' end;

    select exists (
      select 1 from public.contracts c
      where c.application_id = v_conv.application_id and c.funded_at is not null
    ) into v_funded;

    if not v_funded then
      v_body := new.body;
      -- Emails and UPI IDs (name@bank)
      v_body := regexp_replace(v_body, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+', '[hidden]', 'g');
      -- Indian mobile numbers, with or without +91 / spaces / dashes
      v_body := regexp_replace(v_body, '(\+?91[\s-]?)?[6-9][0-9]{4}[\s-]?[0-9]{5}', '[hidden]', 'g');
      -- Outside payment and chat links
      v_body := regexp_replace(v_body, '(https?://)?(www\.)?(wa\.me|chat\.whatsapp\.com|t\.me|rzp\.io|razorpay\.me|paytm\.me|gpay\.app\.goo\.gl|phon\.pe)/?\S*', '[hidden]', 'gi');
      if v_body <> new.body then
        new.body := v_body;
        new.masked := true;
      end if;
    end if;
  end if;

  update public.conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

-- ---------------------------------------------------------------------------
-- Organisations
-- ---------------------------------------------------------------------------

create or replace function public.create_organisation(
  p_name text,
  p_website text default null,
  p_industry text default null,
  p_city text default null,
  p_about text default null,
  p_gstin text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_slug text;
begin
  if v_user is null then
    raise exception 'not_signed_in';
  end if;

  v_slug := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  v_slug := left(coalesce(nullif(v_slug, ''), 'brand'), 50) || '-' || substr(md5(random()::text), 1, 6);

  insert into public.organisations (name, slug, website, industry, city, about, created_by)
  values (p_name, v_slug, p_website, p_industry, p_city, p_about, v_user)
  returning id into v_org;

  insert into public.organisation_members (org_id, user_id, role) values (v_org, v_user, 'owner');
  insert into public.organisation_billing (org_id, gstin) values (v_org, nullif(upper(p_gstin), ''));

  if p_gstin is not null and p_gstin <> '' then
    update public.organisations set verification_status = 'pending' where id = v_org;
  end if;

  return v_org;
end;
$$;

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------

create or replace function public.set_application_status(p_application uuid, p_user uuid, p_status text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_app public.applications;
  v_org uuid;
begin
  select a.* into v_app from public.applications a where a.id = p_application for update;
  if not found then raise exception 'not_found'; end if;
  select org_id into v_org from public.campaigns where id = v_app.campaign_id;

  if p_status in ('shortlisted', 'rejected', 'submitted') then
    if not public.is_org_member(v_org, p_user) then raise exception 'not_allowed'; end if;
    if v_app.status not in ('submitted', 'shortlisted', 'rejected') then raise exception 'invalid_state'; end if;
    if p_status = 'rejected' then
      perform public.notify_user(v_app.creator_id, 'application.rejected', 'Application update',
        'The brand went with other creators this time.', jsonb_build_object('application_id', v_app.id));
    end if;
  elsif p_status = 'withdrawn' then
    if v_app.creator_id <> p_user then raise exception 'not_allowed'; end if;
    if v_app.status not in ('submitted', 'shortlisted', 'offered') then raise exception 'invalid_state'; end if;
    update public.offers set status = 'withdrawn' where application_id = v_app.id and status = 'sent';
  else
    raise exception 'invalid_status';
  end if;

  update public.applications set status = p_status where id = v_app.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Offers
-- ---------------------------------------------------------------------------

create or replace function public.send_offer(
  p_application uuid,
  p_user uuid,
  p_price integer,
  p_delivery_days integer,
  p_revisions integer,
  p_message text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_app public.applications;
  v_campaign public.campaigns;
  v_last public.offers;
  v_offer uuid;
begin
  select * into v_app from public.applications where id = p_application for update;
  if not found then raise exception 'not_found'; end if;
  select * into v_campaign from public.campaigns where id = v_app.campaign_id;

  if not public.is_org_member(v_campaign.org_id, p_user) then raise exception 'not_allowed'; end if;
  if v_app.status not in ('submitted', 'shortlisted', 'offered') then raise exception 'invalid_state'; end if;

  select * into v_last from public.offers where application_id = v_app.id order by version desc limit 1;
  update public.offers set status = 'withdrawn' where application_id = v_app.id and status = 'sent';

  insert into public.offers (
    application_id, campaign_id, org_id, creator_id, version, parent_offer_id,
    created_by, created_by_side, price, delivery_days, revisions_included, message
  ) values (
    v_app.id, v_app.campaign_id, v_campaign.org_id, v_app.creator_id, coalesce(v_last.version, 0) + 1, v_last.id,
    p_user, 'brand', p_price, p_delivery_days, p_revisions, p_message
  ) returning id into v_offer;

  update public.applications set status = 'offered' where id = v_app.id;

  perform public.notify_user(v_app.creator_id, 'offer.received', 'You have an offer',
    v_campaign.title || ': ' || public.format_inr(p_price), jsonb_build_object('offer_id', v_offer, 'application_id', v_app.id));
  perform public.post_system_message(v_app.id, p_user, 'Brand sent an offer: ' || public.format_inr(p_price)
    || ', ' || p_delivery_days || ' days, ' || p_revisions || ' revision(s).');
  return v_offer;
end;
$$;

-- Either side can counter the other side's open offer with a new price.
create or replace function public.counter_offer(p_offer uuid, p_user uuid, p_price integer, p_message text default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_side text;
  v_new uuid;
begin
  select * into v_offer from public.offers where id = p_offer for update;
  if not found then raise exception 'not_found'; end if;
  if v_offer.status <> 'sent' or v_offer.expires_at < now() then raise exception 'invalid_state'; end if;

  if p_user = v_offer.creator_id then v_side := 'creator';
  elsif public.is_org_member(v_offer.org_id, p_user) then v_side := 'brand';
  else raise exception 'not_allowed';
  end if;
  if v_side = v_offer.created_by_side then raise exception 'cannot_counter_own_offer'; end if;

  update public.offers set status = 'countered' where id = v_offer.id;

  insert into public.offers (
    application_id, campaign_id, org_id, creator_id, version, parent_offer_id,
    created_by, created_by_side, price, delivery_days, revisions_included, message
  ) values (
    v_offer.application_id, v_offer.campaign_id, v_offer.org_id, v_offer.creator_id, v_offer.version + 1, v_offer.id,
    p_user, v_side, p_price, v_offer.delivery_days, v_offer.revisions_included, p_message
  ) returning id into v_new;

  if v_side = 'creator' then
    perform public.notify_org(v_offer.org_id, 'offer.countered', 'Creator countered your offer',
      'New price: ' || public.format_inr(p_price), jsonb_build_object('offer_id', v_new, 'application_id', v_offer.application_id));
  else
    perform public.notify_user(v_offer.creator_id, 'offer.countered', 'Brand countered',
      'New price: ' || public.format_inr(p_price), jsonb_build_object('offer_id', v_new, 'application_id', v_offer.application_id));
  end if;
  perform public.post_system_message(v_offer.application_id, p_user,
    initcap(v_side) || ' countered: ' || public.format_inr(p_price) || '.');
  return v_new;
end;
$$;

-- Accepting freezes the terms into a contract (plan B3). Returns the contract id (null on decline).
create or replace function public.respond_to_offer(p_offer uuid, p_user uuid, p_action text, p_ip text default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_campaign public.campaigns;
  v_side text;
  v_fees record;
  v_terms jsonb;
  v_contract uuid;
begin
  select * into v_offer from public.offers where id = p_offer for update;
  if not found then raise exception 'not_found'; end if;
  if v_offer.status <> 'sent' then raise exception 'invalid_state'; end if;
  if v_offer.expires_at < now() then raise exception 'offer_expired'; end if;

  if p_user = v_offer.creator_id then v_side := 'creator';
  elsif public.is_org_member(v_offer.org_id, p_user) then v_side := 'brand';
  else raise exception 'not_allowed';
  end if;
  if v_side = v_offer.created_by_side then raise exception 'cannot_respond_to_own_offer'; end if;

  if p_action = 'decline' then
    update public.offers set status = 'declined' where id = v_offer.id;
    update public.applications set status = 'shortlisted' where id = v_offer.application_id;
    perform public.post_system_message(v_offer.application_id, p_user, initcap(v_side) || ' declined the offer.');
    return null;
  elsif p_action <> 'accept' then
    raise exception 'invalid_action';
  end if;

  select * into v_campaign from public.campaigns where id = v_offer.campaign_id;
  select * into v_fees from public.compute_fees(v_offer.price);

  v_terms := jsonb_build_object(
    'campaign', jsonb_build_object(
      'id', v_campaign.id,
      'title', v_campaign.title,
      'brief', v_campaign.brief,
      'category', v_campaign.category,
      'compensation_type', v_campaign.compensation_type,
      'product_info', v_campaign.product_info,
      'usage_rights', v_campaign.usage_rights,
      'exclusivity_days', v_campaign.exclusivity_days,
      'disclosure_required', v_campaign.disclosure_required
    ),
    'deliverables', coalesce((
      select jsonb_agg(jsonb_build_object('kind', d.kind, 'platform', d.platform, 'format', d.format,
        'quantity', d.quantity, 'specs', d.specs) order by d.sort_order)
      from public.campaign_deliverables d where d.campaign_id = v_campaign.id
    ), '[]'::jsonb),
    'price', v_offer.price,
    'delivery_days', v_offer.delivery_days,
    'revisions_included', v_offer.revisions_included,
    'fees', jsonb_build_object(
      'brand_fee', v_fees.brand_fee, 'creator_fee', v_fees.creator_fee,
      'gst_on_fee', v_fees.gst_on_fee, 'brand_total', v_fees.brand_total, 'creator_payout', v_fees.creator_payout
    ),
    'cancellation', 'Full refund to the brand if cancelled before payment or before any submission.',
    'offer_id', v_offer.id,
    'offer_version', v_offer.version
  );

  insert into public.contracts (
    offer_id, application_id, campaign_id, org_id, creator_id, terms_snapshot, terms_hash,
    price, brand_fee, creator_fee, platform_fee, gst_on_fee, brand_total, creator_payout,
    revisions_included, accepted_by, accept_ip, due_at
  ) values (
    v_offer.id, v_offer.application_id, v_offer.campaign_id, v_offer.org_id, v_offer.creator_id,
    v_terms, encode(sha256(convert_to(v_terms::text, 'UTF8')), 'hex'),
    v_offer.price, v_fees.brand_fee, v_fees.creator_fee, v_fees.platform_fee, v_fees.gst_on_fee,
    v_fees.brand_total, v_fees.creator_payout,
    v_offer.revisions_included, p_user, p_ip, now() + make_interval(days => v_offer.delivery_days)
  ) returning id into v_contract;

  insert into public.contract_deliverables (contract_id, kind, platform, format, quantity, specs, sort_order)
  select v_contract, d.kind, d.platform, d.format, d.quantity, d.specs, d.sort_order
  from public.campaign_deliverables d where d.campaign_id = v_campaign.id;

  update public.offers set status = 'accepted' where id = v_offer.id;
  update public.applications set status = 'hired' where id = v_offer.application_id;

  perform public.notify_org(v_offer.org_id, 'contract.created', 'Offer accepted',
    'Fund ' || public.format_inr(v_fees.brand_total) || ' to start ' || v_campaign.title,
    jsonb_build_object('contract_id', v_contract));
  perform public.notify_user(v_offer.creator_id, 'contract.created', 'Contract created',
    'Waiting for the brand to fund the contract. You will be notified when work can start.',
    jsonb_build_object('contract_id', v_contract));
  perform public.post_system_message(v_offer.application_id, p_user,
    initcap(v_side) || ' accepted the offer. Contract created; waiting for the brand to fund it.');
  perform public.audit(p_user, 'offer.accepted', 'contract', v_contract::text,
    jsonb_build_object('ip', p_ip, 'terms_version', 'poc-2026-10'));
  return v_contract;
end;
$$;

create or replace function public.cancel_unfunded_contract(p_contract uuid, p_user uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_contract public.contracts;
begin
  select * into v_contract from public.contracts where id = p_contract for update;
  if not found then raise exception 'not_found'; end if;
  if not (v_contract.creator_id = p_user or public.is_org_member(v_contract.org_id, p_user)) then
    raise exception 'not_allowed';
  end if;
  if v_contract.status <> 'awaiting_funding' then raise exception 'invalid_state'; end if;

  update public.contracts set status = 'cancelled', closed_at = now() where id = p_contract;
  perform public.post_system_message(v_contract.application_id, p_user, 'Contract cancelled before payment.');
  perform public.audit(p_user, 'contract.cancelled', 'contract', p_contract::text);
end;
$$;

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------

-- Called after the server verified the payment (Razorpay signature or webhook, or mock provider).
-- Idempotent: a second call for the same order returns without writing anything.
create or replace function public.record_payment_captured(
  p_order_id text,
  p_payment_id text,
  p_amount integer,
  p_raw jsonb default '{}'
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_contract public.contracts;
  v_txn uuid := gen_random_uuid();
begin
  select * into v_payment from public.payments where provider_order_id = p_order_id for update;
  if not found then raise exception 'payment_not_found'; end if;
  if v_payment.status = 'captured' then return v_payment.contract_id; end if;
  if p_amount <> v_payment.amount then raise exception 'amount_mismatch'; end if;

  select * into v_contract from public.contracts where id = v_payment.contract_id for update;
  if v_contract.status <> 'awaiting_funding' then raise exception 'invalid_state'; end if;

  update public.payments
    set status = 'captured', provider_payment_id = p_payment_id, captured_at = now(), raw = p_raw
    where id = v_payment.id;
  update public.contracts set status = 'active', funded_at = now() where id = v_contract.id;

  -- Brand money arrives at the payment aggregator and is split on paper:
  insert into public.ledger_entries (txn_id, account, debit, credit, contract_id, memo) values
    (v_txn, 'escrow_hold', v_contract.brand_total, 0, v_contract.id, 'Brand funded contract'),
    (v_txn, 'creator_payable', 0, v_contract.creator_payout, v_contract.id, 'Owed to creator on approval'),
    (v_txn, 'platform_revenue', 0, v_contract.platform_fee, v_contract.id, 'Platform fee'),
    (v_txn, 'gst_payable', 0, v_contract.gst_on_fee, v_contract.id, 'GST on platform fee');

  perform public.notify_user(v_contract.creator_id, 'contract.funded', 'Payment secured. Start work!',
    public.format_inr(v_contract.creator_payout) || ' is held for you and released on approval.',
    jsonb_build_object('contract_id', v_contract.id));
  perform public.post_system_message(v_contract.application_id, v_contract.accepted_by,
    'Brand funded the contract. Payment is secured; work can start. Contact details are now visible in chat.');
  return v_contract.id;
end;
$$;

-- Marks a payout paid and writes the release entries. In the POC the transfer is simulated;
-- with Razorpay Route the server releases the on-hold transfer and the webhook calls this.
create or replace function public.settle_payout(p_payout uuid, p_provider_transfer_id text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_payout public.payouts;
  v_contract public.contracts;
  v_txn uuid := gen_random_uuid();
begin
  select * into v_payout from public.payouts where id = p_payout for update;
  if v_payout.status = 'paid' then return; end if;
  select * into v_contract from public.contracts where id = v_payout.contract_id for update;

  insert into public.ledger_entries (txn_id, account, debit, credit, contract_id, memo) values
    (v_txn, 'creator_payable', v_payout.amount, 0, v_contract.id, 'Payout released to creator'),
    (v_txn, 'escrow_hold', 0, v_payout.amount, v_contract.id, 'Payout released to creator');

  update public.payouts
    set status = 'paid', paid_at = now(), attempted_at = now(),
        provider_transfer_id = coalesce(p_provider_transfer_id, 'sim_' || replace(gen_random_uuid()::text, '-', ''))
    where id = v_payout.id;
  update public.contracts set status = 'paid_out', paid_out_at = now() where id = v_contract.id;
  update public.creator_profiles set completed_count = completed_count + 1 where user_id = v_contract.creator_id;

  perform public.notify_user(v_contract.creator_id, 'payout.paid', 'Payment sent',
    public.format_inr(v_payout.amount) || ' is on its way to your bank account.',
    jsonb_build_object('contract_id', v_contract.id));
  perform public.notify_org(v_contract.org_id, 'contract.completed', 'Contract complete',
    'Leave a review for the creator.', jsonb_build_object('contract_id', v_contract.id));
end;
$$;

create or replace function public.release_payout(p_contract uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_contract public.contracts;
  v_has_kyc boolean;
  v_payout uuid;
begin
  select * into v_contract from public.contracts where id = p_contract;
  if exists (select 1 from public.payouts where contract_id = p_contract) then return; end if;

  select exists (
    select 1 from public.payout_accounts pa
    where pa.user_id = v_contract.creator_id and pa.kyc_status in ('submitted', 'verified')
  ) into v_has_kyc;

  insert into public.payouts (contract_id, creator_id, amount, status)
  values (p_contract, v_contract.creator_id, v_contract.creator_payout, case when v_has_kyc then 'scheduled' else 'pending_kyc' end)
  returning id into v_payout;

  if v_has_kyc then
    perform public.settle_payout(v_payout);
  else
    perform public.notify_user(v_contract.creator_id, 'payout.kyc_needed', 'Add payout details',
      'Your work is approved. Add your PAN and bank account to receive ' || public.format_inr(v_contract.creator_payout) || '.',
      jsonb_build_object('contract_id', p_contract));
  end if;
end;
$$;

-- After a creator completes payout KYC, release anything that was waiting.
create or replace function public.release_pending_payouts(p_user uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_payout record;
  v_count integer := 0;
begin
  for v_payout in select id from public.payouts where creator_id = p_user and status = 'pending_kyc' loop
    update public.payouts set status = 'scheduled' where id = v_payout.id;
    perform public.settle_payout(v_payout.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Deliverables and submissions
-- ---------------------------------------------------------------------------

create or replace function public.submit_deliverable(
  p_deliverable uuid,
  p_user uuid,
  p_media_paths text[] default '{}',
  p_caption text default null,
  p_live_url text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_deliverable public.contract_deliverables;
  v_contract public.contracts;
  v_days integer;
  v_version integer;
  v_submission uuid;
  v_path text;
begin
  select * into v_deliverable from public.contract_deliverables where id = p_deliverable for update;
  if not found then raise exception 'not_found'; end if;
  select * into v_contract from public.contracts where id = v_deliverable.contract_id for update;

  if v_contract.creator_id <> p_user then raise exception 'not_allowed'; end if;
  if v_contract.status not in ('active', 'in_review', 'revision_requested') then raise exception 'invalid_state'; end if;
  if v_deliverable.status not in ('pending', 'changes_requested') then raise exception 'already_submitted'; end if;
  if coalesce(array_length(p_media_paths, 1), 0) = 0 and p_live_url is null then raise exception 'empty_submission'; end if;
  -- Influencer posts are approved against the live post (plan B3); drafts are shared in chat in the POC.
  if v_deliverable.kind = 'influencer_post' and p_live_url is null then raise exception 'live_url_required'; end if;

  foreach v_path in array coalesce(p_media_paths, '{}') loop
    if v_path not like v_contract.id::text || '/%' then raise exception 'invalid_media_path'; end if;
  end loop;

  select auto_approve_days into v_days from public.platform_settings where id = 1;
  select coalesce(max(version), 0) + 1 into v_version from public.submissions where contract_deliverable_id = p_deliverable;

  insert into public.submissions (
    contract_id, contract_deliverable_id, version, submitted_by, media_paths, caption, live_url, auto_approve_at
  ) values (
    v_contract.id, p_deliverable, v_version, p_user, coalesce(p_media_paths, '{}'), p_caption, p_live_url,
    now() + make_interval(days => v_days)
  ) returning id into v_submission;

  update public.contract_deliverables set status = 'submitted' where id = p_deliverable;
  update public.contracts set status = 'in_review' where id = v_contract.id;

  perform public.notify_org(v_contract.org_id, 'submission.new', 'New submission to review',
    'Review within ' || v_days || ' days or it will be approved automatically.',
    jsonb_build_object('contract_id', v_contract.id, 'submission_id', v_submission));
  return v_submission;
end;
$$;

create or replace function public.complete_if_all_approved(p_contract uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.contract_deliverables where contract_id = p_contract and status <> 'approved') then
    return;
  end if;
  update public.contracts set status = 'approved', approved_at = now() where id = p_contract;
  perform public.release_payout(p_contract);
end;
$$;

create or replace function public.approve_submission_internal(p_submission uuid, p_status text, p_reviewer uuid, p_note text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_sub public.submissions;
begin
  select * into v_sub from public.submissions where id = p_submission for update;
  update public.submissions
    set status = p_status, reviewed_by = p_reviewer, reviewed_at = now(), reviewer_note = p_note
    where id = p_submission;
  update public.contract_deliverables set status = 'approved', approved_at = now() where id = v_sub.contract_deliverable_id;
  perform public.notify_user(
    (select creator_id from public.contracts where id = v_sub.contract_id),
    'submission.approved',
    case when p_status = 'auto_approved' then 'Submission auto-approved' else 'Submission approved' end,
    coalesce(p_note, 'Nice work!'),
    jsonb_build_object('contract_id', v_sub.contract_id, 'submission_id', p_submission)
  );
  perform public.complete_if_all_approved(v_sub.contract_id);
end;
$$;

create or replace function public.review_submission(p_submission uuid, p_user uuid, p_decision text, p_note text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_sub public.submissions;
  v_deliverable public.contract_deliverables;
  v_contract public.contracts;
begin
  select * into v_sub from public.submissions where id = p_submission for update;
  if not found then raise exception 'not_found'; end if;
  select * into v_contract from public.contracts where id = v_sub.contract_id for update;
  select * into v_deliverable from public.contract_deliverables where id = v_sub.contract_deliverable_id for update;

  if not public.is_org_member(v_contract.org_id, p_user) then raise exception 'not_allowed'; end if;
  if v_sub.status <> 'submitted' then raise exception 'invalid_state'; end if;

  if p_decision = 'approve' then
    perform public.approve_submission_internal(p_submission, 'approved', p_user, p_note);
  elsif p_decision = 'request_changes' then
    if v_deliverable.revisions_used >= v_contract.revisions_included then raise exception 'no_revisions_left'; end if;
    update public.submissions
      set status = 'changes_requested', reviewed_by = p_user, reviewed_at = now(), reviewer_note = p_note
      where id = p_submission;
    update public.contract_deliverables
      set status = 'changes_requested', revisions_used = revisions_used + 1
      where id = v_deliverable.id;
    update public.contracts set status = 'revision_requested' where id = v_contract.id;
    perform public.notify_user(v_contract.creator_id, 'submission.changes_requested', 'Changes requested',
      coalesce(p_note, 'The brand asked for changes.'),
      jsonb_build_object('contract_id', v_contract.id, 'submission_id', p_submission));
  else
    raise exception 'invalid_decision';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviews (double-blind)
-- ---------------------------------------------------------------------------

create or replace function public.refresh_creator_rating(p_creator uuid)
returns void
language sql
set search_path = ''
as $$
  update public.creator_profiles cp set
    rating_avg = s.avg_rating,
    rating_count = s.n
  from (
    select round(avg(r.overall)::numeric, 2) as avg_rating, count(*)::integer as n
    from public.reviews r
    join public.contracts c on c.id = r.contract_id
    where c.creator_id = p_creator and r.author_side = 'brand' and r.visible_at <= now()
  ) s
  where cp.user_id = p_creator;
$$;

create or replace function public.submit_review(p_contract uuid, p_user uuid, p_overall integer, p_text text default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_contract public.contracts;
  v_side text;
  v_days integer;
  v_review uuid;
begin
  select * into v_contract from public.contracts where id = p_contract;
  if not found then raise exception 'not_found'; end if;
  if v_contract.status not in ('paid_out', 'closed') then raise exception 'invalid_state'; end if;

  if p_user = v_contract.creator_id then v_side := 'creator';
  elsif public.is_org_member(v_contract.org_id, p_user) then v_side := 'brand';
  else raise exception 'not_allowed';
  end if;

  select review_reveal_days into v_days from public.platform_settings where id = 1;

  insert into public.reviews (contract_id, author_id, author_side, overall, text, visible_at)
  values (p_contract, p_user, v_side, p_overall, p_text, now() + make_interval(days => v_days))
  on conflict (contract_id, author_side) do nothing
  returning id into v_review;
  if v_review is null then raise exception 'already_reviewed'; end if;

  -- Both sides reviewed: reveal both now.
  if (select count(*) from public.reviews where contract_id = p_contract) = 2 then
    update public.reviews set visible_at = now() where contract_id = p_contract;
  end if;

  perform public.refresh_creator_rating(v_contract.creator_id);
  return v_review;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduled job body (see 20261029000005_cron.sql)
-- ---------------------------------------------------------------------------

create or replace function public.run_scheduled_jobs()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_sub record;
  v_approved integer := 0;
  v_creator record;
begin
  -- Auto-approve submissions the brand did not act on (plan B3).
  for v_sub in
    select id from public.submissions where status = 'submitted' and auto_approve_at <= now()
    order by auto_approve_at limit 200
  loop
    perform public.approve_submission_internal(v_sub.id, 'auto_approved', null,
      'Approved automatically because the brand did not respond in time.');
    v_approved := v_approved + 1;
  end loop;

  -- Reviews whose blind period ended in the last day may change ratings.
  for v_creator in
    select distinct c.creator_id from public.reviews r join public.contracts c on c.id = r.contract_id
    where r.author_side = 'brand' and r.visible_at between now() - interval '1 day' and now()
  loop
    perform public.refresh_creator_rating(v_creator.creator_id);
  end loop;

  -- Expire stale offers.
  update public.offers set status = 'withdrawn' where status = 'sent' and expires_at < now();

  return jsonb_build_object('auto_approved', v_approved);
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions: workflow functions are server-only
-- ---------------------------------------------------------------------------

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.compute_fees(integer)',
    'public.notify_user(uuid, text, text, text, jsonb)',
    'public.notify_org(uuid, text, text, text, jsonb)',
    'public.post_system_message(uuid, uuid, text)',
    'public.audit(uuid, text, text, text, jsonb)',
    'public.set_application_status(uuid, uuid, text)',
    'public.send_offer(uuid, uuid, integer, integer, integer, text)',
    'public.counter_offer(uuid, uuid, integer, text)',
    'public.respond_to_offer(uuid, uuid, text, text)',
    'public.cancel_unfunded_contract(uuid, uuid)',
    'public.record_payment_captured(text, text, integer, jsonb)',
    'public.settle_payout(uuid, text)',
    'public.release_payout(uuid)',
    'public.release_pending_payouts(uuid)',
    'public.submit_deliverable(uuid, uuid, text[], text, text)',
    'public.complete_if_all_approved(uuid)',
    'public.approve_submission_internal(uuid, text, uuid, text)',
    'public.review_submission(uuid, uuid, text, text)',
    'public.refresh_creator_rating(uuid)',
    'public.submit_review(uuid, uuid, integer, text)',
    'public.run_scheduled_jobs()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;

revoke execute on function public.create_organisation(text, text, text, text, text, text) from public, anon;
grant execute on function public.create_organisation(text, text, text, text, text, text) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
