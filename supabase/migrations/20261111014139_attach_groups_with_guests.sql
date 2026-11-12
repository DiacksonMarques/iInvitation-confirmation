create or replace function public.attach_event_invitation_groups(
  p_event_id uuid,
  p_group_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  selected_group_ids uuid[] := coalesce(p_group_ids, '{}'::uuid[]);
begin
  if cardinality(selected_group_ids) = 0 then
    return;
  end if;

  insert into public.event_invitations (
    event_id,
    invitation_group_id
  )
  select
    p_event_id,
    selected.group_id
  from unnest(selected_group_ids) as selected(group_id)
  on conflict (event_id, invitation_group_id) do nothing;

  insert into public.event_invitation_guests (
    event_invitation_id,
    guest_id,
    status
  )
  select
    invitation.id,
    guest.id,
    'pending'
  from public.event_invitations as invitation
  join public.guests as guest
    on guest.invitation_group_id = invitation.invitation_group_id
  where invitation.event_id = p_event_id
    and invitation.invitation_group_id = any(selected_group_ids)
  on conflict (event_invitation_id, guest_id) do nothing;
end;
$$;

revoke all on function public.attach_event_invitation_groups(uuid, uuid[])
  from public, anon;

grant execute on function public.attach_event_invitation_groups(uuid, uuid[])
  to authenticated;
