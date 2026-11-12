create or replace function public.get_public_invitation(
  p_access_token uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'event',
    jsonb_build_object(
      'name', event.name,
      'description', event.description,
      'event_date', event.event_date,
      'confirmation_deadline', event.confirmation_deadline,
      'location', event.location,
      'invitation_message', event.invitation_message,
      'status', event.status,
      'can_confirm',
        event.status = 'active'
        and coalesce(event.confirmation_deadline, event.event_date) >= now()
    ),
    'guests',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'invitation_guest_id', event_guest.id,
            'name', guest.name,
            'status', event_guest.status
          )
          order by guest.name
        ),
        '[]'::jsonb
      )
      from public.event_invitation_guests as event_guest
      join public.guests as guest
        on guest.id = event_guest.guest_id
      where event_guest.event_invitation_id = invitation.id
    )
  )
  from public.event_invitations as invitation
  join public.events as event
    on event.id = invitation.event_id
  where invitation.access_token = p_access_token
    and event.archived_at is null
    and event.status <> 'draft'
  limit 1;
$$;

create or replace function public.respond_to_public_invitation(
  p_access_token uuid,
  p_invitation_guest_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_rows integer;
begin
  if p_status is null or p_status not in ('confirmed', 'declined') then
    raise exception 'Invalid invitation response';
  end if;

  update public.event_invitation_guests as event_guest
  set status = p_status
  from public.event_invitations as invitation
  join public.events as event
    on event.id = invitation.event_id
  where event_guest.event_invitation_id = invitation.id
    and invitation.access_token = p_access_token
    and event_guest.id = p_invitation_guest_id
    and event.status = 'active'
    and event.archived_at is null
    and coalesce(event.confirmation_deadline, event.event_date) >= now();

  get diagnostics updated_rows = row_count;

  if updated_rows = 0 then
    raise exception 'Invitation not found or confirmation period has ended';
  end if;
end;
$$;

revoke all on function public.get_public_invitation(uuid)
  from public, anon, authenticated;
revoke all on function public.respond_to_public_invitation(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.get_public_invitation(uuid)
  to anon, authenticated;
grant execute on function public.respond_to_public_invitation(uuid, uuid, text)
  to anon, authenticated;
