# Supabase setup: airdrop registration

This folder holds the database schema and the two Edge Functions behind the
registration card.

| Path | What it is |
|------|------------|
| `migrations/20261122120000_airdrop_registration.sql` | Tables, row level security, the atomic `register_wallet` function and Round 1 |
| `functions/register/` | `POST /register`: verifies the wallet signature, then registers the wallet |
| `functions/registration-info/` | `GET /registration-info`: round details, registered count and whether a wallet is registered |
| `functions/round-claim/` | `GET /round-claim?address=0x...`: for each live round, the wallet's own Merkle proof (never the full list) |
| `functions/_shared/` | Shared logic, the Supabase client and the unit tests |

## How it works

1. The browser asks the wallet to sign a short message (free, no gas).
2. `register` rebuilds the same message on the server, checks that the signature
   comes from the wallet, and checks the message is less than 10 minutes old.
3. It calls the `register_wallet` database function, which locks the round row and
   checks, in one transaction, that the round is open, the wallet is new, and the
   cap has not been reached.
4. The tables have row level security with no policies, so the browser can never
   read or write them directly. Only the functions can, with the project's secret
   key, which Supabase supplies to Edge Functions itself. It is never in the
   frontend or in git.

## One-time setup

Run these from the project root.

```bash
# 1. Log in to Supabase (opens a browser)
npx supabase login

# 2. Create supabase/config.toml (skip if that file already exists)
npx supabase init

# 3. Link this folder to your project. The project ref is in the dashboard URL
#    (https://supabase.com/dashboard/project/<ref>). It asks for the database password.
npx supabase link --project-ref YOUR_PROJECT_REF

# 4. Create the tables and Round 1 (--remote is needed on CLI 3.4.0 and later,
#    which otherwise targets a local Docker database)
npx supabase db push --remote

# 5. Deploy both functions. They are public endpoints (no login), protected by
#    the wallet signature, so JWT verification is turned off.
npx supabase functions deploy register --no-verify-jwt
npx supabase functions deploy registration-info --no-verify-jwt
npx supabase functions deploy round-claim --no-verify-jwt
```

If `supabase init` asks about generating VS Code or IntelliJ settings, answer no.

## Check that it works

```bash
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/registration-info
```

You should get JSON with `"round"` and a `"phase"`. Round 1 opens on 25 Nov 2026
00:00 UTC, so before then the phase is `upcoming`.

## Connect the frontend

1. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` to your project
   URL. Restart `npm run dev`.
2. In Vercel, open Project Settings, Environment Variables, add `VITE_SUPABASE_URL`
   with the same value, and redeploy. Vite reads it at build time.

Without `VITE_SUPABASE_URL` the registration card stays hidden and the rest of the
app works as before.

## Changing the round

Open the Table Editor, then `rounds`, and edit the row. No redeploy is needed.

| Column | Meaning |
|--------|---------|
| `opens_at`, `closes_at` | The window, stored in UTC |
| `amount` | Whole PRM tokens per wallet (flat) |
| `max_registrations` | Cap on wallets. Empty means no cap |
| `status` | `open` accepts registrations inside the window. Set `closed` to stop early |

Do not change `amount` after you have built the Merkle tree for the round, because
the tree stores the amounts.

## Tests

```bash
npm run test:functions
```

This runs the function tests with Deno (downloaded on demand by `npx`). They cover
signatures, expiry, tampering, database error mapping, the round phases, CORS, and a
check that the browser and the server build identical message text.

## Known limits

- Smart-contract wallets (which sign differently, EIP-1271) are not supported.
  Regular wallets such as MetaMask accounts work.
- The base design stops fake addresses, replays and duplicates, but one person can
  still register many real wallets. If spam appears, add a rate limit or a CAPTCHA.
