create or replace function public.split_event_invitation(
  p_event_invitation_id uuid,
  p_invitation_label text,
  p_guest_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_event_id uuid;
  source_group_id uuid;
  source_guest_count integer;
  selected_guest_count integer;
  distinct_guest_count integer;
  new_invitation_id uuid;
begin
  if p_guest_ids is null or cardinality(p_guest_ids) = 0 then
    raise exception 'Select at least one guest';
  end if;

  select event_id, invitation_group_id
  into source_event_id, source_group_id
  from public.event_invitations
  where id = p_event_invitation_id
  for update;

  if not found then
    raise exception 'Event invitation not found';
  end if;

  select count(*)::integer
  into source_guest_count
  from public.event_invitation_guests
  where event_invitation_id = p_event_invitation_id;

  select count(distinct selected_guest)::integer
  into distinct_guest_count
  from unnest(p_guest_ids) as selected(selected_guest);

  if distinct_guest_count <> cardinality(p_guest_ids) then
    raise exception 'A guest cannot be selected more than once';
  end if;

  select count(*)::integer
  into selected_guest_count
  from public.event_invitation_guests
  where event_invitation_id = p_event_invitation_id
    and guest_id = any(p_guest_ids)
    and status = 'pending';

  if selected_guest_count <> cardinality(p_guest_ids) then
    raise exception 'Selected guests must belong to this invitation and be pending';
  end if;

  if exists (
    select 1
    from public.event_invitation_guests
    where event_invitation_id = p_event_invitation_id
      and status <> 'pending'
  ) then
    raise exception 'Reset responses before splitting this invitation';
  end if;

  if exists (
    select 1
    from public.gift_selections
    where event_invitation_id = p_event_invitation_id
  ) then
    raise exception 'Remove gift selections before splitting this invitation';
  end if;

  if cardinality(p_guest_ids) >= source_guest_count then
    raise exception 'At least one guest must remain in the original invitation';
  end if;

  insert into public.event_invitations (
    event_id,
    invitation_group_id,
    invitation_label
  )
  values (
    source_event_id,
    source_group_id,
    nullif(trim(p_invitation_label), '')
  )
  returning id into new_invitation_id;

  update public.event_invitation_guests
  set event_invitation_id = new_invitation_id
  where event_invitation_id = p_event_invitation_id
    and guest_id = any(p_guest_ids);
end;
$$;

revoke all on function public.split_event_invitation(uuid, text, uuid[])
  from public, anon;

grant execute on function public.split_event_invitation(uuid, text, uuid[])
  to authenticated;
