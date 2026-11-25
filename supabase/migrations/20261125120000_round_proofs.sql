-- Round proofs: one Merkle proof per registered wallet, per round.
--
-- Filled by scripts/exportRegistrations.js after a round closes.
-- Same access model as the registration tables: row level security is on with
-- no policies, so anon and authenticated can read and write nothing. The app
-- will read a wallet's own proof through an Edge Function, so the browser still
-- needs only VITE_SUPABASE_URL and the full list of wallets is never exposed.

create table public.round_proofs (
  round_id bigint not null references public.rounds(id) on delete cascade,
  address text not null check (address ~ '^0x[0-9a-f]{40}$'), -- stored lowercase
  amount text not null,       -- raw units (18 decimals), as in src/merkle.json
  proof jsonb not null,       -- array of bytes32 hex strings
  created_at timestamptz not null default now(),
  primary key (round_id, address)
);

alter table public.round_proofs enable row level security;

revoke all on public.round_proofs from anon, authenticated;

-- The export script and the Edge Functions connect as service_role.
-- Granted explicitly because auto-grant is off on this project.
grant select, insert, delete on public.round_proofs to service_role;
