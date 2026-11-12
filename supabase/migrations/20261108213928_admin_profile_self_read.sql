-- Allow authenticated users to check only their own admin profile.
-- This lets the frontend determine whether the current user is an admin
-- without exposing other administrators.

grant select
on table public.admin_profiles
to authenticated;

create policy "Users can view their own admin profile"
on public.admin_profiles
for select
to authenticated
using (
    (select auth.uid()) = user_id
);
