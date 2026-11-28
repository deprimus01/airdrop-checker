# Decision log

Each entry has the decision, the reason, and what to remember.

## 1. Testnet only, practice mode
Everything runs on Sepolia with test ETH. The goal is a portfolio piece that shows blockchain knowledge. Nothing is audited and the contracts must not be used with real funds as written.

## 2. PRM has a fixed supply
`PrimusToken` mints 1,000,000 PRM once and has no mint function. Anything that needs PRM (airdrop rounds, pool liquidity, future staking rewards) draws from that supply, which is why registration has a cap.

## 3. Merkle-proof airdrop
Only a Merkle root is stored on-chain, so the full list stays off-chain. The root is an immutable, so a changed list needs a new contract.

## 4. `claim` and `mint` take an explicit `account` argument
The first airdrop used `msg.sender`. With MetaMask "Added protection" on, the transaction was routed through a forwarding contract (`0xdb9B1e94...`), so `msg.sender` was the forwarder and the proof check failed. Passing the recipient explicitly fixes it. It is safe because tokens or NFTs only ever go to the address inside the proof. All later contracts follow this pattern.

## 5. Uniswap v4, full range, 0.25% fee
A full-range pool behaves like a classic constant-product pool, which is the clearest way to learn price formation. The initial price is set by the first deposit ratio. The app reads the price from StateView with `getSlot0(poolId)`.

## 6. Read-only data goes through a public RPC
`https://ethereum-sepolia-rpc.publicnode.com` is used for reads so the price and status work before a wallet is connected.

## 7. Transaction pattern
Simulate with `staticCall` (so a failure shows its real reason without spending gas), estimate gas, add a 30% buffer, send, wait. The buffer and simulation were added while debugging the protection issue and kept as good practice.

## 8. NFT design
Allowlist mint through a Merkle proof, free (gas only), one per wallet, max supply 100, transferable. Six samurai images, with token IDs cycling through six metadata files so there is no on-chain randomness to manipulate. The user supplied all artwork.

## 9. Soulbound badge
The badge proves a wallet claimed PRM, so it must not be transferable. Implemented by overriding OpenZeppelin v5's `_update` to revert whenever the token already has an owner. It checks `hasClaimed` on the current airdrop contract, so claims on older airdrop contracts do not count.

## 10. Token IDs are found with `ownerOf`, not event logs
The first version read `Minted` events from a deploy block. Public RPCs limit `eth_getLogs` ranges, and the lookup began failing as the chain advanced. The app now calls `ownerOf` for each minted token (a few calls at this supply). A transferred NFT will no longer show for the original minter, which is acceptable.

## 11. Badge image link
`badge.png` was missing from the Pinata images folder because the local file was named `bagde.png`. The badge image was uploaded as a single file and `badge.json` references it as `ipfs://<CID>` with no filename. `badgeURI_` must be `ipfs://<CID>`, never an `https://` gateway link and never `ipfs://https://...`.

## 12. Registration: Supabase with PostgreSQL, signature-based
Users sign a free message, so registration works with zero ETH. Chosen settings: round 1 opens 25 Nov 2026 00:00 UTC and closes 25 Dec 2026 23:59:59 UTC (UTC assumed), flat 5,000 PRM per wallet (changed from 10,000), cap 100 wallets (500,000 PRM). Window, amount and cap live in a `rounds` row and can be edited without redeploying.

## 13. Registration goes through Edge Functions only
The tables have row level security and no policies, so the browser can read and write nothing directly. The server rebuilds the signed message instead of parsing a client string. A database function locks the round row and does every check in one transaction, so concurrent requests cannot overfill the cap. The browser needs only `VITE_SUPABASE_URL`; no anon key and no secret key in the frontend.

## 14. Edge Functions deployed with the Supabase CLI
Kept in the repo and versioned in git. Deployed with `--no-verify-jwt` because they are public endpoints protected by the signature.

## 15. No wallet balance requirement for registration
Chosen by the user. The trade-off is that one person can register many wallets. The baseline stops fake addresses, replays and duplicates only. Add a rate limit or CAPTCHA if spam appears.

## 16. UI conventions
Lucide icons everywhere, no emojis. Dark theme. Cards for each feature.

## 17. Governance needs a design decision
`PrimusToken` is a plain ERC-20 without vote tracking. Options: a new token with voting support (new pool and airdrop), a wrapper token, or off-chain signed voting counted at a snapshot. Decide when Phase 6 starts.

## 18. MetaMask warning on the live site
MetaMask flags the free `primus-dapp.vercel.app` domain as unsafe (a false positive for a new site). Deferred by the user until the project is fully built. Options: report it to MetaMask support, and use a custom domain.

## 19. The launch airdrop stays; each round gets its own contract

The original airdrop contract and `merkle.json` stay as a separate "launch" claim. Each registration round gets a new `MerkleAirdrop` with its own root, shown as a separate "Round airdrop" card. Nothing already claimed breaks, and the contract needed no changes. Open point: the badge only checks the launch airdrop.

## 20. Round proofs are private and served by an Edge Function

`round_proofs` has row level security and no policies. The `round-claim` function returns only the requested wallet's own proof. This differs from the first plan in `PLAN.md` 3.8 (a public table), because a public table would expose the full list of registered wallets and would need an anon key in the browser, which breaks decision 13. Proofs are not secret in themselves, since the contract only pays the wallet a leaf was built for.

## 21. The export runs locally with the secret key in `.env.admin`

`scripts/exportRegistrations.js` is the only place the Supabase secret key is used outside the Edge Functions. The key lives in a local `.env.admin` (ignored by git), never in the repo, Vercel or the browser. The script is a dry run unless `--write` is passed, and it never edits the `rounds` row: after deploying the contract the owner edits `merkle_root`, `airdrop_address` and `status` by hand.

## 22. Verify a contract on-chain before funding it

A `MerkleAirdrop` stores its token address as an immutable, and its only recovery function (`withdrawRemaining`) calls that token. If the token address is wrong, nothing sent to the contract can ever be recovered. On 27 Nov 2026 a rehearsal contract was deployed with a mistyped PRM address (one letter, `E` instead of `F`), and 10,000 PRM sent to it is stuck. Rule: copy addresses from `src/constants.js` or from an on-chain read, never retype them from docs, and run `npm run round:check -- <address> <root>` before sending any PRM.
