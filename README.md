# Airdrop Eligibility Checker

A simple Web3 app where users connect their wallet and instantly see whether their address is eligible for an airdrop, and how many tokens they can claim.

Built as a beginner-friendly project to learn wallet connection, network handling and the foundations of a dApp.

## Features

- Connect a MetaMask wallet
- Check the connected address against an allowlist
- Clear result states: checking, eligible (with amount), not eligible
- Detects the wrong network and switches the user to Sepolia in one click
- Switch to a different wallet account without leaving the page
- Copy the full wallet address with one click
- Automatically reconnects on page refresh, and respects manual disconnects
- Friendly handling for rejected requests, locked wallets and missing wallets
- Responsive dark UI with Lucide icons

## Tech Stack

| Part           | Tool                           |
| -------------- | ------------------------------ |
| Framework      | React + Vite                   |
| Wallet library | ethers.js v6                   |
| Wallet         | MetaMask (any EIP-1193 wallet) |
| Icons          | lucide-react                   |
| Network        | Sepolia testnet                |

## Getting Started

### Prerequisites

- Node.js 18 or newer
- The MetaMask browser extension
- A test wallet (never use a wallet that holds real funds)

### Installation

```bash
git clone https://github.com/deprimus01/airdrop-checker.git
cd airdrop-checker
npm install
npm run dev
```

Open `http://localhost:5173` in a browser that has MetaMask installed. VS Code's built-in preview cannot access wallet extensions.

### Build for production

```bash
npm run build
npm run preview
```

## Configuring the Allowlist

Edit `src/allowlist.json`. Each key is a wallet address and each value is the token amount that address can claim:

```json
{
  "0x951e354EB75452e81a4B782BF57878DE3644c2EB": 500,
  "0x71614ff0539d1BD9D6bC60926458626BFaC6E39C": 250
}
```

Notes:

- Addresses are compared case-insensitively, so checksum format is fine.
- Only EVM addresses (`0x...`) are supported. Solana and other chains need a different wallet connection.
- JSON does not support comments.

## Project Structure

```
src/
├── App.jsx                     Main app: wallet, network and state logic
├── main.jsx                    Entry point
├── index.css                   Global styles
├── constants.js                Sepolia network config
├── allowlist.json              Eligible addresses and amounts
├── components/
│   ├── EligibilityCard.jsx     Checking / eligible / not eligible states
│   └── CopyAddress.jsx         Click-to-copy wallet address
└── utils/
    ├── allowlist.js            Normalizes addresses into a lookup table
    └── checkEligibility.js     Returns { eligible, amount } for an address
```

## How It Works

1. The user clicks **Connect Wallet**. The app requests accounts with `eth_requestAccounts` and MetaMask asks for approval.
2. The app reads the current network with `eth_chainId` and listens for `accountsChanged` and `chainChanged` events.
3. If the user is not on Sepolia, the app offers a switch using `wallet_switchEthereumChain`, falling back to `wallet_addEthereumChain` if the wallet does not know the network.
4. On the correct network, `checkEligibility(address)` looks the lowercased address up in the allowlist and returns the result.

## Testing Checklist

| Test                                   | Expected result                               |
| -------------------------------------- | --------------------------------------------- |
| Connect an eligible account on Sepolia | Green card with the claim amount              |
| Switch to an account not in the list   | Red "Not eligible" card                       |
| Switch MetaMask to another network     | Wrong-network warning appears immediately     |
| Click Switch to Sepolia                | Eligibility card returns                      |
| Refresh while connected                | Stays connected with no popup                 |
| Click Disconnect, then refresh         | Stays disconnected                            |
| Reject the connection in MetaMask      | Friendly error message                        |
| Open in a browser without a wallet     | "No wallet detected" screen with install link |

## Deployment

The app is a static Vite build and deploys easily to Vercel:

1. Push the repo to GitHub.
2. Import the repo in Vercel.
3. Keep the defaults (build command `npm run build`, output directory `dist`) and deploy.

## Limitations

This is Version 1 and the eligibility check is off-chain. The allowlist ships inside the frontend bundle, so anyone can read it. That is fine for learning, but not for a real airdrop with real value.

## Roadmap

- [x] Wallet connection and account switching
- [x] Allowlist eligibility check
- [x] Network detection and Sepolia switching
- [x] Copy address and icon-based UI
- [ ] Version 2: Solidity `MerkleAirdrop` contract that stores only a Merkle root
- [ ] Generate Merkle proofs from the allowlist
- [ ] On-chain claim button with double-claim protection
- [ ] Deploy the contract to Sepolia and connect the frontend

## Security Notes

- Use a dedicated test wallet for development.
- Never commit private keys, seed phrases or `.env` files.
- Always test on a testnet before touching mainnet.

## License

MIT
