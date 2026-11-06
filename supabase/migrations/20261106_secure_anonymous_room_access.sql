-- Capital multiplayer uses anonymous Supabase Auth identities plus room-code
-- membership. A publishable API key by itself must not read/write game state.

alter table public.rooms
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create table if not exists public.room_members (
  room_code text not null references public.rooms(code) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_code, user_id)
);

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

drop policy if exists "room members can read their room" on public.rooms;
drop policy if exists "room owner can create room" on public.rooms;
drop policy if exists "room owner can update room" on public.rooms;
drop policy if exists "room owner can delete room" on public.rooms;

create policy "room members can read their room"
  on public.rooms for select to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.room_members rm
      where rm.room_code = rooms.code and rm.user_id = (select auth.uid())
    )
  );

create policy "room owner can create room"
  on public.rooms for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "room owner can update room"
  on public.rooms for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "room owner can delete room"
  on public.rooms for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "users can read their memberships" on public.room_members;
drop policy if exists "users can join rooms as themselves" on public.room_members;
drop policy if exists "users can leave their rooms" on public.room_members;

create policy "users can read their memberships"
  on public.room_members for select to authenticated
  using (user_id = (select auth.uid()));

-- The room_code foreign key confirms the room exists without exposing a room
-- listing. Knowing the invite code is the explicit authority to join that room.
create policy "users can join rooms as themselves"
  on public.room_members for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "users can leave their rooms"
  on public.room_members for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.rooms from anon;
revoke all on public.room_members from anon;
revoke all on public.rooms from authenticated;
revoke all on public.room_members from authenticated;
grant select on public.rooms to authenticated;
grant insert (code, state, owner_id) on public.rooms to authenticated;
grant update (state, updated_at) on public.rooms to authenticated;
grant delete on public.rooms to authenticated;
grant select, insert, delete on public.room_members to authenticated;

drop policy if exists "room members can receive realtime" on realtime.messages;
drop policy if exists "room members can send realtime" on realtime.messages;

create policy "room members can receive realtime"
  on realtime.messages for select to authenticated
  using (
    extension in ('broadcast', 'presence')
    and left((select realtime.topic()), length('capital-v21-room-')) = 'capital-v21-room-'
    and exists (
      select 1 from public.room_members rm
      where rm.room_code = substring((select realtime.topic()) from length('capital-v21-room-') + 1)
        and rm.user_id = (select auth.uid())
    )
  );

create policy "room members can send realtime"
  on realtime.messages for insert to authenticated
  with check (
    extension in ('broadcast', 'presence')
    and left((select realtime.topic()), length('capital-v21-room-')) = 'capital-v21-room-'
    and exists (
      select 1 from public.room_members rm
      where rm.room_code = substring((select realtime.topic()) from length('capital-v21-room-') + 1)
        and rm.user_id = (select auth.uid())
    )
  );

-- This event-trigger helper remains available to the database owner for its
-- trigger, but must not be executable through the public Data API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
