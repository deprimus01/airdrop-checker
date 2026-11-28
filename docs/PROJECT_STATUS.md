# Project status

Snapshot date: 28 Nov 2026. Update this file whenever the state changes.

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
| 4.5 | Round close pipeline (export script, `round_proofs`, `round-claim` function, round claim card) | Built and rehearsed end to end on Sepolia. The real run happens after Round 1 closes |
| 5 | Dashboard, swap page, pool stats, transaction history | Built, waiting for a test on a real machine: dashboard (5.1, tested), swap link (5.2), pool stats (5.3), wallet history (5.4). See the Phase 5 test checklist below |
| 6 | Staking and governance | Planned |
| Polish | Token logo and Add-to-MetaMask button, demo video, custom domain, MetaMask warning report | Logo (`public/prm-logo.png`) and Add-to-MetaMask button built, pending deploy and a wallet test. Demo video, custom domain and MetaMask report still planned |

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

## Round close pipeline (built and rehearsed)

Built and tested:

- `round_proofs` table (migration `20261125120000_round_proofs.sql`). It is private: row level security with no policies, so only the Edge Functions and the export script (service role) can touch it.
- `scripts/exportRegistrations.js` (`npm run round:export -- --round 1`). Reads the registrations with the secret key from a local `.env.admin`, re-checks every stored signature, builds the Merkle tree with the flat amount, writes `round-exports/round-<id>.json`, and stores proofs in `round_proofs` only with `--write`. Dry run by default. It refuses to run before the round closes unless `--allow-open` is passed, and refuses a round already marked `live`. 5 unit tests in `scripts/lib/roundTree.test.js` (`npm run test:scripts`).
- `round-claim` Edge Function (`GET /round-claim?address=0x...`). Returns, for each live round, only that wallet's own proof. 6 Deno tests, 18 in total with the registration tests (`npm run test:functions`).
- `RoundClaimCard` in the app. Shows a claim button for each live round that includes the connected wallet. Only `VITE_SUPABASE_URL` is needed in the browser.
- `scripts/checkAirdrop.js` (`npm run round:check -- <address> [root]`). A read-only check to run before funding a new airdrop contract.

Rehearsal on 28 Nov 2026 (test data, 2 registrations): a temporary `Rehearsal` round row pointed at a throwaway contract. A test wallet claimed 5,000 PRM through the card and Etherscan confirmed the transfer. The temporary row was then deleted. See `CONTRACTS.md` for the two rehearsal contracts. The first one was deployed with a mistyped PRM address and its 10,000 PRM is permanently stuck (see `DECISIONS.md` 22).

## Phase 5 (built 28 Nov 2026)

- **Dashboard** (`DashboardCard`): balances, launch and round airdrop status, registration, NFT and badge. Tested by the owner.
- **Swap link** (`PriceCard`): a button that opens the Uniswap app on Sepolia with ETH to PRM preselected. The URL parameters come from Uniswap's custom linking docs; the chain name `sepolia` is not confirmed there.
- **Pool stats** (`PoolStatsCard`): fee, active liquidity and tick read straight from StateView, plus 24 hour and all-time volume, swap counts, a price sparkline and the latest swaps. Volume, sparkline and swaps need the history service.
- **Wallet history** (`HistoryCard`): recent PRM transfers (classified as airdrop claim, swap, received or sent) and NFT and badge mints.
- **History service** (`chain-history` Edge Function): reads the Etherscan V2 API (Sepolia is on its chain list). The Etherscan key is a Supabase function secret, never in the browser. 12 Deno tests cover the swap decoding, classification, caching and error handling.
- Etherscan facts checked in its docs: one endpoint (`api.etherscan.io/v2/api` with `chainid`), Sepolia listed, `getLogs` takes `topic1`, `page` and `offset`. Not confirmed: that the free plan includes Sepolia (the function reports an error instead of breaking if it does not).
- Not built: a native swap inside the app (needs Universal Router, Permit2 and a quoter), and price history from before the first swap.

### Phase 5 test checklist (not run yet)

1. Swap link: click it on the price card, check that Uniswap opens on Sepolia with ETH and PRM filled in.
2. History setup: follow "History and pool stats" in `SUPABASE_SETUP.md` (Etherscan key, secret, deploy).
3. `curl` the function: `?view=pool` and `?view=wallet&address=<a wallet that has claimed>`.
4. Pool stats card: fee shows 0.25%, liquidity and tick load. Do one small swap on Uniswap, wait a minute and refresh: the card should list it as bought or sold, with the right amounts.
5. History card: a wallet that claimed shows "Airdrop claim", and minted NFT and badge show their token numbers.
6. If the pool numbers or buy and sell labels look wrong, see the Phase 5 rows in `TROUBLESHOOTING.md`.

## What has been verified and what has not

Verified in a sandbox: the migration on a real Postgres engine (window, duplicates, cap, closed and draft rounds, privileges), 12 unit tests of the function logic, the real browser code end to end against the real handlers with a fake wallet, production build, lint (0 errors, 6 warnings of a known harmless kind).

Confirmed on the real Supabase project: the migration applies, both functions deploy and respond, the secret key is available to the functions (reads and registrations work), and the browser can call them without a key. Still not tested against real conditions: the cap and closed states, and heavy simultaneous traffic. The round close pipeline was verified only with 2 test registrations. A full-size round (up to 100 wallets) has not been run, and the real export has not been run after the window closes.

## Open decisions

- Abuse protection at launch: baseline only (signature, window, one entry per wallet) is the default. Rate limit or CAPTCHA only if spam appears.
- Decided: the existing airdrop stays claimable as a separate "launch" claim next to the round claim (`DECISIONS.md` 19).
- The badge: it checks only the launch airdrop's `hasClaimed`. Decide whether a round claim should also qualify (that would need a new badge contract).
- Gas for claimers: claiming costs gas, and registrants may have no Sepolia ETH. Decide whether to tell them to get some, or to add a relayer later (`claim` already sends tokens to the `account` argument, so any wallet can submit it).
- Registration time zone: assumed UTC. The user did not state a preference.

## What comes next

1. When Round 1 closes (25 Dec 2026 23:59:59 UTC): run the real export, deploy and check a new `MerkleAirdrop`, fund it, and mark the round live. The step-by-step runbook is in `SUPABASE_SETUP.md`, section "After the window closes".
2. Polish: save the PRM logo as `public/prm-logo.png` and add an "Add PRM to MetaMask" button using `wallet_watchAsset`. Record a demo. Consider a custom domain and a false-positive report to MetaMask support (MetaMask warns on the free vercel.app domain).
3. Phases 5 and 6 as in `PLAN.md`. Note that PRM is a plain ERC-20 without voting support, so governance needs a design decision.

## Working preferences

See `HANDOFF_PROMPT.md`.
