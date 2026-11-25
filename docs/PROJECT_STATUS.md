# Project status

Snapshot date: 25 Nov 2026. Update this file whenever the state changes.

## Summary

The Primus dApp is a testnet portfolio project. A wallet can check airdrop eligibility, claim PRM through a Merkle-proof contract, see the live PRM price from a Uniswap v4 pool, mint an allowlist NFT, and mint a soulbound badge for claiming. Airdrop registration with Supabase is deployed and working on the live site.

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
| 4 | Airdrop registration (Supabase) | Done and live. Round 1 is open until 25 Dec 2026 |
| 5 | Dashboard, swap page, pool stats, transaction history | Planned |
| 6 | Staking and governance | Planned |
| Polish | Token logo and Add-to-MetaMask button, demo video, custom domain, MetaMask warning report | Planned |

## Phase 4: registration (done and live)

Everything is deployed and tested on the live site:

- Supabase project `Primus-dApp` (ref `yhcnfucoquhjfosgltsh`, Central EU Frankfurt, free tier).
- Migration applied with `npx supabase db push --remote` (the CLI now defaults to a local database, so `--remote` is required for `db push`). Tables `rounds` and `registrations` exist, and Round 1 is seeded.
- Edge Functions `register` and `registration-info` deployed with `--no-verify-jwt`. Both endpoints were checked with curl.
- `VITE_SUPABASE_URL` is set in `.env.local` and in Vercel. The registration card works on localhost and on https://primus-dapp.vercel.app.
- Tested with test wallets: register, persisted state after refresh, and rejecting the signature.
- Everything is committed and pushed (commit `8d83858` and earlier).

Round 1: opens 25 Nov 2026 00:00 UTC, closes 25 Dec 2026 23:59:59 UTC, 5,000 PRM per wallet, cap 100. Some registrations were made with test wallets. Decide before the round ends whether to keep or delete them in the `registrations` table.

Optional checks not yet done: the cap and closed states (set `max_registrations` to the current count, or `status` to `closed`, in the Table Editor, then restore the values).

## What has been verified and what has not

Verified in a sandbox: the migration on a real Postgres engine (window, duplicates, cap, closed and draft rounds, privileges), 12 unit tests of the function logic, the real browser code end to end against the real handlers with a fake wallet, production build, lint (0 errors, 6 warnings of a known harmless kind).

Confirmed on the real Supabase project: the migration applies, both functions deploy and respond, the secret key is available to the functions (reads and registrations work), and the browser can call them without a key. Still not tested against real conditions: the cap and closed states, and heavy simultaneous traffic.

## Open decisions

- Abuse protection at launch: baseline only (signature, window, one entry per wallet) is the default. Rate limit or CAPTCHA only if spam appears.
- The existing airdrop contract: keep it as a separate "launch" claim, or show only the new round after the window closes.
- Registration time zone: assumed UTC. The user did not state a preference.

## What comes next

1. When Round 1 closes: write `scripts/exportRegistrations.js`, build the round's Merkle tree with the flat 5,000 PRM amount, deploy a new `MerkleAirdrop`, fund it, and update the `rounds` row. Add a public `round_proofs` table and make the claim flow round-aware (design in `PLAN.md` section 3.8).
2. Polish: save the PRM logo as `public/prm-logo.png` and add an "Add PRM to MetaMask" button using `wallet_watchAsset`. Record a demo. Consider a custom domain and a false-positive report to MetaMask support (MetaMask warns on the free vercel.app domain).
3. Phases 5 and 6 as in `PLAN.md`. Note that PRM is a plain ERC-20 without voting support, so governance needs a design decision.

## Working preferences

See `HANDOFF_PROMPT.md`.
