# Project Plan: Primus dApp (Practice Mode)

Working plan for everything after Phase 3. It records what is already built, the decisions that are locked in, and the design for the next phase (airdrop registration with Supabase). Update it as decisions change.

- Live demo: https://primus-dapp.vercel.app (Sepolia testnet)
- Repo: https://github.com/deprimus01/airdrop-checker
- Goal: a portfolio project that shows blockchain knowledge end to end, on a testnet, with no real money involved.

---

## 1. Where we are

| Phase | What | Status |
|-------|------|--------|
| 1 | Wallet connect, network switch, off-chain eligibility check | Done |
| 2 | PRM ERC-20 token, Merkle tree, MerkleAirdrop contract, claim from the app | Done |
| 2.5 | Uniswap v4 ETH/PRM pool on Sepolia, live price card | Done |
| 3 | Allowlist NFT (PrimusNFT) and soulbound claim badge (PrimusBadge) | Done |
| 4 | Airdrop registration with Supabase (this plan, section 3) | Code complete and tested locally; needs Supabase setup, deploy and a Vercel env var |
| 5 | Dashboard, swap page, pool stats, transaction history | Planned |
| 6 | Staking and governance | Planned |
| Polish | Token logo and Add-to-MetaMask button, demo video, custom domain, MetaMask warning report | Planned |

### Deployed on Sepolia

| Contract | Address |
|----------|---------|
| PrimusToken (PRM) | `0xA0f6517d67Ae29486C73c70f26E5cB57a4B6F760` |
| MerkleAirdrop (round 1 of the original list) | `0x2036ED85651486BB53ca2F4Ed1747eD6230Ddf1b` |
| PrimusNFT | `0x6d48C2B7479dC5574529471f39d4FB0bf27F45b6` |
| PrimusBadge | `0x867816Bc5107463f16e92073De5D418Daa8087b0` |
| Uniswap v4 pool ID | `0xc2b2ec193b0294cfd3c05eea38956a5f350b55e59a245128051e8bc7e3a6e674` |

---

## 2. Locked decisions

| Topic | Decision |
|-------|----------|
| Registration purpose | Sign up to qualify for the airdrop |
| Backend | Supabase |
| Database | PostgreSQL (not MySQL) |
| Amount per wallet | Flat 5,000 PRM for everyone, stored on the round |
| Registration cap | 100 wallets (500,000 PRM in total), enforced by the server |
| Edge Function deployment | Supabase CLI, with the functions kept in the repo under `supabase/functions/` |
| Wallet balance requirement | None. Registration must work with zero Sepolia ETH |
| Registration window | Opens 25 Nov 2026, closes 25 Dec 2026. Stored in the database (in UTC) so it can be edited later |
| Proof of wallet ownership | Sign a message (no gas), verified on the server |
| NFTs | PrimusNFT is transferable, PrimusBadge is soulbound |
| UI style | Lucide icons only, no emojis, dark theme as it is now |
| Chain | Sepolia testnet only |

---

## 3. Phase 4: Airdrop registration (Supabase)

### 3.1 User flow

1. The user opens the app and sees a **Registration** card with the round name, the amount per wallet and the window dates.
2. The card has one of these states: not open yet, open, registered, closed.
3. During the window, a connected wallet clicks **Register for airdrop**.
4. MetaMask asks the user to sign a short message. This costs no gas and works with zero ETH.
5. The app sends the address, message and signature to a Supabase Edge Function.
6. The function verifies the signature, checks the window, rejects duplicates and saves the address.
7. The card changes to **Registered** for that wallet, and survives a refresh.

### 3.2 Architecture

```
React app (Vercel)
   |  GET  /registration-info?address=...  -> Edge Function "registration-info"
   |  POST /register {address, roundId, issuedAt, signature} -> Edge Function "register"
   v
Edge Functions (Deno, use the project's secret key, never exposed to the browser)
   -> verify the signature with ethers verifyMessage
   -> call the database function register_wallet (one transaction, locks the round row)
   v
PostgreSQL: rounds, registrations (row level security on, no policies)
```

Why everything goes through Edge Functions: the browser has no direct access to the tables at all, so the signature check, the window check and the cap cannot be bypassed. This also means the frontend needs only the project URL, with no publishable (anon) key.

### 3.3 Database schema

The real, tested version is in `supabase/migrations/20261122120000_airdrop_registration.sql`. It also adds the atomic `register_wallet` function (window, duplicate and cap checks in one locked transaction) and inserts Round 1. The SQL below shows the table shapes.

```sql
create table public.rounds (
  id bigint generated always as identity primary key,
  name text not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  amount numeric not null check (amount > 0),   -- whole tokens per wallet
  max_registrations integer check (max_registrations > 0),  -- optional cap, null = no cap
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
  address text not null check (address ~ '^0x[0-9a-f]{40}$'),  -- stored lowercase
  signature text not null,
  message text not null,
  created_at timestamptz not null default now(),
  unique (round_id, address)
);

alter table public.rounds enable row level security;
alter table public.registrations enable row level security;

-- No policies on either table: the browser (anon and authenticated roles) can read and
-- write nothing. Only the Edge Functions, using the secret key, can touch the data.
```

Editing the window later is a change to one row in the Supabase Table Editor (`opens_at`, `closes_at`, `amount`). No redeploy is needed. Times are stored in UTC and shown in the user's local time.

### 3.4 What the user signs

```
Primus dApp airdrop registration

I am registering this wallet for the airdrop.

Wallet: 0x...
Round: 1
Chain: Sepolia (11155111)
Issued at: 2026-11-23T10:00:00.000Z
```

The server rejects the request if:

- the signature does not recover to the stated wallet
- the round id in the message does not match the request
- `Issued at` is older than about 10 minutes (prevents replaying an old signature)
- the message does not follow this exact format

### 3.5 Edge Function rules

`register`:

1. Parse and validate the body (address format, round id, message, signature).
2. Verify the signature and the message fields.
3. Load the round and check `now()` is between `opens_at` and `closes_at`, using the database clock and not the browser's.
4. If the round has a `max_registrations` cap, reject new registrations once the count reaches it.
5. Insert the lowercase address. The `unique (round_id, address)` constraint blocks duplicates, and a duplicate returns a friendly "already registered" response.
6. Return a small JSON result. Never return the list of other registrants.

`registration-status`: takes an address and a round id and returns only `{ registered: true | false }`.

Errors the UI must handle: window not open, window closed, round full, invalid signature, already registered, rate limited, network failure, user rejected the signature.

### 3.6 Frontend changes

| Item | Change |
|------|--------|
| New component | `RegistrationCard.jsx` with the four states, a countdown or date display, and the register button |
| New util | `src/utils/registration.js`: fetch the round, sign the message, call the Edge Function, check status |
| App layout | Show the card for any connected wallet, in the main column near the claim section |
| Env vars | `VITE_SUPABASE_URL` only, in `.env.local` and in the Vercel project settings |
| Dependencies | None required (plain `fetch`). `@supabase/supabase-js` is optional |

No key is needed in the browser. The **secret (service role) key must never be committed or sent to the browser.** Supabase supplies it to the Edge Functions itself, and it is only needed locally later for the export script, in a `.env` that stays out of git.

### 3.7 Abuse protection

With no ETH requirement, one person can create many wallets (a Sybil attack). The base design only stops fake addresses and duplicates, not many real wallets. Options, in order of effort:

1. **Baseline (included):** signature check, window check, unique address per round.
2. **Light rate limit:** limit requests per IP in the Edge Function.
3. **Bot check:** a CAPTCHA such as Cloudflare Turnstile on the register button.
4. **Manual review:** export the list and remove suspicious entries before building the tree.

Plan: ship the baseline, and add 2 or 3 only if spam shows up. Decide before launch.

### 3.8 After the window closes: from registrations to claims

1. Set the round `status` to `closed` (or let the time pass).
2. Run an export script with the service role key. It writes the registered addresses for the round.
3. The script applies the flat `amount` to every address and builds the Merkle tree, same format as today (`[address, amount in 18 decimals]`).
4. Deploy a new `MerkleAirdrop` with the PRM address and the new root, then fund it with `registrations x amount` PRM.
5. Update the round row: `merkle_root`, `airdrop_address`, `status = 'live'`.
6. The app reads the live round and lets registered wallets claim.

**Round-aware claiming.** Today the app has one hardcoded airdrop address and a bundled `merkle.json`. For rounds, the plan is to store each round's proofs in a public table, so a new round needs no redeploy of the frontend:

```sql
create table public.round_proofs (
  round_id bigint not null references public.rounds(id) on delete cascade,
  address text not null,
  amount text not null,          -- raw units, as in merkle.json
  proof jsonb not null,
  primary key (round_id, address)
);
alter table public.round_proofs enable row level security;
create policy "proofs are public to read"
  on public.round_proofs for select using (true);
```

Proofs are public by design (they only prove membership), so a public read policy is fine. The claim flow then reads the airdrop address from the live round and the wallet's proof from `round_proofs`.

### 3.9 Build order

Status: steps 2 and 3 are written and tested locally (SQL migration on a Postgres engine, function logic with 12 unit tests, the browser code end to end against the real handlers). Steps 1, 4 and the deploy are done by running the commands in `supabase/README.md`.

1. Create the Supabase project, run the schema, insert round 1 with the chosen dates and amount.
2. Write and deploy the `register` and `registration-status` Edge Functions.
3. Build `registration.js` and `RegistrationCard.jsx`, wire into `App.jsx`.
4. Test every state and every error on localhost, then on Vercel.
5. Update the README and this plan.
6. Later, at window close: export script, new airdrop, `round_proofs`, round-aware claim flow.

Steps 1 to 5 are the registration feature. Step 6 is a separate task that can wait until a round actually closes.

### 3.10 Test checklist

| Test | Expected result |
|------|-----------------|
| Open before `opens_at` | "Opens on ..." state, no register button |
| Register with zero ETH | Works, no gas needed |
| Register twice | Second attempt says already registered |
| Refresh after registering | Still shows Registered |
| Reject the signature in MetaMask | Friendly message, nothing saved |
| Register after `closes_at` | Closed state, server rejects direct calls too |
| Register when the cap is reached | "Round full" state, server rejects direct calls too |
| Call the Edge Function directly with a bad signature | Rejected |
| Reuse an old signature | Rejected (issued-at too old) |
| Try to insert into `registrations` from the browser key | Blocked by row level security |
| Edit `closes_at` in the table | App reflects the new date without a deploy |

---

## 4. Phase 5: Dashboard, swap page, pool stats, history

| Feature | Approach | Notes |
|---------|----------|-------|
| Dashboard | PRM and ETH balances, NFT and badge ownership, claim and registration status | Mostly reads that already exist |
| Transaction history | Wallet activity for PRM, claims and mints | Event log queries hit RPC range limits (we already hit this once), so use the Etherscan API or a similar indexer, to be verified |
| Pool stats | Liquidity from the StateView contract, price history from stored samples | Volume and history need an indexer or periodic snapshots, to be verified |
| Swap page | Easiest: a deep link to the Uniswap app with the PRM pair preselected. Building a native swap on v4 needs Universal Router, Permit2 and a quoter | The native swap is a large task. Decide later whether the deep link is enough |

---

## 5. Phase 6: Staking and governance

**Staking.** A new `PrimusStaking` contract: users stake PRM and earn PRM at a fixed rate per second, paid from a pool funded by the owner (a standard "staking rewards" design). The UI needs the approve then stake flow, pending rewards, claim and unstake. Reward funding comes from the owner's PRM balance.

**Governance.** Important constraint: the deployed `PrimusToken` is a plain ERC-20, which cannot track voting power over time. Options:

1. Deploy a new token with voting support and migrate (new pool, new airdrop). Cleanest, most work.
2. A wrapper token: users wrap PRM into a voting version and vote with that. Keeps the current token.
3. Off-chain voting: signed votes counted by balance at a snapshot block, stored in the database. Simplest.

Decide when this phase starts. Option 3 reuses the signature pattern from Phase 4.

---

## 6. Polish track

| Item | Detail |
|------|--------|
| Token logo | Green PRM coin saved as `public/prm-logo.png` (512x512), gives a public URL after deploy |
| Add PRM to MetaMask | A button using `wallet_watchAsset` with the logo URL |
| Demo material | Screenshots or a screen recording of the full flow for the README |
| MetaMask warning | Report the false positive to MetaMask support, and consider a custom domain |
| README | Update after each phase |

---

## 7. Conventions

- Lowercase addresses in code and database, checksum only for display.
- Every transaction: simulate with `staticCall`, estimate gas, add a 30% buffer, then send.
- Contracts that act for a user take an explicit `account` argument (works with MetaMask "Added protection").
- Read-only data uses a public RPC so it works before a wallet is connected.
- No secrets in the repo. `.env` files stay out of git.
- Lucide icons, no emojis, consistent card styling.
- Each Merkle root and URI that is stored on-chain is permanent: finalize inputs before deploying.

---

## 8. Decisions and open questions

| # | Question | Status |
|---|----------|--------|
| 1 | Registration dates | Decided: opens 25 Nov 2026, closes 25 Dec 2026. Assumed UTC (open at 00:00 UTC on 25 Nov, close at 23:59 UTC on 25 Dec). Change the times in the table any time |
| 2 | Amount per wallet | Decided: 5,000 PRM (changed from 10,000) |
| 3 | Edge Function deployment | Decided: Supabase CLI (comparison kept in the notes below) |
| 4 | Registration cap | Decided: 100 wallets, which is 500,000 PRM. PRM has a fixed supply (about 1,000,000 minted, no mint function), so the cap protects the funding |
| 5 | Existing airdrop | Open: keep the current contract as a separate "launch" claim, or show only the new round |
| 6 | Abuse protection at launch | Open: baseline only (suggested), or add a rate limit or CAPTCHA |

**Funding math.** Total needed is `registrants x 5,000 PRM`. With the cap of 100 wallets that is at most 500,000 PRM. The deployer wallet holds roughly 976,000 PRM today, which leaves about 476,000 PRM for staking rewards and other uses. Without a cap, 196 or more registrants would be more than the wallet can fund.

**Edge Function deployment, compared (CLI chosen).**

| | Supabase CLI | Dashboard editor |
|---|---|---|
| Setup | Install the CLI, log in, link the project | None, works in the browser |
| Where the code lives | In the repo (`supabase/functions/`), committed to git | Only in the dashboard |
| Version control and rollback | Yes, through git | None. Supabase's docs recommend the editor only for quick tests and prototypes |
| Updates | One command, `supabase functions deploy` | Edit and redeploy in the browser |
| Secrets | `supabase secrets set` or the dashboard | Dashboard secrets page |
| Docker | Not required for deployment (it falls back to API-based deployment) | Not applicable |
| Portfolio value | Higher: reviewers can read the function in the repo | Lower: the code is not visible in the repo |

Recommendation: CLI, because the function is security-critical and belongs in the repo. The dashboard is fine for a quick first test.

**Key names.** Supabase is moving from "anon" and "service role" keys to "publishable" and "secret" keys, so the dashboard may show either naming. The publishable (anon) key is safe in the browser. The secret (service role) key is never put in the browser or in git.

---

## 9. Phase 4 hand-off

Done on the code side (see `supabase/README.md`):

- SQL migration, two Edge Functions, shared logic and tests
- `registration.js`, `registrationMessage.js`, `RegistrationCard.jsx` and the wiring in `App.jsx`
- `.env.example`, `.gitignore` rules, `npm run test:functions`, README and this plan

Still to do by you:

- [ ] Create the Supabase project (free tier)
- [ ] Run the setup commands: login, init, link, `db push`, deploy both functions with `--no-verify-jwt`
- [ ] Put `VITE_SUPABASE_URL` in `.env.local` and in the Vercel environment variables, then redeploy
- [ ] Test every row of the checklist in 3.10, ideally with two or three test wallets

Never send the secret (service role) key in chat.
