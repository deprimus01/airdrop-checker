# Project status

Snapshot date: 24 Nov 2026. Update this file whenever the state changes.

## Summary

The Primus dApp is a testnet portfolio project. A wallet can check airdrop eligibility, claim PRM through a Merkle-proof contract, see the live PRM price from a Uniswap v4 pool, mint an allowlist NFT, and mint a soulbound badge for claiming. Airdrop registration with Supabase is built and tested locally, and is partway through setup.

- Live site: https://primus-dapp.vercel.app (Sepolia, deployed from GitHub on every push)
- Repo: https://github.com/deprimus01/airdrop-checker
- Owner: Primus, developer and CS student, works on Kali Linux with VS Code, deploys to Vercel and Render

## Phases

| Phase | What | Status |
|-------|------|--------|
| 1 | Wallet connect, network switch, off-chain eligibility check | Done |
| 2 | PRM ERC-20, Merkle tree, MerkleAirdrop contract, claim from the app | Done |
| 2.5 | Uniswap v4 ETH/PRM pool, live price card | Done |
| 3 | PrimusNFT allowlist mint and soulbound PrimusBadge | Done, working in the app |
| 4 | Airdrop registration (Supabase) | Code complete and tested locally. Setup in progress (see below) |
| 5 | Dashboard, swap page, pool stats, transaction history | Planned |
| 6 | Staking and governance | Planned |
| Polish | Token logo and Add-to-MetaMask button, demo video, custom domain, MetaMask warning report | Planned |

## Phase 4: where work stopped

Done:

- Registration code written and tested: SQL migration, two Edge Functions, shared logic, 12 Deno tests, the React card and utilities (see `ARCHITECTURE.md`).
- Supabase project created: `Primus-dApp`, ref `yhcnfucoquhjfosgltsh`, region Central EU (Frankfurt), free tier. Data API enabled. The two "auto grant" and "auto RLS" options were left off on purpose (the migration handles RLS and grants itself).
- Supabase CLI 3.3.0 runs through `npx supabase` (no global install).
- `npx supabase login` done.
- `npx supabase init --force` done. It replaced `supabase/config.toml` with a default one, which is harmless. That file exists on the owner's machine (not committed to GitHub yet), so it is not in the handoff zip.
- `npx supabase link --project-ref yhcnfucoquhjfosgltsh` done.
- The migration file contains the `grant select ... to service_role` fix (verified with grep, lines 38 to 41, and the function grant on line 101).

Not done yet (this is the exact point to resume from):

1. `ls supabase supabase/functions`, to confirm the folders are intact after `init --force`.
2. `npx supabase db push`, which creates the tables and Round 1. It asks for the database password. If the connection fails, run the migration in the dashboard SQL Editor instead.
3. Check the dashboard Table Editor: `rounds` (one row, Round 1) and `registrations` (empty).
4. `npx supabase functions deploy register --no-verify-jwt` and `npx supabase functions deploy registration-info --no-verify-jwt`.
5. `curl https://yhcnfucoquhjfosgltsh.supabase.co/functions/v1/registration-info` should return JSON with a round and a phase.
6. Put `VITE_SUPABASE_URL=https://yhcnfucoquhjfosgltsh.supabase.co` in `.env.local`, restart `npm run dev`, and test the card with a test wallet.
7. Add the same variable in Vercel (Project Settings, Environment Variables), redeploy, and test on the live site.
8. Commit and push the new files.

Round 1 opens on 25 Nov 2026 at 00:00 UTC, so before that the card shows "Registration opens on ...". To test earlier, edit `opens_at` in the Table Editor.

## What has been verified and what has not

Verified in a sandbox: the migration on a real Postgres engine (window, duplicates, cap, closed and draft rounds, privileges), 12 unit tests of the function logic, the real browser code end to end against the real handlers with a fake wallet, production build, lint (0 errors, 6 warnings of a known harmless kind).

Not verified because it needs the real Supabase project:

- The Supabase CLI commands in `SUPABASE_SETUP.md` were written from knowledge of the CLI. If a command or flag differs, adjust it.
- How Supabase names the secret key inside Edge Functions. The code accepts either `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEYS`.
- `--no-verify-jwt` is used because the functions are public and the new Supabase key system may not accept the publishable key as a JWT.

## Open decisions

- Abuse protection at launch: baseline only (signature, window, one entry per wallet) is the default. Rate limit or CAPTCHA only if spam appears.
- The existing airdrop contract: keep it as a separate "launch" claim, or show only the new round after the window closes.
- Registration time zone: assumed UTC. The user did not state a preference.

## After registration is live

1. When Round 1 closes: write `scripts/exportRegistrations.js`, build the round's Merkle tree with the flat 5,000 PRM amount, deploy a new `MerkleAirdrop`, fund it, and update the `rounds` row. Add a public `round_proofs` table and make the claim flow round-aware (design in `PLAN.md` section 3.8).
2. Polish: save the PRM logo as `public/prm-logo.png` and add an "Add PRM to MetaMask" button using `wallet_watchAsset`. Record a demo. Consider a custom domain and a false-positive report to MetaMask support (MetaMask warns on the free vercel.app domain).
3. Phases 5 and 6 as in `PLAN.md`. Note that PRM is a plain ERC-20 without voting support, so governance needs a design decision.

## Working preferences

See `HANDOFF_PROMPT.md`.
