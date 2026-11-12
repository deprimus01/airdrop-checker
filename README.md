# Airdrop Eligibility Checker

A Web3 app where users connect their wallet, see whether their address is on an airdrop allowlist, and claim their tokens on-chain through a Merkle-proof airdrop contract.

Built as a hands-on learning project covering wallet connection, network handling, ERC-20 tokens, Merkle trees and smart contract interaction on the Sepolia testnet.

## Features

- Connect a MetaMask wallet and switch between accounts
- Instant eligibility check with the claimable amount
- On-chain claim: tokens are sent from the airdrop contract straight to the user's wallet
- Claim status is read from the contract, so a refresh never shows a stale state
- Detects the wrong network and switches the user to Sepolia in one click
- Works with MetaMask's "Added protection" feature (see Design Notes)
- Copy the full wallet address with one click
- Reconnects automatically on refresh and respects manual disconnects
- Clear handling for rejected requests, missing wallets and failed claims
- Responsive dark UI with Lucide icons

## How the Airdrop Works

1. The allowlist (`src/allowlist.json`) maps eligible addresses to token amounts.
2. A script (`npm run merkle`) builds a **Merkle tree** from the allowlist and saves the root plus one proof per address to `src/merkle.json`.
3. Only the **Merkle root** is stored in the smart contract, so the full list never goes on-chain.
4. To claim, the frontend sends the wallet's address, amount and proof. The contract rebuilds the leaf, verifies the proof against the root, marks the address as claimed and transfers the tokens.

## Tech Stack

| Part            | Tool                           |
| --------------- | ------------------------------ |
| Frontend        | React + Vite                   |
| Wallet library  | ethers.js v6                   |
| Wallet          | MetaMask (any EIP-1193 wallet) |
| Icons           | lucide-react                   |
| Smart contracts | Solidity 0.8.x + OpenZeppelin  |
| Merkle tree     | @openzeppelin/merkle-tree      |
| Network         | Sepolia testnet                |

## Deployed Contracts (Sepolia)

| Contract                  | Address                                      |
| ------------------------- | -------------------------------------------- |
| PrimusToken (PRM, ERC-20) | `0xA0f6517d67Ae29486C73c70f26E5cB57a4B6F760` |
| MerkleAirdrop             | `0x2036ED85651486BB53ca2F4Ed1747eD6230Ddf1b` |

Merkle root: `0xeaf3e88aaf392b0651e41e81f2769654335ba9b8a54625dea6851f19446b9ed7`

These are testnet contracts and the tokens have no real value.

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

### Scripts

| Command           | What it does                                          |
| ----------------- | ----------------------------------------------------- |
| `npm run dev`     | Start the dev server                                  |
| `npm run build`   | Production build                                      |
| `npm run preview` | Preview the production build                          |
| `npm run merkle`  | Rebuild the Merkle root and proofs from the allowlist |

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

## Project Structure

```
contracts/
├── PrimusToken.sol             ERC-20 token
└── MerkleAirdrop.sol           Merkle-proof airdrop and claim
scripts/
└── generateMerkle.js           Builds the Merkle root and proofs
src/
├── App.jsx                     Wallet, network, eligibility and claim state
├── main.jsx                    Entry point
├── index.css                   Global styles
├── constants.js                Sepolia config and contract addresses
├── allowlist.json              Eligible addresses and amounts
├── merkle.json                 Generated: Merkle root and per-address proofs
├── components/
│   ├── EligibilityCard.jsx     Checking / eligible / not eligible states
│   ├── ClaimSection.jsx        Claim button, loading and claimed states
│   └── CopyAddress.jsx         Click-to-copy wallet address
└── utils/
    ├── allowlist.js            Normalizes addresses into a lookup table
    ├── checkEligibility.js     Returns { eligible, amount } for an address
    └── airdrop.js              Contract calls: hasClaimed and claimTokens
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

## Design Notes

**Why `claim` takes an `account` parameter.** An earlier version used `msg.sender` to identify the claimant. With MetaMask's "Added protection" turned on, the transaction is routed through an intermediate contract, so `msg.sender` became that contract instead of the user's wallet and the proof check failed. Passing the recipient explicitly fixes this. It stays safe because tokens only ever go to the address inside the proof, so whoever submits the transaction cannot redirect or steal an allocation.

**Why the frontend simulates before sending.** `claimTokens` calls `staticCall` first, so a rejected claim shows its real reason without spending gas, then adds a 30% buffer to the gas estimate.

**Gas.** Every claimant needs a little Sepolia ETH to pay the transaction fee, even though the tokens are free.

## How the Frontend Works

1. **Connect:** `eth_requestAccounts` asks MetaMask for approval. On page load, `eth_accounts` reconnects silently if the site was already approved.
2. **Network:** the app reads `eth_chainId`, listens for `accountsChanged` and `chainChanged`, and offers `wallet_switchEthereumChain` (falling back to `wallet_addEthereumChain`) when the user is not on Sepolia.
3. **Eligibility:** the connected address is lowercased and looked up in the allowlist.
4. **Claim status:** for eligible wallets, the app calls `hasClaimed` on the contract.
5. **Claim:** the app looks up the wallet's amount and proof in `merkle.json` and calls `claim`, then shows an Etherscan link.

## Testing Checklist

| Test                                      | Expected result                                            |
| ----------------------------------------- | ---------------------------------------------------------- |
| Connect an eligible account on Sepolia    | Green card and a Claim button                              |
| Click Claim and confirm                   | Success card with an Etherscan link; PRM balance increases |
| Refresh after claiming                    | Still shows "Tokens claimed"                               |
| Try an account not on the list            | Red "Not eligible" card, no Claim button                   |
| Claim with MetaMask "Added protection" ON | Claim succeeds                                             |
| Claim with "Added protection" OFF         | Claim succeeds                                             |
| Claim from a wallet with no Sepolia ETH   | Wallet reports insufficient funds                          |
| Switch MetaMask to another network        | Wrong-network warning appears immediately                  |
| Reject the connection or transaction      | Friendly error message                                     |
| Open in a browser without a wallet        | "No wallet detected" screen with install link              |

## Deployment

The frontend is a static Vite build and deploys easily to Vercel:

1. Push the repo to GitHub.
2. Import the repo in Vercel.
3. Keep the defaults (build command `npm run build`, output directory `dist`) and deploy.

`src/merkle.json` ships with the frontend. That is fine because Merkle proofs are public by design.

## Limitations

- Testnet only. The contracts have not been audited and must not be used with real funds as written.
- The allowlist and proofs are public in the frontend bundle, so anyone can see who is eligible.
- Changing the allowlist requires a new airdrop contract and a new deployment.

## Roadmap

- [x] Wallet connection, account switching and network detection
- [x] Allowlist eligibility check
- [x] ERC-20 token deployed on Sepolia
- [x] Merkle tree script and proofs
- [x] MerkleAirdrop contract with on-chain claim
- [x] Claim works with MetaMask "Added protection"
- [ ] Deploy the frontend to Vercel
- [ ] Phase 3: allowlist NFT mint (ERC-721 with Merkle proof)
- [ ] Phase 3: claim-badge NFT for wallets that claim the airdrop

## Security Notes

- Use a dedicated test wallet for development.
- Never commit private keys, seed phrases or `.env` files.
- Always test on a testnet before touching mainnet.

## License

MIT
