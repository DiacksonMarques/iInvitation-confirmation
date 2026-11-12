create or replace function public.delete_or_archive_event(
    p_event_id uuid
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
    -- Se já existe atividade relacionada ao evento,
    -- preservamos o histórico e apenas arquivamos.
    if exists (
        select 1
        from public.event_invitations
        where event_id = p_event_id
    )
    or exists (
        select 1
        from public.event_gifts
        where event_id = p_event_id
    )
    then
        update public.events
        set
            status = 'closed',
            archived_at = now()
        where id = p_event_id;

        return 'archived';
    end if;

    -- Sem dependências, pode apagar fisicamente.
    delete from public.events
    where id = p_event_id;

    return 'deleted';
end;
$$;

revoke all
on function public.delete_or_archive_event(uuid)
from public, anon;

grant execute
on function public.delete_or_archive_event(uuid)
to authenticated;
