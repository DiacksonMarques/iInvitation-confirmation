-- =========================================================
-- Admin authorization
-- =========================================================

-- Helper functions used by RLS should live outside the exposed
-- public schema.
create schema if not exists private;


-- Checks whether the currently authenticated user
-- is registered as an application administrator.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.admin_profiles
        where user_id = (select auth.uid())
    );
$$;

-- Do not let every database role execute the function.
revoke all on function private.is_admin() from public;
revoke all on function private.is_admin() from anon;

grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;


-- =========================================================
-- Grants
-- =========================================================
-- GRANT allows the authenticated role to attempt these operations.
-- RLS policies below decide whether the specific user may actually do it.

grant select, insert, update, delete
on table public.events
to authenticated;

grant select, insert, update, delete
on table public.invitation_groups
to authenticated;

grant select, insert, update, delete
on table public.guests
to authenticated;

grant select, insert, update, delete
on table public.event_invitations
to authenticated;

grant select, insert, update, delete
on table public.event_invitation_guests
to authenticated;

grant select, insert, update, delete
on table public.gifts
to authenticated;

grant select, insert, update, delete
on table public.event_gifts
to authenticated;

grant select, insert, update, delete
on table public.gift_selections
to authenticated;


-- =========================================================
-- Events
-- =========================================================

create policy "Admins can select events"
on public.events
for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can insert events"
on public.events
for insert
to authenticated
with check ((select private.is_admin()));

create policy "Admins can update events"
on public.events
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can delete events"
on public.events
for delete
to authenticated
using ((select private.is_admin()));


-- =========================================================
-- Invitation groups
-- =========================================================

create policy "Admins can select invitation groups"
on public.invitation_groups
for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can insert invitation groups"
on public.invitation_groups
for insert
to authenticated
with check ((select private.is_admin()));

create policy "Admins can update invitation groups"
on public.invitation_groups
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can delete invitation groups"
on public.invitation_groups
for delete
to authenticated
using ((select private.is_admin()));


-- =========================================================
-- Guests
-- =========================================================

create policy "Admins can select guests"
on public.guests
for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can insert guests"
on public.guests
for insert
to authenticated
with check ((select private.is_admin()));

create policy "Admins can update guests"
on public.guests
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can delete guests"
on public.guests
for delete
to authenticated
using ((select private.is_admin()));


-- =========================================================
-- Event invitations
-- =========================================================

create policy "Admins can select event invitations"
on public.event_invitations
for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can insert event invitations"
on public.event_invitations
for insert
to authenticated
with check ((select private.is_admin()));

create policy "Admins can update event invitations"
on public.event_invitations
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can delete event invitations"
on public.event_invitations
for delete
to authenticated
using ((select private.is_admin()));


-- =========================================================
-- Event invitation guests
-- =========================================================

create policy "Admins can select event invitation guests"
on public.event_invitation_guests
for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can insert event invitation guests"
on public.event_invitation_guests
for insert
to authenticated
with check ((select private.is_admin()));

create policy "Admins can update event invitation guests"
on public.event_invitation_guests
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can delete event invitation guests"
on public.event_invitation_guests
for delete
to authenticated
using ((select private.is_admin()));


-- =========================================================
-- Gifts
-- =========================================================

create policy "Admins can select gifts"
on public.gifts
for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can insert gifts"
on public.gifts
for insert
to authenticated
with check ((select private.is_admin()));

create policy "Admins can update gifts"
on public.gifts
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can delete gifts"
on public.gifts
for delete
to authenticated
using ((select private.is_admin()));


-- =========================================================
-- Event gifts
-- =========================================================

create policy "Admins can select event gifts"
on public.event_gifts
for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can insert event gifts"
on public.event_gifts
for insert
to authenticated
with check ((select private.is_admin()));

create policy "Admins can update event gifts"
on public.event_gifts
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can delete event gifts"
on public.event_gifts
for delete
to authenticated
using ((select private.is_admin()));


-- =========================================================
-- Gift selections
-- =========================================================

create policy "Admins can select gift selections"
on public.gift_selections
for select
to authenticated
using ((select private.is_admin()));

create policy "Admins can insert gift selections"
on public.gift_selections
for insert
to authenticated
with check ((select private.is_admin()));

create policy "Admins can update gift selections"
on public.gift_selections
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Admins can delete gift selections"
on public.gift_selections
for delete
to authenticated
using ((select private.is_admin()));
