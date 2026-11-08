-- Invitation Confirmation
-- Initial database schema
-- Generated for Supabase / PostgreSQL

-- =========================================================
-- 1. Shared trigger helpers
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;


-- =========================================================
-- 2. Events
-- =========================================================

create table public.events (
    id uuid primary key default gen_random_uuid(),

    name text not null,
    description text,

    event_date timestamptz not null,
    confirmation_deadline timestamptz,

    location text,
    invitation_message text,

    status text not null default 'draft'
        check (status in ('draft', 'active', 'closed')),

    archived_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint confirmation_deadline_before_event
        check (
            confirmation_deadline is null
            or confirmation_deadline <= event_date
        )
);

create or replace function public.set_event_confirmation_deadline()
returns trigger
language plpgsql
as $$
begin
    if new.confirmation_deadline is null then
        new.confirmation_deadline = new.event_date;
    end if;

    return new;
end;
$$;

create trigger set_event_confirmation_deadline
before insert or update on public.events
for each row
execute function public.set_event_confirmation_deadline();

create trigger set_events_updated_at
before update on public.events
for each row
execute function public.set_updated_at();


-- =========================================================
-- 3. Invitation groups
-- =========================================================

create table public.invitation_groups (
    id uuid primary key default gen_random_uuid(),

    name text not null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger set_invitation_groups_updated_at
before update on public.invitation_groups
for each row
execute function public.set_updated_at();


-- =========================================================
-- 4. Guests
-- =========================================================

create table public.guests (
    id uuid primary key default gen_random_uuid(),

    invitation_group_id uuid not null
        references public.invitation_groups(id),

    name text not null,
    phone text,
    email text,

    is_primary_contact boolean not null default false,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index one_primary_contact_per_group
on public.guests (invitation_group_id)
where is_primary_contact = true;

create index idx_guests_invitation_group_id
on public.guests (invitation_group_id);

create trigger set_guests_updated_at
before update on public.guests
for each row
execute function public.set_updated_at();


-- =========================================================
-- 5. Event invitations
-- =========================================================

create table public.event_invitations (
    id uuid primary key default gen_random_uuid(),

    event_id uuid not null
        references public.events(id),

    invitation_group_id uuid not null
        references public.invitation_groups(id),

    access_code text not null
        default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),

    access_token uuid not null
        default gen_random_uuid(),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint unique_group_per_event
        unique (event_id, invitation_group_id),

    constraint unique_access_code_per_event
        unique (event_id, access_code),

    constraint unique_access_token
        unique (access_token)
);

create or replace function public.normalize_event_invitation_access_code()
returns trigger
language plpgsql
as $$
begin
    if new.access_code is null or trim(new.access_code) = '' then
        raise exception 'Access code cannot be empty';
    end if;

    new.access_code = upper(trim(new.access_code));

    return new;
end;
$$;

create trigger normalize_event_invitation_access_code
before insert or update of access_code
on public.event_invitations
for each row
execute function public.normalize_event_invitation_access_code();

create index idx_event_invitations_invitation_group_id
on public.event_invitations (invitation_group_id);

create trigger set_event_invitations_updated_at
before update on public.event_invitations
for each row
execute function public.set_updated_at();


-- =========================================================
-- 6. Guests invited to an event
-- =========================================================

create table public.event_invitation_guests (
    id uuid primary key default gen_random_uuid(),

    event_invitation_id uuid not null
        references public.event_invitations(id),

    guest_id uuid not null
        references public.guests(id),

    status text not null default 'pending'
        check (status in ('pending', 'confirmed', 'declined')),

    confirmed_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint unique_guest_per_event_invitation
        unique (event_invitation_id, guest_id)
);

create or replace function public.validate_event_invitation_guest()
returns trigger
language plpgsql
as $$
declare
    invitation_group uuid;
    guest_group uuid;
begin
    select invitation_group_id
    into invitation_group
    from public.event_invitations
    where id = new.event_invitation_id;

    select invitation_group_id
    into guest_group
    from public.guests
    where id = new.guest_id;

    if invitation_group is distinct from guest_group then
        raise exception 'Guest does not belong to the invitation group';
    end if;

    return new;
end;
$$;

create trigger validate_event_invitation_guest
before insert or update
on public.event_invitation_guests
for each row
execute function public.validate_event_invitation_guest();

create or replace function public.set_guest_confirmation_timestamp()
returns trigger
language plpgsql
as $$
begin
    if new.status = 'confirmed' then
        if tg_op = 'INSERT'
           or old.status is distinct from 'confirmed'
        then
            new.confirmed_at = now();
        else
            -- Preserve the original confirmation timestamp.
            new.confirmed_at = old.confirmed_at;
        end if;
    else
        new.confirmed_at = null;
    end if;

    return new;
end;
$$;

create trigger set_guest_confirmation_timestamp
before insert or update
on public.event_invitation_guests
for each row
execute function public.set_guest_confirmation_timestamp();

create index idx_event_invitation_guests_guest_id
on public.event_invitation_guests (guest_id);

create index idx_event_invitation_guests_invitation_status
on public.event_invitation_guests (event_invitation_id, status);

create trigger set_event_invitation_guests_updated_at
before update on public.event_invitation_guests
for each row
execute function public.set_updated_at();


-- Prevent moving a guest to a different invitation group after the
-- guest is already participating in an event invitation.
create or replace function public.prevent_used_guest_group_change()
returns trigger
language plpgsql
as $$
begin
    if new.invitation_group_id is distinct from old.invitation_group_id
       and exists (
            select 1
            from public.event_invitation_guests
            where guest_id = old.id
       )
    then
        raise exception
            'Cannot change invitation group for a guest already linked to an event invitation';
    end if;

    return new;
end;
$$;

create trigger prevent_used_guest_group_change
before update of invitation_group_id
on public.guests
for each row
execute function public.prevent_used_guest_group_change();


-- =========================================================
-- 7. Reusable gift catalog
-- =========================================================

create table public.gifts (
    id uuid primary key default gen_random_uuid(),

    name text not null,
    description text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger set_gifts_updated_at
before update on public.gifts
for each row
execute function public.set_updated_at();


-- =========================================================
-- 8. Gifts available in each event
-- =========================================================

create table public.event_gifts (
    id uuid primary key default gen_random_uuid(),

    event_id uuid not null
        references public.events(id),

    gift_id uuid not null
        references public.gifts(id),

    total_quantity integer not null
        check (total_quantity > 0),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint unique_gift_per_event
        unique (event_id, gift_id)
);

create index idx_event_gifts_gift_id
on public.event_gifts (gift_id);

create trigger set_event_gifts_updated_at
before update on public.event_gifts
for each row
execute function public.set_updated_at();


-- =========================================================
-- 9. Gift selections
-- =========================================================

create table public.gift_selections (
    id uuid primary key default gen_random_uuid(),

    event_invitation_id uuid not null
        references public.event_invitations(id),

    event_gift_id uuid not null
        references public.event_gifts(id),

    quantity integer not null
        check (quantity > 0),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint unique_gift_selection_per_invitation
        unique (event_invitation_id, event_gift_id)
);

create index idx_gift_selections_event_gift_id
on public.gift_selections (event_gift_id);

create trigger set_gift_selections_updated_at
before update on public.gift_selections
for each row
execute function public.set_updated_at();


-- Validate gift/event consistency, confirmed presence and stock.
create or replace function public.validate_gift_selection()
returns trigger
language plpgsql
as $$
declare
    invitation_event uuid;
    gift_event uuid;
    gift_total_quantity integer;
    already_selected integer;
begin
    select event_id
    into invitation_event
    from public.event_invitations
    where id = new.event_invitation_id;

    select event_id, total_quantity
    into gift_event, gift_total_quantity
    from public.event_gifts
    where id = new.event_gift_id
    for update;

    if invitation_event is distinct from gift_event then
        raise exception
            'Gift does not belong to the same event as the invitation';
    end if;

    if not exists (
        select 1
        from public.event_invitation_guests
        where event_invitation_id = new.event_invitation_id
          and status = 'confirmed'
    ) then
        raise exception
            'At least one guest must be confirmed before selecting gifts';
    end if;

    select coalesce(sum(quantity), 0)
    into already_selected
    from public.gift_selections
    where event_gift_id = new.event_gift_id
      and (
          new.id is null
          or id <> new.id
      );

    if already_selected + new.quantity > gift_total_quantity then
        raise exception
            'Selected quantity exceeds the available gift quantity';
    end if;

    return new;
end;
$$;

create trigger validate_gift_selection
before insert or update
on public.gift_selections
for each row
execute function public.validate_gift_selection();


-- Prevent an admin from reducing the event gift total below what
-- guests have already selected.
create or replace function public.validate_event_gift_total_quantity()
returns trigger
language plpgsql
as $$
declare
    selected_quantity integer;
begin
    select coalesce(sum(quantity), 0)
    into selected_quantity
    from public.gift_selections
    where event_gift_id = new.id;

    if new.total_quantity < selected_quantity then
        raise exception
            'Total quantity cannot be lower than the quantity already selected';
    end if;

    return new;
end;
$$;

create trigger validate_event_gift_total_quantity
before update of total_quantity
on public.event_gifts
for each row
execute function public.validate_event_gift_total_quantity();


-- If an invitation no longer has any confirmed guest, release all gifts
-- selected by that invitation.
create or replace function public.release_gifts_when_no_confirmed_guests()
returns trigger
language plpgsql
as $$
declare
    old_invitation_id uuid;
    new_invitation_id uuid;
begin
    if tg_op = 'DELETE' then
        old_invitation_id = old.event_invitation_id;

        if not exists (
            select 1
            from public.event_invitation_guests
            where event_invitation_id = old_invitation_id
              and status = 'confirmed'
        ) then
            delete from public.gift_selections
            where event_invitation_id = old_invitation_id;
        end if;

        return null;
    end if;

    old_invitation_id = old.event_invitation_id;
    new_invitation_id = new.event_invitation_id;

    if not exists (
        select 1
        from public.event_invitation_guests
        where event_invitation_id = old_invitation_id
          and status = 'confirmed'
    ) then
        delete from public.gift_selections
        where event_invitation_id = old_invitation_id;
    end if;

    if new_invitation_id is distinct from old_invitation_id
       and not exists (
            select 1
            from public.event_invitation_guests
            where event_invitation_id = new_invitation_id
              and status = 'confirmed'
       )
    then
        delete from public.gift_selections
        where event_invitation_id = new_invitation_id;
    end if;

    return null;
end;
$$;

create trigger release_gifts_when_no_confirmed_guests
after update of status, event_invitation_id or delete
on public.event_invitation_guests
for each row
execute function public.release_gifts_when_no_confirmed_guests();


-- Prevent changing the event/group identity of an invitation once it has
-- dependent guest participation or gift selections.
create or replace function public.prevent_used_event_invitation_reassignment()
returns trigger
language plpgsql
as $$
begin
    if (
        new.event_id is distinct from old.event_id
        or new.invitation_group_id is distinct from old.invitation_group_id
    )
    and (
        exists (
            select 1
            from public.event_invitation_guests
            where event_invitation_id = old.id
        )
        or exists (
            select 1
            from public.gift_selections
            where event_invitation_id = old.id
        )
    )
    then
        raise exception
            'Cannot reassign an event invitation that already has related activity';
    end if;

    return new;
end;
$$;

create trigger prevent_used_event_invitation_reassignment
before update of event_id, invitation_group_id
on public.event_invitations
for each row
execute function public.prevent_used_event_invitation_reassignment();


-- Prevent changing the event/gift identity of an event gift once it
-- already has selections.
create or replace function public.prevent_used_event_gift_reassignment()
returns trigger
language plpgsql
as $$
begin
    if (
        new.event_id is distinct from old.event_id
        or new.gift_id is distinct from old.gift_id
    )
    and exists (
        select 1
        from public.gift_selections
        where event_gift_id = old.id
    )
    then
        raise exception
            'Cannot reassign an event gift that already has selections';
    end if;

    return new;
end;
$$;

create trigger prevent_used_event_gift_reassignment
before update of event_id, gift_id
on public.event_gifts
for each row
execute function public.prevent_used_event_gift_reassignment();


-- =========================================================
-- 10. Administrative users
-- =========================================================
-- An Auth user becomes an application admin only after a corresponding
-- row is deliberately created here. We do not auto-promote new signups.

create table public.admin_profiles (
    user_id uuid primary key
        references auth.users(id) on delete cascade,

    display_name text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger set_admin_profiles_updated_at
before update on public.admin_profiles
for each row
execute function public.set_updated_at();


-- =========================================================
-- 11. Row Level Security
-- =========================================================
-- The initial migration intentionally exposes no client access.
-- Public invitation access and authenticated admin access will be added
-- later with explicit policies / RPC functions.

alter table public.events enable row level security;
alter table public.invitation_groups enable row level security;
alter table public.guests enable row level security;
alter table public.event_invitations enable row level security;
alter table public.event_invitation_guests enable row level security;
alter table public.gifts enable row level security;
alter table public.event_gifts enable row level security;
alter table public.gift_selections enable row level security;
alter table public.admin_profiles enable row level security;

revoke all on table public.events from anon, authenticated;
revoke all on table public.invitation_groups from anon, authenticated;
revoke all on table public.guests from anon, authenticated;
revoke all on table public.event_invitations from anon, authenticated;
revoke all on table public.event_invitation_guests from anon, authenticated;
revoke all on table public.gifts from anon, authenticated;
revoke all on table public.event_gifts from anon, authenticated;
revoke all on table public.gift_selections from anon, authenticated;
revoke all on table public.admin_profiles from anon, authenticated;
