-- Airdrop registration: rounds, registrations and an atomic register function.
--
-- Access model: the browser never touches these tables. Everything goes through
-- the Edge Functions, which use the service role. Row level security is enabled
-- with no policies, so the anon and authenticated roles can read and write nothing.

create table public.rounds (
  id bigint generated always as identity primary key,
  name text not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  amount numeric not null check (amount > 0),             -- whole PRM tokens per wallet
  max_registrations integer check (max_registrations > 0), -- null means no cap
  status text not null default 'draft'
    check (status in ('draft', 'open', 'closed', 'built', 'live')),
  merkle_root text,
  airdrop_address text,
  created_at timestamptz not null default now(),
  check (closes_at > opens_at)
);

create table public.registrations (
  id bigint generated always as identity primary key,
  round_id bigint not null references public.rounds(id) on delete cascade,
  address text not null check (address ~ '^0x[0-9a-f]{40}$'), -- stored lowercase
  signature text not null,
  message text not null,
  created_at timestamptz not null default now(),
  unique (round_id, address)
);

alter table public.rounds enable row level security;
alter table public.registrations enable row level security;

revoke all on public.rounds from anon, authenticated;
revoke all on public.registrations from anon, authenticated;

-- Registers one wallet. Runs in a single transaction and locks the round row,
-- so the window check and the cap check cannot be raced by simultaneous requests.
-- Returns one of:
--   ok, round_not_found, not_open_yet, closed, already_registered, round_full
create or replace function public.register_wallet(
  p_round_id bigint,
  p_address text,
  p_signature text,
  p_message text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rounds%rowtype;
  current_count integer;
begin
  select * into r from public.rounds where id = p_round_id for update;

  if not found or r.status = 'draft' then
    return 'round_not_found';
  end if;
  if r.status <> 'open' then
    return 'closed';
  end if;
  if now() < r.opens_at then
    return 'not_open_yet';
  end if;
  if now() > r.closes_at then
    return 'closed';
  end if;

  if exists (
    select 1 from public.registrations
    where round_id = p_round_id and address = p_address
  ) then
    return 'already_registered';
  end if;

  if r.max_registrations is not null then
    select count(*) into current_count
    from public.registrations where round_id = p_round_id;
    if current_count >= r.max_registrations then
      return 'round_full';
    end if;
  end if;

  insert into public.registrations (round_id, address, signature, message)
  values (p_round_id, p_address, p_signature, p_message);

  return 'ok';
end;
$$;

revoke all on function public.register_wallet(bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function public.register_wallet(bigint, text, text, text)
  to service_role;

-- Round 1. To change the window, amount or cap later, edit this row in the
-- Table Editor. Times are stored in UTC.
insert into public.rounds (name, opens_at, closes_at, amount, max_registrations, status)
values (
  'Round 1',
  '2026-11-25 00:00:00+00',
  '2026-12-25 23:59:59+00',
  5000,
  100,
  'open'
);
