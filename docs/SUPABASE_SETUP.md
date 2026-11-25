# Supabase setup

Details of the Supabase project and the exact remaining setup. The generic guide that ships with the code is `../supabase/README.md`.

## Project

| Item | Value |
|------|-------|
| Name | Primus-dApp |
| Project ref | `yhcnfucoquhjfosgltsh` |
| URL | `https://yhcnfucoquhjfosgltsh.supabase.co` |
| Region | Central EU (Frankfurt), eu-central-1 |
| Plan | Free |
| Data API | Enabled (the functions need it) |
| "Grant API access to new tables automatically" | Off. The migration grants what it needs explicitly |
| "Enable RLS on new tables automatically" | Off. The migration enables RLS itself |

The database password was set by the owner and saved by the owner. It must never be pasted into chat or committed. The secret (service role) key must also stay out of chat, the browser and git.

## Progress

| Step | Command | State |
|------|---------|-------|
| CLI available | `npx supabase --version` (3.3.0, later 3.4.0 via npx) | Done |
| Log in | `npx supabase login` | Done |
| Create config | `npx supabase init --force` (file already existed, so it was overwritten with defaults) | Done |
| Link project | `npx supabase link --project-ref yhcnfucoquhjfosgltsh` | Done |
| Create tables | `npx supabase db push --remote` | Done |
| Deploy `register` | `npx supabase functions deploy register --no-verify-jwt` | Done |
| Deploy `registration-info` | `npx supabase functions deploy registration-info --no-verify-jwt` | Done |
| Local env var | `VITE_SUPABASE_URL` in `.env.local` | Done |
| Vercel env var | `VITE_SUPABASE_URL` in Project Settings, then redeploy | Done |
| Live test | Register from https://primus-dapp.vercel.app | Done |

## Commands used

Run from the project root (`~/airdrop-checker`).

```bash
npx supabase db push --remote
npx supabase functions deploy register --no-verify-jwt
npx supabase functions deploy registration-info --no-verify-jwt
curl https://yhcnfucoquhjfosgltsh.supabase.co/functions/v1/registration-info
```

Notes:

- Since CLI 3.4.0, `db push` targets a local Docker database by default and fails with "connection refused" on port 54322. Add `--remote` to push to the linked project. `functions deploy` already targeted the linked project.
- If `db push` cannot connect (a network without IPv6, for example), paste the migration file into the dashboard SQL Editor and run it. The migration would then not be recorded in Supabase's history.
- To change the database later, add a new migration file (never edit the applied one) and run `npx supabase db push --remote`.
- To change a function, edit it and run the same deploy command again.

## Verify in the dashboard

- Table Editor shows `rounds` with one row (Round 1: opens 2026-11-25 00:00 UTC, closes 2026-12-25 23:59:59 UTC, amount 5000, max_registrations 100, status open) and an empty `registrations` table.
- The home page "Last migration" card no longer says "No migrations".
- Edge Functions lists `register` and `registration-info`.

## Frontend

```bash
cp .env.example .env.local
# edit .env.local:
# VITE_SUPABASE_URL=https://yhcnfucoquhjfosgltsh.supabase.co
npm run dev
```

Without the variable the registration card is hidden and the rest of the app works. In Vercel, add the same variable under Project Settings, Environment Variables, and redeploy (Vite reads it at build time).

## Test checklist

Use test wallets. Before 25 Nov 00:00 UTC the card shows "Registration opens on ...". To test earlier, set `opens_at` in the Table Editor to a past time.

| Test | Expected |
|------|----------|
| Open the site with no wallet connected | Card shows the round, reward, dates and count; asks to connect |
| Connect and register with a wallet that has zero ETH | Signature prompt, then "You are registered" |
| Refresh | Still registered |
| Register the same wallet again | "already registered" |
| Reject the signature | Friendly message, nothing saved |
| Switch account in MetaMask without telling the app | "wrong account" message |
| Set `max_registrations` to the current count | Card shows full, server refuses |
| Set `closes_at` in the past or `status` to closed | Card shows closed, server refuses |
| Edit `closes_at` | The card reflects it within about a minute with no deploy |

## Editing a round later

Table Editor, `rounds`. `opens_at` and `closes_at` are UTC. `amount` is whole PRM per wallet. `max_registrations` empty means no cap. `status` must be `open` to accept registrations. Do not change `amount` after the Merkle tree for the round has been built.

## After the window closes

Not built yet. Plan: an export script reads the registered addresses with the secret key from a local `.env` (never committed), builds a Merkle tree with the flat amount (leaf `(address, amount * 10^18)`), a new `MerkleAirdrop` is deployed and funded with `registrants * amount` PRM, the `rounds` row is updated (`merkle_root`, `airdrop_address`, `status = 'live'`), and a public `round_proofs` table lets the app load each wallet's proof without a redeploy. See `PLAN.md` section 3.8.
