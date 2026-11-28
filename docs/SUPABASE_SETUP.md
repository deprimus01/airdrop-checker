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

The pipeline is built and was rehearsed on 28 Nov 2026. Real run, after `closes_at` has passed:

1. **Admin file.** Create `.env.admin` in the project root (ignored by git) with `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Take the key labelled secret (starts `sb_secret_`) from the API keys page of the project settings, not the publishable one. Never paste it into a chat or commit it.
2. **Close the round.** Table Editor, `rounds`: set `status` to `closed`.
3. **Clean the list.** In `registrations`, delete any test registrations you do not want to pay.
4. **Dry run.** `npm run round:export -- --round 1`. Note the wallet count, the Merkle root and the PRM to fund (`wallets x 5,000`).
5. **Store the proofs.** `npm run round:export -- --round 1 --write`. Check that `round_proofs` has one row per wallet.
6. **Deploy.** In Remix, deploy `MerkleAirdrop` from the owner wallet on Sepolia with `token_` = the PRM address and `merkleRoot_` = the root from step 5. Copy the root and the PRM address from `src/constants.js` and the script output, do not retype them.
7. **Check before funding.** `npm run round:check -- <new contract> <root>`. Every line must say PASS. If anything fails, do not send PRM: redeploy.
8. **Fund.** Send `wallets x 5,000` PRM to the contract, then confirm the balance on-chain.
9. **Go live.** Edit the `rounds` row: `merkle_root`, `airdrop_address` (lowercase is fine) and `status = 'live'`. Registration closes for good at this point.
10. **Verify.** `curl "https://yhcnfucoquhjfosgltsh.supabase.co/functions/v1/round-claim?address=<a registered wallet>"` should return that wallet's proof. Then claim once from the live site with that wallet. Claiming costs gas, so the wallet needs some Sepolia ETH.

After the real round the owner can recover leftover PRM with `withdrawRemaining()` from the owner wallet.

Rehearsing again: add a temporary round row with status `live`, then delete it afterwards. While a newer round exists, the registration card follows that newest round (it picks the newest non-draft round), so it shows registration as closed until the row is removed.
