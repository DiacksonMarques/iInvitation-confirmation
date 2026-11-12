create or replace function public.sync_event_invitation_guests(
  p_event_invitation_id uuid,
  p_guest_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  selected_guest_ids uuid[] := coalesce(p_guest_ids, '{}'::uuid[]);
begin
  if not exists (
    select 1
    from public.event_invitations
    where id = p_event_invitation_id
  ) then
    raise exception 'Event invitation not found';
  end if;

  delete from public.event_invitation_guests
  where event_invitation_id = p_event_invitation_id
    and not (guest_id = any(selected_guest_ids));

  insert into public.event_invitation_guests (
    event_invitation_id,
    guest_id,
    status
  )
  select
    p_event_invitation_id,
    guest_id,
    'pending'
  from unnest(selected_guest_ids) as selected(guest_id)
  on conflict (event_invitation_id, guest_id) do nothing;
end;
$$;

create or replace function public.remove_event_invitation(
  p_event_invitation_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.gift_selections
  where event_invitation_id = p_event_invitation_id;

  delete from public.event_invitation_guests
  where event_invitation_id = p_event_invitation_id;

  delete from public.event_invitations
  where id = p_event_invitation_id;

  if not found then
    raise exception 'Event invitation not found';
  end if;
end;
$$;

revoke all on function public.sync_event_invitation_guests(uuid, uuid[])
  from public, anon;
revoke all on function public.remove_event_invitation(uuid)
  from public, anon;

grant execute on function public.sync_event_invitation_guests(uuid, uuid[])
  to authenticated;
grant execute on function public.remove_event_invitation(uuid)
  to authenticated;
