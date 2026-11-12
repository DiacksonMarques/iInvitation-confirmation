create or replace function public.update_group_guest(
    p_group_id uuid,
    p_guest_id uuid,
    p_name text,
    p_phone text,
    p_email text,
    p_is_primary_contact boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if nullif(trim(p_name), '') is null then
        raise exception 'Guest name cannot be empty'
            using errcode = '22023';
    end if;

    -- Serializa a troca de contato principal dentro do grupo.
    perform 1
    from public.invitation_groups
    where id = p_group_id
    for update;

    if not found then
        raise exception 'Invitation group not found'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from public.guests
        where id = p_guest_id
          and invitation_group_id = p_group_id
    ) then
        raise exception 'Guest does not belong to this group'
            using errcode = '22023';
    end if;

    if p_is_primary_contact then
        update public.guests
        set is_primary_contact = false
        where invitation_group_id = p_group_id
          and is_primary_contact = true
          and id <> p_guest_id;
    end if;

    update public.guests
    set
        name = trim(p_name),
        phone = nullif(trim(p_phone), ''),
        email = nullif(trim(p_email), ''),
        is_primary_contact = p_is_primary_contact
    where id = p_guest_id
      and invitation_group_id = p_group_id;
end;
$$;

revoke all
on function public.update_group_guest(uuid, uuid, text, text, text, boolean)
from public, anon;

grant execute
on function public.update_group_guest(uuid, uuid, text, text, text, boolean)
to authenticated;
