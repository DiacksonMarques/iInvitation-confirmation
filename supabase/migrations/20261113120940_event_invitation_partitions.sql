alter table public.event_invitations
  drop constraint if exists unique_group_per_event;

alter table public.event_invitations
  add column if not exists invitation_label text;

create or replace function public.create_event_invitation_partitions(
  p_event_id uuid,
  p_invitation_group_id uuid,
  p_partitions jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  partition jsonb;
  new_invitation_id uuid;
  guest_reference_count bigint;
  unique_guest_count bigint;
begin
  if jsonb_typeof(p_partitions) is distinct from 'array'
     or jsonb_array_length(p_partitions) = 0 then
    raise exception 'At least one invitation is required';
  end if;

  perform 1
  from public.invitation_groups
  where id = p_invitation_group_id
  for update;

  if not found then
    raise exception 'Invitation group not found';
  end if;

  if not exists (
    select 1
    from public.events
    where id = p_event_id
  ) then
    raise exception 'Event not found';
  end if;

  if exists (
    select 1
    from public.event_invitations
    where event_id = p_event_id
      and invitation_group_id = p_invitation_group_id
  ) then
    raise exception 'This group is already associated with the event';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_partitions) as item(value)
    where case
      when jsonb_typeof(item.value -> 'guest_ids') = 'array'
        then jsonb_array_length(item.value -> 'guest_ids') = 0
      else true
    end
  ) then
    raise exception 'Each invitation must contain at least one guest';
  end if;

  select count(*), count(distinct guest.value::uuid)
  into guest_reference_count, unique_guest_count
  from jsonb_array_elements(p_partitions) as item(value)
  cross join lateral jsonb_array_elements_text(
    item.value -> 'guest_ids'
  ) as guest(value);

  if guest_reference_count <> unique_guest_count then
    raise exception 'A guest cannot appear in more than one invitation';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_partitions) as item(value)
    cross join lateral jsonb_array_elements_text(
      item.value -> 'guest_ids'
    ) as selected_guest(value)
    left join public.guests as guest
      on guest.id = selected_guest.value::uuid
      and guest.invitation_group_id = p_invitation_group_id
    where guest.id is null
  ) then
    raise exception 'A selected guest does not belong to this group';
  end if;

  for partition in
    select value
    from jsonb_array_elements(p_partitions) as item(value)
  loop
    insert into public.event_invitations (
      event_id,
      invitation_group_id,
      invitation_label
    )
    values (
      p_event_id,
      p_invitation_group_id,
      nullif(trim(partition ->> 'label'), '')
    )
    returning id into new_invitation_id;

    insert into public.event_invitation_guests (
      event_invitation_id,
      guest_id,
      status
    )
    select
      new_invitation_id,
      guest.value::uuid,
      'pending'
    from jsonb_array_elements_text(
      partition -> 'guest_ids'
    ) as guest(value);
  end loop;
end;
$$;

revoke all on function public.create_event_invitation_partitions(uuid, uuid, jsonb)
  from public, anon;

grant execute on function public.create_event_invitation_partitions(uuid, uuid, jsonb)
  to authenticated;

revoke all on function public.attach_event_invitation_groups(uuid, uuid[])
  from public, anon, authenticated;
