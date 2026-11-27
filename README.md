# Airdrop Eligibility Checker

**Live demo:** https://primus-dapp.vercel.app (Sepolia testnet)

A Web3 app where users connect their wallet, see whether their address is on an airdrop allowlist, claim their tokens on-chain through a Merkle-proof airdrop contract, mint an allowlist NFT, and earn a soulbound badge for claiming.

Built as a hands-on learning project covering wallet connection, network handling, ERC-20 and ERC-721 tokens, Merkle trees, IPFS metadata, a Uniswap v4 pool and smart contract interaction on the Sepolia testnet.

## Features

- Connect a MetaMask wallet and switch between accounts
- Instant eligibility check with the claimable amount
- On-chain claim: tokens are sent from the airdrop contract straight to the user's wallet
- Claim status is read from the contract, so a refresh never shows a stale state
- Detects the wrong network and switches the user to Sepolia in one click
- Works with MetaMask's "Added protection" feature (see Design Notes)
- Copy the full wallet address with one click
- Reconnects automatically on refresh and respects manual disconnects
- PRM/ETH liquidity pool on Uniswap v4 (Sepolia), so the token has a market-driven price
- Airdrop registration: wallets sign a free message to sign up during a window, with a cap, stored in Supabase
- Live PRM price read straight from the pool, shown even before a wallet is connected
- Free allowlist NFT mint (ERC-721) with a Merkle proof, showing the minted artwork from IPFS
- Soulbound claim badge: only wallets that claimed PRM can mint it, and it can never be transferred
- Clear handling for rejected requests, missing wallets and failed claims
- Responsive dark UI with Lucide icons

## How the Airdrop Works

1. The allowlist (`src/allowlist.json`) maps eligible addresses to token amounts.
2. A script (`npm run merkle`) builds a **Merkle tree** from the allowlist and saves the root plus one proof per address to `src/merkle.json`.
3. Only the **Merkle root** is stored in the smart contract, so the full list never goes on-chain.
4. To claim, the frontend sends the wallet's address, amount and proof. The contract rebuilds the leaf, verifies the proof against the root, marks the address as claimed and transfers the tokens.

## Tech Stack

| Part            | Tool                                                           |
| --------------- | -------------------------------------------------------------- |
| Frontend        | React + Vite                                                   |
| Wallet library  | ethers.js v6                                                   |
| Wallet          | MetaMask (any EIP-1193 wallet)                                 |
| Icons           | lucide-react                                                   |
| Smart contracts | Solidity 0.8.x + OpenZeppelin                                  |
| Merkle tree     | @openzeppelin/merkle-tree                                      |
| NFTs            | ERC-721 (OpenZeppelin), metadata and images on IPFS via Pinata |
| Liquidity       | Uniswap v4 (Sepolia)                                           |
| Backend         | Supabase: PostgreSQL and Edge Functions (Deno)                 |
| Network         | Sepolia testnet                                                |

## Deployed Contracts (Sepolia)

| Contract                            | Address                                      |
| ----------------------------------- | -------------------------------------------- |
| PrimusToken (PRM, ERC-20)           | `0xa0F6517D67AE29486c73c70F26e5cB57a4b6f760` |
| MerkleAirdrop                       | `0x2036ED85651486BB53ca2F4Ed1747eD6230Ddf1b` |
| PrimusNFT (Primus Genesis, ERC-721) | `0x6d48C2B7479dC5574529471f39d4FB0bf27F45b6` |
| PrimusBadge (soulbound ERC-721)     | `0x867816Bc5107463f16e92073De5D418Daa8087b0` |

| Data                      | Value                                                                 |
| ------------------------- | --------------------------------------------------------------------- |
| Airdrop Merkle root       | `0xeaf3e88aaf392b0651e41e81f2769654335ba9b8a54625dea6851f19446b9ed7`  |
| NFT allowlist Merkle root | `0x0b9d0cf070d15d212db3071b9a14abfbf4ed651da9b503475b42d42b68ffea8d`  |
| NFT images (IPFS)         | `ipfs://bafybeif5jbcdue5k44rjrji42jel3zqyisbzyogf3hxasduc45jwmosvgi/` |
| NFT metadata (IPFS)       | `ipfs://bafybeigwzjyur7ttyoh24aee6hedq4fccjekmv67eh24vhtm3jkqdcf534/` |
| Badge metadata (IPFS)     | `ipfs://bafkreialed5tgu2fgasmyxi46gwnfa4omqkjygfrhnf7quz24h367jnjpy`  |

These are testnet contracts and the tokens have no real value.

## Liquidity Pool (Sepolia)

PRM trades against ETH in a Uniswap v4 pool created through the Uniswap app (Testnet mode, Sepolia).

| Setting               | Value                                                                |
| --------------------- | -------------------------------------------------------------------- |
| Pair                  | ETH / PRM                                                            |
| Version               | v4                                                                   |
| Fee tier              | 0.25%                                                                |
| Price range           | Full range                                                           |
| Initial liquidity     | about 0.02 ETH and 20,000 PRM                                        |
| Starting price        | about 1,000,000 PRM per 1 ETH                                        |
| Pool ID               | `0xc2b2ec193b0294cfd3c05eea38956a5f350b55e59a245128051e8bc7e3a6e674` |
| PoolManager (Sepolia) | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`                         |
| StateView (Sepolia)   | `0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c`                         |

The starting price comes from the ratio of the two deposits. After that, trades move it: buying PRM raises the price and selling lowers it. The pool is small, so even tiny swaps show visible price impact, which makes it a good place to watch how an automated market maker works. Sepolia ETH is free, so the price has no real-world value.

**Reading the price.** The app calls `getSlot0(poolId)` on Uniswap's StateView contract through a public Sepolia RPC. It returns `sqrtPriceX96`, and because ETH is currency0 and PRM is currency1 (both 18 decimals), `(sqrtPriceX96 / 2^96)^2` is the number of PRM per 1 ETH. The card refreshes every 20 seconds.

## NFTs

Two ERC-721 contracts build on the same Merkle-proof pattern as the airdrop.

**PrimusNFT ("Primus Genesis", PGEN).** Wallets on the NFT allowlist can mint one NFT for free (gas only). The maximum supply is 100. Token IDs cycle through six artwork and metadata files, so token 1 uses `1.json`, token 6 uses `6.json`, and token 7 starts again at `1.json`. It is a normal transferable NFT.

**PrimusBadge ("Primus Airdrop Claimer", PBADGE).** A soulbound badge. A wallet can mint one only if the MerkleAirdrop contract reports that it has claimed PRM (`hasClaimed`), and the token can never be transferred. All badges share one metadata file.

**Metadata.** Images and JSON files live on IPFS (uploaded with Pinata). `node scripts/makeMetadata.js <IMAGES_CID>` generates the six NFT JSON files and the badge JSON from the uploaded images CID. The contracts store `ipfs://` links, and the app turns them into gateway URLs to display the artwork.

## Airdrop Registration (Supabase)

Wallets can register for the next airdrop round during a window (round 1: 25 Nov to 25 Dec 2026, 5,000 PRM per wallet, capped at 100 wallets).

1. The app asks the wallet to sign a short message. It costs no gas, so registration works with zero ETH.
2. An Edge Function rebuilds the message, verifies that the signature comes from that wallet, rejects stale signatures (older than 10 minutes), and calls a database function.
3. The database function runs in one transaction that locks the round row, then checks that the round is open, the wallet is new and the cap is not reached, so simultaneous requests cannot overfill a round.
4. The tables use row level security with no policies, so the browser can never read or write them directly. The browser only needs the project URL (`VITE_SUPABASE_URL`).

The window, amount and cap live in a `rounds` table row and can be edited without redeploying. Full setup steps, the deploy commands and the test command are in `supabase/README.md`.

After a round closes, the registered addresses are exported, a Merkle tree is built with the flat amount, and a new `MerkleAirdrop` contract is deployed for that round (see the plan in `docs/PLAN.md`).

## Getting Started

### Prerequisites

- Node.js 18 or newer
- The MetaMask browser extension
- A test wallet (never use a wallet that holds real funds)
- Sepolia ETH for gas, from any Sepolia faucet

### Installation

```bash
git clone https://github.com/deprimus01/airdrop-checker.git
cd airdrop-checker
npm install
npm run dev
```

Open `http://localhost:5173` in a browser that has MetaMask installed. VS Code's built-in preview cannot access wallet extensions.

### Environment variables

Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` to enable the registration card. Without it the card stays hidden and everything else works. Never commit `.env` files.

### Scripts

| Command                                     | What it does                                                  |
| ------------------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                               | Start the dev server                                          |
| `npm run build`                             | Production build                                              |
| `npm run preview`                           | Preview the production build                                  |
| `npm run merkle`                            | Rebuild the airdrop Merkle root and proofs from the allowlist |
| `npm run merkle:nft`                        | Build the NFT allowlist Merkle root and proofs                |
| `npm run test:functions`                    | Run the registration function tests (uses Deno)               |
| `node scripts/makeMetadata.js <IMAGES_CID>` | Generate the NFT and badge metadata JSON files                |

## Configuring the Allowlist

Edit `src/allowlist.json`. Each key is a wallet address and each value is the number of whole tokens that address can claim:

```json
{
  "0x951e354EB75452e81a4B782BF57878DE3644c2EB": 500,
  "0x71614ff0539d1BD9D6bC60926458626BFaC6E39C": 250
}
```

After any change, run `npm run merkle` to regenerate `src/merkle.json`.

Important notes:

- The Merkle root is stored permanently in the deployed contract. Changing the allowlist produces a new root, so you must deploy a new `MerkleAirdrop` contract and update `AIRDROP_ADDRESS` in `src/constants.js`.
- Every key must be a valid EVM address (`0x` plus 40 hex characters), or the script will throw.
- Amounts are converted to 18-decimal units by the script, matching the token.
- Only EVM addresses are supported. Solana and other chains need a different wallet connection.
- JSON does not support comments.

## Configuring the NFT Allowlist

By default the NFT allowlist is the same set of wallets as the airdrop allowlist. To use a different list, create `src/nftAllowlist.json` with a plain array of addresses:

```json
[
  "0x951e354EB75452e81a4B782BF57878DE3644c2EB",
  "0x71614ff0539d1BD9D6bC60926458626BFaC6E39C"
]
```

Run `npm run merkle:nft` to write `src/nftMerkle.json` (root and one proof per address). The script skips duplicates and stops on invalid addresses. As with the airdrop, the NFT root is stored permanently in the deployed contract, so changing the list means deploying a new `PrimusNFT` and updating `NFT_ADDRESS` in `src/constants.js`.

## Project Structure

```
contracts/
├── PrimusToken.sol             ERC-20 token
├── MerkleAirdrop.sol           Merkle-proof airdrop and claim
├── PrimusNFT.sol               Allowlist NFT mint (ERC-721)
└── PrimusBadge.sol             Soulbound claim badge (ERC-721)
docs/                           Project status, plan, architecture, contracts, decisions, troubleshooting
supabase/
├── migrations/                 Registration tables, security rules, register_wallet function
├── functions/
│   ├── register/               POST: verify the signature and register a wallet
│   ├── registration-info/      GET: round details, count and registration status
│   └── _shared/                Shared logic, Supabase client and tests
└── README.md                   Supabase setup steps
scripts/
├── generateMerkle.js           Builds the airdrop Merkle root and proofs
├── generateNftMerkle.js        Builds the NFT allowlist Merkle root and proofs
└── makeMetadata.js             Generates NFT and badge metadata JSON files
src/
├── App.jsx                     Wallet, network, eligibility, claim and section layout
├── main.jsx                    Entry point
├── index.css                   Global styles
├── constants.js                Sepolia config, contract addresses, pool ID, IPFS gateway
├── allowlist.json              Airdrop addresses and amounts
├── merkle.json                 Generated: airdrop root and per-address proofs
├── nftAllowlist.json           Optional: NFT allowlist (falls back to allowlist.json)
├── nftMerkle.json              Generated: NFT root and per-address proofs
├── components/
│   ├── EligibilityCard.jsx     Checking / eligible / not eligible states
│   ├── ClaimSection.jsx        Claim button, loading and claimed states
│   ├── PriceCard.jsx           Live PRM price from the Uniswap v4 pool
│   ├── NftSection.jsx          NFT mint button, supply and minted artwork
│   ├── BadgeSection.jsx        Badge mint button and minted badge
│   ├── RegistrationCard.jsx    Airdrop registration window, count and register button
│   └── CopyAddress.jsx         Click-to-copy wallet address
└── utils/
    ├── allowlist.js            Normalizes addresses into a lookup table
    ├── checkEligibility.js     Returns { eligible, amount } for an address
    ├── airdrop.js              Contract calls: hasClaimed and claimTokens
    ├── price.js                Reads the pool price from Uniswap v4 StateView
    ├── nft.js                  NFT status, proof lookup, metadata and mint
    ├── badge.js                Badge status, metadata and mint
    ├── registration.js         Sign the message and call the registration functions
    └── registrationMessage.js  The exact text a wallet signs (same format as the server)
```

## Smart Contracts

The source is in the `contracts/` folder. These are reference copies: compile and deploy them with Remix (or Hardhat), because this Vite project does not bundle OpenZeppelin.

### PrimusToken

A standard OpenZeppelin ERC-20 that mints its initial supply to the deployer.

```solidity
contract PrimusToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("Primus Token", "PRM") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }
}
```

### MerkleAirdrop

Stores the token address and the Merkle root (both immutable) and exposes:

- `claim(address account, uint256 amount, bytes32[] proof)`: verifies the proof and sends tokens to `account`. Reverts with `AlreadyClaimed` or `InvalidProof`.
- `hasClaimed(address)`: whether an address has already claimed.
- `withdrawRemaining()`: owner-only, recovers unclaimed tokens.

The contract rebuilds each leaf as `keccak256(bytes.concat(keccak256(abi.encode(account, amount))))`, which matches the format produced by `@openzeppelin/merkle-tree`. If the leaf format on either side changes, every claim fails with `InvalidProof`.

### PrimusNFT

An OpenZeppelin ERC-721 with Merkle-proof minting.

- `mint(address account, bytes32[] proof)`: verifies that `account` is in the NFT allowlist, allows one mint per wallet and sends the token to `account`. Reverts with `AlreadyMinted`, `InvalidProof` or `SoldOut`.
- `tokenURI(tokenId)`: `baseURI` plus a metadata file number from 1 to 6, cycling by token ID.
- `setBaseURI(uri)`: owner-only, in case the metadata is re-uploaded.
- Each leaf is `keccak256(bytes.concat(keccak256(abi.encode(account))))`, matching a single-address tree from `@openzeppelin/merkle-tree`.

### PrimusBadge

A soulbound ERC-721 gated by the airdrop contract.

- `mint(address account)`: reads `hasClaimed(account)` from the MerkleAirdrop contract, allows one badge per wallet and sends it to `account`. Reverts with `AlreadyMinted` or `NotClaimed`.
- Transfers and burns revert with `Soulbound`, because `_update` only allows the mint movement (from the zero address).
- `setBadgeURI(uri)`: owner-only.

## Design Notes

**Why `claim` takes an `account` parameter.** An earlier version used `msg.sender` to identify the claimant. With MetaMask's "Added protection" turned on, the transaction is routed through an intermediate contract, so `msg.sender` became that contract instead of the user's wallet and the proof check failed. Passing the recipient explicitly fixes this. It stays safe because tokens only ever go to the address inside the proof, so whoever submits the transaction cannot redirect or steal an allocation.

**Why the frontend simulates before sending.** `claimTokens` calls `staticCall` first, so a rejected claim shows its real reason without spending gas, then adds a 30% buffer to the gas estimate.

**Soulbound badge.** OpenZeppelin v5 routes every mint, transfer and burn through one internal function, `_update`. The badge overrides it and reverts whenever the token already has an owner, so minting is the only movement that works. This makes the badge proof that a wallet claimed, because it cannot be bought or sent.

**Finding a wallet's token ID.** The app first read a wallet's token ID from `Minted` event logs, but public RPCs limit log queries over wide block ranges and the lookup started failing. It now calls `ownerOf` for each minted token (a handful of calls at this supply), which does not depend on log queries.

**Gas.** Every claimant, minter and badge holder needs a little Sepolia ETH to pay the transaction fee, even though the tokens and NFTs are free.

## How the Frontend Works

1. **Connect:** `eth_requestAccounts` asks MetaMask for approval. On page load, `eth_accounts` reconnects silently if the site was already approved.
2. **Network:** the app reads `eth_chainId`, listens for `accountsChanged` and `chainChanged`, and offers `wallet_switchEthereumChain` (falling back to `wallet_addEthereumChain`) when the user is not on Sepolia.
3. **Eligibility:** the connected address is lowercased and looked up in the allowlist.
4. **Claim status:** for eligible wallets, the app calls `hasClaimed` on the contract.
5. **Claim:** the app looks up the wallet's amount and proof in `merkle.json` and calls `claim`, then shows an Etherscan link.
6. **Price:** independent of the wallet, the price card reads the pool's current price through a read-only RPC connection and refreshes on a timer.
7. **NFT:** the app checks the wallet's proof in `nftMerkle.json`, reads supply and `hasMinted` from the contract, simulates the mint, then sends it. Afterwards it loads the token's metadata from IPFS and shows the artwork.
8. **Badge:** the badge card unlocks once the airdrop claim is detected, and works the same way without a proof.

## Testing Checklist

| Test                                               | Expected result                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| Connect an eligible account on Sepolia             | Green card and a Claim button                                    |
| Click Claim and confirm                            | Success card with an Etherscan link; PRM balance increases       |
| Refresh after claiming                             | Still shows "Tokens claimed"                                     |
| Try an account not on the list                     | Red "Not eligible" card, no Claim button                         |
| Claim with MetaMask "Added protection" ON          | Claim succeeds                                                   |
| Claim with "Added protection" OFF                  | Claim succeeds                                                   |
| Claim from a wallet with no Sepolia ETH            | Wallet reports insufficient funds                                |
| Switch MetaMask to another network                 | Wrong-network warning appears immediately                        |
| Reject the connection or transaction               | Friendly error message                                           |
| Open in a browser without a wallet                 | "No wallet detected" screen with install link and the price card |
| Make a swap in Uniswap, then wait up to 20 seconds | Price card updates in the right direction                        |
| Connect a wallet on the NFT allowlist and mint     | Artwork and name appear, supply goes up by one                   |
| Refresh after minting                              | Minted NFT still shown                                           |
| Connect a wallet not on the NFT allowlist          | "Not on the NFT allowlist" message, no mint button               |
| Mint the badge before claiming PRM                 | Locked message, no mint button                                   |
| Claim PRM, then mint the badge                     | Gold badge appears with a Soulbound tag                          |
| Try to send the badge to another address           | Transaction fails (soulbound)                                    |

## Deployment

The frontend is a static Vite build and deploys easily to Vercel:

1. Push the repo to GitHub.
2. Import the repo in Vercel.
3. Keep the defaults (build command `npm run build`, output directory `dist`) and deploy.

`src/merkle.json` ships with the frontend. That is fine because Merkle proofs are public by design.

## Limitations

- Testnet only. The contracts have not been audited and must not be used with real funds as written.
- The allowlist and proofs are public in the frontend bundle, so anyone can see who is eligible.
- Changing the airdrop or NFT allowlist requires a new contract and a new deployment, because each Merkle root is permanent.
- The contract owner can change the NFT base URI and the badge URI. That is handy while learning, but on a real project it would be a trust assumption.
- Wallets can be slow to render testnet NFT images, so MetaMask may show a blank image even though the metadata is correct.
- The liquidity pool is tiny and exists only on Sepolia, so its price is only a learning tool.
- MetaMask may show a "flagged as unsafe" warning on the demo's free `vercel.app` domain. It is a false positive on a new testnet site, and a custom domain plus a report to MetaMask support are planned.

## Roadmap

- [x] Wallet connection, account switching and network detection
- [x] Allowlist eligibility check
- [x] ERC-20 token deployed on Sepolia
- [x] Merkle tree script and proofs
- [x] MerkleAirdrop contract with on-chain claim
- [x] Claim works with MetaMask "Added protection"
- [x] ETH/PRM liquidity pool on Uniswap v4 (Sepolia)
- [x] Show the live PRM price in the app
- [x] Deploy the frontend to Vercel
- [x] Phase 3: allowlist NFT mint (ERC-721 with Merkle proof)
- [x] Phase 3: soulbound claim badge for wallets that claim the airdrop
- [ ] Token logo and an "Add PRM to MetaMask" button
- [x] Registration backed by Supabase (PostgreSQL) with wallet signature verification, a cap and a flat amount per round (live)
- [ ] Export registrations after the window closes, build the round's Merkle tree and deploy its airdrop contract
- [ ] Dashboard, swap page, pool stats and transaction history
- [ ] Staking and governance

## Security Notes

- Use a dedicated test wallet for development.
- Never commit private keys, seed phrases or `.env` files.
- Always test on a testnet before touching mainnet.

## License

MIT
