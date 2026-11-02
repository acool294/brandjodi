-- Scheduled jobs (pg_cron) and push notifications (pg_net -> Expo push API).
-- Both extensions are available on the Supabase free plan.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Auto-approval, review reveal and offer expiry every 15 minutes.
select cron.schedule('brandjodi-scheduled-jobs', '*/15 * * * *', $$select public.run_scheduled_jobs()$$);

-- Every in-app notification is also sent as an Expo push to the user's devices.
-- Expo push needs no API key for basic sends. Failures are ignored (pg_net is fire-and-forget).
create or replace function public.notifications_send_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_messages jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'to', t.token,
    'title', new.title,
    'body', coalesce(new.body, ''),
    'data', new.data || jsonb_build_object('type', new.type),
    'sound', 'default'
  ))
  into v_messages
  from public.push_tokens t
  where t.user_id = new.user_id and t.platform in ('ios', 'android');

  if v_messages is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_messages,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.notifications_send_push() from public, anon, authenticated;

create trigger notifications_send_push after insert on public.notifications
  for each row execute function public.notifications_send_push();
