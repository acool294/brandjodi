-- End-to-end check of the paid loop: org -> campaign -> apply -> offer/counter -> contract -> fund ->
-- submit -> revise -> approve -> KYC -> payout -> double-blind reviews, plus RLS and masking checks.
-- Runs as superuser (= service role) unless a block does `set role authenticated`.

create function pg_temp.ok(cond boolean, label text) returns text language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'ASSERT FAILED: %', label; end if; return 'ok: ' || label; end $$;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000b', 'brand@test.dev', '{"full_name":"Brand Owner"}'),
 ('00000000-0000-0000-0000-00000000000c', 'creator@test.dev', '{}'),
 ('00000000-0000-0000-0000-00000000000d', 'stranger@test.dev', '{}');
select pg_temp.ok((select count(*) = 3 from public.profiles), 'profiles auto-created') as check;

-- Brand creates org and campaign as authenticated user
set role authenticated;
set request.jwt.claim.role = 'authenticated';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select public.create_organisation('Glow Co', 'https://glow.test', 'Skincare', 'Mumbai', null, '27ABCDE1234F1Z5') is not null as created;
insert into public.campaigns (org_id, created_by, title, brief, category, budget_per_creator, status)
  select id, '00000000-0000-0000-0000-00000000000b', 'Sunscreen UGC', 'Three reels showing morning routine with our SPF', 'skincare', 1000000, 'published' from public.organisations;
insert into public.campaign_deliverables (campaign_id, kind, platform, format, quantity) select id, 'ugc_asset', 'instagram', 'reel', 2 from public.campaigns;
select pg_temp.ok((select published_at is not null from public.campaigns), 'published_at set') as check;

-- Brand cannot set verification on their own org
do $$ begin
  begin update public.organisations set verification_status = 'verified'; raise exception 'should fail';
  exception when insufficient_privilege then null; end;
end $$;

-- Creator onboards and applies
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
insert into public.creator_profiles (user_id, username, display_name, city, categories, creator_types)
  values ('00000000-0000-0000-0000-00000000000c', 'priya.creates', 'Priya', 'Pune', '{skincare}', '{ugc}');
do $$ begin
  begin update public.creator_profiles set metrics_verified = true; raise exception 'should fail';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.ok((select count(*) = 1 from public.campaigns), 'creator sees published campaign') as check;
insert into public.applications (campaign_id, creator_id, quoted_price, delivery_days, pitch)
  select id, '00000000-0000-0000-0000-00000000000c', 1200000, 7, 'I make skincare reels with great engagement' from public.campaigns;
select pg_temp.ok((select count(*) = 1 from public.conversations), 'conversation created and visible to creator') as check;

-- Masking before funding
insert into public.messages (conversation_id, sender_id, body)
  select id, '00000000-0000-0000-0000-00000000000c', 'WhatsApp me on +91 98765 43210 or priya@gmail.com, UPI priya@okhdfc' from public.conversations;
select pg_temp.ok((select masked and body not like '%98765%' and body not like '%gmail%' and body not like '%okhdfc%' from public.messages), 'contact details masked') as check;
select body as masked_body from public.messages;

-- Creator cannot touch contracts / ledger directly
select pg_temp.ok((select count(*) = 0 from public.ledger_entries), 'creator cannot read ledger') as check;

-- Stranger sees no application or conversation
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select pg_temp.ok((select count(*) = 0 from public.applications), 'stranger: no applications') as check;
select pg_temp.ok((select count(*) = 0 from public.messages), 'stranger: no messages') as check;
reset role;
set request.jwt.claim.role = '';

-- Server workflows (service role)
select public.send_offer((select id from public.applications), '00000000-0000-0000-0000-00000000000b', 1000000, 7, 1, 'Can you do 10k?') is not null as offer1;
do $$ begin
  begin perform public.respond_to_offer((select id from public.offers where status='sent'), '00000000-0000-0000-0000-00000000000b', 'accept', null);
    raise exception 'brand accepted own offer';
  exception when raise_exception then if sqlerrm <> 'cannot_respond_to_own_offer' then raise; end if; end;
end $$;
select public.counter_offer((select id from public.offers where status='sent'), '00000000-0000-0000-0000-00000000000c', 1100000, 'Meet at 11k?') is not null as counter;
select public.respond_to_offer((select id from public.offers where status='sent'), '00000000-0000-0000-0000-00000000000b', 'accept', '1.2.3.4') is not null as contract;
select pg_temp.ok((select price = 1100000 and brand_fee = 110000 and gst_on_fee = 19800 and brand_total = 1229800 and creator_payout = 1100000 and status = 'awaiting_funding' from public.contracts), 'fees snapshot') as check;
select pg_temp.ok((select count(*) = 1 from public.contract_deliverables), 'deliverables copied') as check;
select pg_temp.ok((select status = 'hired' from public.applications), 'application hired') as check;

-- Funding
insert into public.payments (contract_id, provider, provider_order_id, amount) select id, 'mock', 'mock_order_1', brand_total from public.contracts;
do $$ begin
  begin perform public.record_payment_captured('mock_order_1', 'pay_x', 1, '{}'); raise exception 'amount check missing';
  exception when raise_exception then if sqlerrm <> 'amount_mismatch' then raise; end if; end;
end $$;
select public.record_payment_captured('mock_order_1', 'mock_pay_1', 1229800, '{}') is not null as funded;
select public.record_payment_captured('mock_order_1', 'mock_pay_1', 1229800, '{}') is not null as funded_again_idempotent;
select pg_temp.ok((select count(*) = 4 from public.ledger_entries), 'one ledger txn only') as check;
select pg_temp.ok((select sum(debit) = sum(credit) from public.ledger_entries), 'ledger balanced after funding') as check;
select pg_temp.ok((select status = 'active' from public.contracts), 'contract active') as check;

-- After funding, contact sharing allowed
set role authenticated;
set request.jwt.claim.role = 'authenticated';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
insert into public.messages (conversation_id, sender_id, body) select id, '00000000-0000-0000-0000-00000000000c', 'Call 9876543210' from public.conversations;
select pg_temp.ok((select not masked from public.messages where body = 'Call 9876543210'), 'no masking after funding') as check;
select pg_temp.ok((select count(*) = 0 from public.payments), 'creator cannot see brand payments') as check;
reset role;
set request.jwt.claim.role = '';

-- Delivery: bad path rejected, then submit, request changes, resubmit, approve
do $$ begin
  begin perform public.submit_deliverable((select id from public.contract_deliverables), '00000000-0000-0000-0000-00000000000c', array['other/x.jpg'], null, null);
    raise exception 'path check missing';
  exception when raise_exception then if sqlerrm <> 'invalid_media_path' then raise; end if; end;
end $$;
select public.submit_deliverable((select id from public.contract_deliverables), '00000000-0000-0000-0000-00000000000c',
  array[(select id::text from public.contracts) || '/00000000-0000-0000-0000-00000000000c/a.mp4'], 'v1', null) is not null as sub1;
select public.review_submission((select id from public.submissions where version = 1), '00000000-0000-0000-0000-00000000000b', 'request_changes', 'Brighter lighting please');
select pg_temp.ok((select status = 'revision_requested' from public.contracts), 'revision requested') as check;
select public.submit_deliverable((select id from public.contract_deliverables), '00000000-0000-0000-0000-00000000000c',
  array[(select id::text from public.contracts) || '/00000000-0000-0000-0000-00000000000c/b.mp4'], 'v2', null) is not null as sub2;
do $$ begin
  begin perform public.review_submission((select id from public.submissions where version = 2), '00000000-0000-0000-0000-00000000000b', 'request_changes', 'again');
    raise exception 'revision limit missing';
  exception when raise_exception then if sqlerrm <> 'no_revisions_left' then raise; end if; end;
end $$;
select public.review_submission((select id from public.submissions where version = 2), '00000000-0000-0000-0000-00000000000b', 'approve', 'Love it');
select pg_temp.ok((select status = 'approved' from public.contracts), 'contract approved, waiting for kyc') as check;
select pg_temp.ok((select status = 'pending_kyc' from public.payouts), 'payout pending kyc') as check;

-- KYC unlocks payout
insert into public.payout_accounts (user_id, account_holder, pan_last4, bank_last4, ifsc) values ('00000000-0000-0000-0000-00000000000c', 'Priya', '234F', '6789', 'HDFC0001234');
select public.release_pending_payouts('00000000-0000-0000-0000-00000000000c') = 1 as released;
select pg_temp.ok((select status = 'paid' from public.payouts), 'payout paid') as check;
select pg_temp.ok((select status = 'paid_out' from public.contracts), 'contract paid out') as check;
select pg_temp.ok((select sum(debit) = sum(credit) from public.ledger_entries), 'ledger balanced after payout') as check;
select pg_temp.ok((select coalesce(sum(credit) - sum(debit), 0) = 0 from public.ledger_entries where account = 'creator_payable'), 'creator_payable cleared') as check;
select pg_temp.ok((select sum(debit) - sum(credit) = 129800 from public.ledger_entries where account = 'escrow_hold'), 'escrow holds fee + gst') as check;
do $$ begin
  begin delete from public.ledger_entries; raise exception 'ledger mutable';
  exception when raise_exception then if sqlerrm <> 'ledger_is_append_only' and sqlerrm <> 'ledger_entries is append-only' then raise; end if; end;
end $$;

-- Double-blind reviews
select public.submit_review((select id from public.contracts), '00000000-0000-0000-0000-00000000000b', 5, 'Great') is not null as r1;
set role authenticated;
set request.jwt.claim.role = 'authenticated';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.ok((select count(*) = 0 from public.reviews), 'brand review hidden from creator') as check;
reset role;
set request.jwt.claim.role = '';
select public.submit_review((select id from public.contracts), '00000000-0000-0000-0000-00000000000c', 4, 'Clear brief') is not null as r2;
select pg_temp.ok((select count(*) = 2 from public.reviews where visible_at <= now()), 'both revealed') as check;
select pg_temp.ok((select rating_avg = 5 and rating_count = 1 and completed_count = 1 from public.creator_profiles), 'creator stats') as check;

-- Notifications and push fan-out
select pg_temp.ok((select count(*) > 5 from public.notifications), 'notifications written') as check;
insert into public.push_tokens (token, user_id, platform) values ('ExponentPushToken[x]', '00000000-0000-0000-0000-00000000000c', 'android');
select public.notify_user('00000000-0000-0000-0000-00000000000c', 'test', 'Hello', 'World');
select pg_temp.ok((select count(*) = 1 from net.calls), 'push sent via pg_net') as check;

-- Scheduled job and fee formatting
select public.run_scheduled_jobs() as jobs;
select public.format_inr(1229800) as inr1, public.format_inr(1000000) as inr2, public.format_inr(12345) as inr3;
-- Workflow functions are not callable by clients
set role authenticated;
set request.jwt.claim.role = 'authenticated';
do $$ begin
  begin perform public.release_pending_payouts('00000000-0000-0000-0000-00000000000c'); raise exception 'client could call workflow';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set request.jwt.claim.role = '';
-- Clients can't use the helpers to probe other users
set role authenticated;
set request.jwt.claim.role = 'authenticated';
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
select pg_temp.ok(not public.is_org_member((select id from public.organisations), '00000000-0000-0000-0000-00000000000b'), 'p_user ignored for clients') as check;
reset role;
set request.jwt.claim.role = '';
select 'all checks passed' as check;
