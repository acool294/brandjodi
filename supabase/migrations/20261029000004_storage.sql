-- Storage buckets and policies.
-- avatars/<user_id>/...            public read, owner writes
-- portfolio/<user_id>/...          public read, owner writes
-- submissions/<contract_id>/<user_id>/...  private; contract parties read, the creator writes

-- Text-based so a malformed path can never raise a uuid cast error inside a policy.
create or replace function public.can_access_contract_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contracts c
    where c.id::text = p_folder
      and (c.creator_id = (select auth.uid()) or public.is_org_member(c.org_id) or public.is_admin())
  );
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('portfolio', 'portfolio', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
  ('submissions', 'submissions', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

create policy "avatars & portfolio: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('avatars', 'portfolio') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars & portfolio: owner updates" on storage.objects
  for update to authenticated
  using (bucket_id in ('avatars', 'portfolio') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars & portfolio: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id in ('avatars', 'portfolio') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "submissions: contract parties read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and public.can_access_contract_folder((storage.foldername(name))[1])
  );

create policy "submissions: creator uploads to own active contract" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1 from public.contracts c
      where c.id::text = (storage.foldername(name))[1]
        and c.creator_id = (select auth.uid())
        and c.status in ('active', 'in_review', 'revision_requested')
    )
  );
