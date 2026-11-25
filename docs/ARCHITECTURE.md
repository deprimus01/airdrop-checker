# Architecture

## Overview

```
Browser (React + Vite, deployed on Vercel)
 |-- MetaMask (EIP-1193) .......... connect, sign messages, send transactions
 |-- Public Sepolia RPC ........... read-only calls (price, supply, balances, status)
 |-- Contracts on Sepolia ......... PrimusToken, MerkleAirdrop, PrimusNFT, PrimusBadge, Uniswap v4 pool
 |-- IPFS gateway ................. NFT and badge metadata and images (hosted on Pinata)
 `-- Supabase Edge Functions ...... airdrop registration (signature check, window, cap)
        `-- PostgreSQL ............ rounds, registrations (no direct browser access)
```

Frontend stack: React 19, Vite, ethers v6, lucide-react. Dark theme, plain CSS in `src/index.css`.

## Frontend layout

`src/App.jsx` owns the wallet state (account, chain id, connect, switch account, disconnect, network switch) and the claim flow. It renders the cards in this order: price card, registration card, then (when connected) wallet and network, eligibility, claim, NFT, badge.

| File | Purpose |
|------|---------|
| `src/constants.js` | Sepolia config, contract addresses (lowercase), pool ID, StateView address, IPFS gateway |
| `src/allowlist.json` | Airdrop addresses and whole-token amounts |
| `src/merkle.json` | Generated airdrop root and per-address proofs (`npm run merkle`) |
| `src/nftAllowlist.json` | Optional NFT allowlist. Falls back to the airdrop allowlist |
| `src/nftMerkle.json` | Generated NFT root and proofs (`npm run merkle:nft`) |
| `src/utils/allowlist.js`, `checkEligibility.js` | Address normalization and the off-chain eligibility lookup |
| `src/utils/airdrop.js` | `hasClaimed` and `claimTokens` |
| `src/utils/price.js` | Reads the pool price from Uniswap v4 StateView through a public RPC |
| `src/utils/nft.js`, `badge.js` | NFT and badge status, metadata, mint. Token IDs are found with `ownerOf` |
| `src/utils/registration.js` | Fetch registration info, sign the message, submit the registration |
| `src/utils/registrationMessage.js` | The exact signed text. Must match the server |
| `src/components/*` | EligibilityCard, ClaimSection, PriceCard, NftSection, BadgeSection, RegistrationCard, CopyAddress |

## Data flows

**Eligibility and claim.** The connected address is lowercased and looked up in `allowlist.json`. If eligible, the app reads `hasClaimed(account)` from the airdrop contract. Claiming looks up the wallet's amount and proof in `merkle.json`, simulates `claim(account, amount, proof)` with `staticCall`, estimates gas with a 30% buffer, sends the transaction, and waits.

**Price.** `getSlot0(poolId)` on StateView returns `sqrtPriceX96`. Because currency0 is ETH and currency1 is PRM (both 18 decimals), `(sqrtPriceX96 / 2^96)^2` is PRM per ETH. The card refreshes every 20 seconds and needs no wallet.

**NFT.** The wallet's proof comes from `nftMerkle.json`. `mint(account, proof)` is simulated, gas-buffered and sent. The token ID comes from the `Minted` event in the receipt right after minting, and from `ownerOf` scans on later visits. Metadata and image load from IPFS through the gateway.

**Badge.** `mint(account)` requires `hasClaimed(account)` on the airdrop contract. The app passes the claim status it already knows, so a claim in the same session unlocks the badge immediately.

**Registration.** See below.

## Registration backend

```
RegistrationCard -> GET  /functions/v1/registration-info?address=...
                 -> POST /functions/v1/register {address, roundId, issuedAt, signature}
Edge Functions (Deno) -> ethers verifyMessage -> rpc register_wallet(...)
register_wallet (SECURITY DEFINER, locks the round row, one transaction)
   checks: round exists and status is open, within the window, wallet not already registered, cap not reached
   then inserts the lowercase address
```

- The signed message is rebuilt on the server from the request fields. The server rejects signatures older than 10 minutes or more than 2 minutes in the future, and any `issuedAt` that is not canonical ISO format.
- Both tables have row level security on and no policies. `anon` and `authenticated` have no privileges. `service_role` has select on both tables and execute on `register_wallet`.
- The browser only needs `VITE_SUPABASE_URL`. The functions are deployed with JWT verification off because they are public endpoints protected by the signature.
- Files: `supabase/migrations/20261122120000_airdrop_registration.sql`, `supabase/functions/register`, `supabase/functions/registration-info`, `supabase/functions/_shared` (logic, Supabase client, CORS, tests).
- Tests: `npm run test:functions` (Deno, downloaded on demand). One test checks that the browser and server build identical message text.

## Conventions

- Lowercase addresses in code and in the database. Checksummed only for display.
- Every transaction: simulate with `staticCall`, estimate gas, add 30%, then send.
- Contracts that act for a user take an explicit `account` argument, so they work when MetaMask routes the transaction through a forwarder.
- Read-only data uses a public RPC so it works before a wallet is connected.
- No secrets in the repo. `.env` files are git-ignored. Only `.env.example` is committed.
- UI uses lucide icons. No emojis.
- Anything stored on-chain that is permanent (Merkle roots, URIs fixed in constructors) is finalized before deploying.
