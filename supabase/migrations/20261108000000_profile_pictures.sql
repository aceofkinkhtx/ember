-- Profile pictures for everyone.
--
-- Each picture is shrunk, stripped of location and camera details, and locked
-- on the phone before upload, so the bucket holds only locked bytes. The key
-- travels inside the locked connection card, so only connections can open it.
-- Files live at <owner id>/avatar. Your connections can download yours while
-- you're connected; once a connection ends, they can't.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 524288, array['application/octet-stream'])
on conflict (id) do nothing;

create policy "avatars: owner and connections read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_connected(((storage.foldername(name))[1])::uuid, (select auth.uid()))
    )
  );
create policy "avatars: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: owner replaces" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
