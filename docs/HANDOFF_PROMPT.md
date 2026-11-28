# Handoff prompt

Paste everything inside the code block below into a new chat, and attach `airdrop-checker-handoff.zip` to the same message.

````text
You are continuing a project with me. I am Primus, a developer and Computer Science student. I work on Kali Linux with VS Code, and I deploy to Vercel and Render. My GitHub username is deprimus01.

## Project
The Primus dApp ("airdrop-checker") is a practice-mode blockchain portfolio project on the Sepolia testnet, built with React 19, Vite, ethers v6 and Solidity (OpenZeppelin v5). Live at https://primus-dapp.vercel.app (auto-deploys from GitHub). A wallet can check airdrop eligibility, claim PRM through a Merkle-proof contract, see the live PRM price from a Uniswap v4 pool, mint an allowlist NFT, and mint a soulbound badge for claiming. Everything is testnet only.

## First, do this
1. Unzip the attached project and read the docs/ folder before writing any code. Start with docs/PROJECT_STATUS.md, then docs/DECISIONS.md, docs/ARCHITECTURE.md, docs/CONTRACTS.md, docs/SUPABASE_SETUP.md and docs/PLAN.md. Use docs/TROUBLESHOOTING.md when something fails.
2. Summarize back to me, in a few lines, where we are and what you will do next, and ask me for anything you are missing.

## What is done
- Phases 1 to 4 are finished and live: wallet connect and network switch, eligibility, Merkle airdrop claim, Uniswap v4 price card, PrimusNFT allowlist mint, soulbound PrimusBadge, and airdrop registration.
- Registration runs on Supabase (PostgreSQL, project Primus-dApp, ref yhcnfucoquhjfosgltsh, Frankfurt, free tier) with two public Edge Functions (register, registration-info), deployed with the Supabase CLI (db push needs --remote on CLI 3.4.0 and later). Wallets sign a free message, so registration works with zero ETH. The browser only needs VITE_SUPABASE_URL, which is set locally and in Vercel.
- Round 1: opens 25 Nov 2026 00:00 UTC, closes 25 Dec 2026 23:59:59 UTC, flat 5,000 PRM per wallet, cap of 100 wallets. It is open now, and a few registrations were made with test wallets.
- Everything is committed and pushed to GitHub, and Vercel auto-deploys it.

## Where we stopped (resume here)
Registration is live and working. The next step is the round-close pipeline, or the polish items, whichever I choose first. Before the round ends I still want to run the cap and closed-state checks and decide whether to delete the test registrations.

## What comes next after that
1. Round close pipeline: scripts/exportRegistrations.js (secret key only from a local .env, never committed), build the round's Merkle tree with the flat amount, deploy and fund a new MerkleAirdrop, a public round_proofs table, and a round-aware claim flow (design in docs/PLAN.md section 3.8). Decide with me whether the existing airdrop contract stays as a separate "launch" claim.
2. Polish: save my green PRM logo as public/prm-logo.png and add an "Add PRM to MetaMask" button (wallet_watchAsset), a demo recording for the README, and later a custom domain and a false-positive report to MetaMask support (MetaMask warns on the free vercel.app domain).
3. Phase 5: dashboard, swap page (a deep link to Uniswap may be enough), pool stats, transaction history. Public RPCs limit log queries, so history and stats may need an indexer or the Etherscan API (verify before relying on it).
4. Phase 6: staking and governance. PRM is a plain ERC-20 without vote tracking, so we must choose a governance design first.
Keep docs/ and the README updated after each change.

## How I want you to work
- Go step by step. Give me one clear step at a time, tell me what to expect, and wait for my output or screenshots before the next step. I often reply with screenshots.
- Give complete code, not partial snippets, unless an edit is tiny. When you change an existing file, say exactly which file and which lines.
- You can edit the project zip in your sandbox and return the changed files as a zip. Test what you can (builds, lint, the Deno tests, SQL), and clearly say what you could not verify.
- Be honest about uncertainty. Do not guess addresses, CIDs, CLI flags or numbers. If something may have changed (Supabase, Uniswap, Pinata), check current documentation first.
- Keep answers concise and direct. Tell me if something I ask looks risky or wrong.
- UI: lucide icons, no emojis, keep the existing dark card style.
- Security: never ask me for the Supabase secret (service role) key, the database password, or any wallet private key or seed phrase. Never put secrets in the repo or the browser. I will only paste public values (addresses, URLs, project ref).
- Contracts: anything stored on-chain that is permanent (Merkle roots, URIs fixed in constructors) must be finalized before deploying. Use the explicit `account` argument pattern so contracts work with MetaMask "Added protection".

## Key facts (also in docs/)
- Owner wallet and deployer: 0x951e354EB75452e81a4B782BF57878DE3644c2EB
- PRM token: 0xA0f6517d67Ae29486C73c70f26F5cB57a4B6F760 (fixed 1,000,000 supply, no mint function)
- MerkleAirdrop: 0x2036ED85651486BB53ca2F4Ed1747eD6230Ddf1b
- PrimusNFT: 0x6d48C2B7479dC5574529471f39d4FB0bf27F45b6
- PrimusBadge: 0x867816Bc5107463f16e92073De5D418Daa8087b0
- Uniswap v4 pool ID: 0xc2b2ec193b0294cfd3c05eea38956a5f350b55e59a245128051e8bc7e3a6e674
- Supabase URL: https://yhcnfucoquhjfosgltsh.supabase.co
````
