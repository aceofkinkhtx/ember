-- M4: scene designs.
--
-- Each design is locked on the designer's phone (sealed to their own key)
-- before upload. The server stores only the locked box and two dates: not the
-- title, the partner, the activities or anything else about the scene.
-- Sharing a design or its SceneVibe with a partner comes in later milestones.

create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  sealed_scene text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scenes_owner on public.scenes (owner_id);

alter table public.scenes enable row level security;

create policy "scenes: owner reads" on public.scenes
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "scenes: owner creates" on public.scenes
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "scenes: owner edits" on public.scenes
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "scenes: owner deletes" on public.scenes
  for delete to authenticated using (owner_id = (select auth.uid()));

-- Only the locked box and the update time can change.
revoke update on public.scenes from authenticated;
grant update (sealed_scene, updated_at) on public.scenes to authenticated;
