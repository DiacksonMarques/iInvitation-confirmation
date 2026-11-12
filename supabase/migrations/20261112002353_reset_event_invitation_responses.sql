create or replace function public.reset_event_invitation_responses(
  p_event_invitation_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.event_invitations
    where id = p_event_invitation_id
  ) then
    raise exception 'Event invitation not found';
  end if;

  update public.event_invitation_guests
  set status = 'pending'
  where event_invitation_id = p_event_invitation_id
    and status <> 'pending';

  delete from public.gift_selections
  where event_invitation_id = p_event_invitation_id;
end;
$$;

revoke all on function public.reset_event_invitation_responses(uuid)
  from public, anon;

grant execute on function public.reset_event_invitation_responses(uuid)
  to authenticated;
