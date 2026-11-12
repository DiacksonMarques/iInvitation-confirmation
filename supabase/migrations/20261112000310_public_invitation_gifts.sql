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
        and coalesce(event.confirmation_deadline, event.event_date) >= now(),
      'can_select_gifts',
        event.status = 'active'
        and coalesce(event.confirmation_deadline, event.event_date) >= now()
        and exists (
          select 1
          from public.event_invitation_guests as confirmed_guest
          where confirmed_guest.event_invitation_id = invitation.id
            and confirmed_guest.status = 'confirmed'
        )
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
    ),
    'gifts',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'event_gift_id', event_gift.id,
            'name', gift.name,
            'description', gift.description,
            'total_quantity', event_gift.total_quantity,
            'selected_quantity', coalesce(current_selection.quantity, 0),
            'available_quantity',
              event_gift.total_quantity - other_selections.quantity
          )
          order by gift.name
        ),
        '[]'::jsonb
      )
      from public.event_gifts as event_gift
      join public.gifts as gift
        on gift.id = event_gift.gift_id
      left join public.gift_selections as current_selection
        on current_selection.event_gift_id = event_gift.id
        and current_selection.event_invitation_id = invitation.id
      cross join lateral (
        select coalesce(sum(selection.quantity), 0)::integer as quantity
        from public.gift_selections as selection
        where selection.event_gift_id = event_gift.id
          and selection.event_invitation_id <> invitation.id
      ) as other_selections
      where event_gift.event_id = event.id
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

create or replace function public.save_public_gift_selections(
  p_access_token uuid,
  p_selections jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_invitation_id uuid;
begin
  if p_selections is null or jsonb_typeof(p_selections) <> 'array' then
    raise exception 'Selections must be an array';
  end if;

  select invitation.id
  into target_invitation_id
  from public.event_invitations as invitation
  join public.events as event
    on event.id = invitation.event_id
  where invitation.access_token = p_access_token
    and event.status = 'active'
    and event.archived_at is null
    and coalesce(event.confirmation_deadline, event.event_date) >= now()
    and exists (
      select 1
      from public.event_invitation_guests as confirmed_guest
      where confirmed_guest.event_invitation_id = invitation.id
        and confirmed_guest.status = 'confirmed'
    )
  for update of invitation;

  if target_invitation_id is null then
    raise exception 'Invitation is not allowed to select gifts';
  end if;

  delete from public.gift_selections
  where event_invitation_id = target_invitation_id;

  insert into public.gift_selections (
    event_invitation_id,
    event_gift_id,
    quantity
  )
  select
    target_invitation_id,
    selection.event_gift_id,
    selection.quantity
  from jsonb_to_recordset(p_selections) as selection(
    event_gift_id uuid,
    quantity integer
  );
end;
$$;

revoke all on function public.save_public_gift_selections(uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.get_public_invitation(uuid)
  to anon, authenticated;
grant execute on function public.save_public_gift_selections(uuid, jsonb)
  to anon, authenticated;
