# Contracts, addresses and on-chain data

Network: Ethereum Sepolia testnet (chain id 11155111, hex `0xaa36a7`). All contracts were deployed from Remix by the owner wallet. Nothing here has real value.

## Wallets

| Role | Address |
|------|---------|
| Owner and deployer of all contracts (MetaMask Account 1) | `0x951e354EB75452e81a4B782BF57878DE3644c2EB` |
| Test wallet (Account 2) | `0x71614ff0539d1BD9D6bC60926458626BFaC6E39C` |
| Test wallet (Account 3) | `0x87C107f39d0D70EE506Db5B066D2E0955681EE63` |
| Test wallet (Account 4) | `0x37B40105954856a6e2D967B3C0A0d300D75bd450` |
| Extra NFT allowlist wallet | `0x49215Af64999e2A2D5c00e3d9C1D93E6B6Fbf749` |

## Active contracts (used by the app)

| Contract | Address | Notes |
|----------|---------|-------|
| PrimusToken (PRM) | `0xA0f6517d67Ae29486C73c70f26F5cB57a4B6F760` | ERC-20, 18 decimals, 1,000,000 minted to the owner at deployment, no mint function |
| MerkleAirdrop | `0x2036ED85651486BB53ca2F4Ed1747eD6230Ddf1b` | `claim(account, amount, proof)`. Funded with 2,000 PRM |
| PrimusNFT (Primus Genesis, PGEN) | `0x6d48C2B7479dC5574529471f39d4FB0bf27F45b6` | Allowlist mint, max supply 100 |
| PrimusBadge (Primus Airdrop Claimer, PBADGE) | `0x867816Bc5107463f16e92073De5D418Daa8087b0` | Soulbound, gated by the airdrop contract's `hasClaimed` |

Source files are in `contracts/`. They are reference copies: they import OpenZeppelin, which the Vite project does not install. Compile and deploy them in Remix.

## Constructor inputs used

| Contract | Inputs |
|----------|--------|
| PrimusToken | `initialSupply = 1000000` (the contract multiplies by 10^18) |
| MerkleAirdrop | `token_ = 0xA0f6...F760`, `merkleRoot_ = 0xeaf3e88aaf392b0651e41e81f2769654335ba9b8a54625dea6851f19446b9ed7` |
| PrimusNFT | `baseURI_ = ipfs://bafybeigwzjyur7ttyoh24aee6hedq4fccjekmv67eh24vhtm3jkqdcf534/`, `merkleRoot_ = 0x0b9d0cf070d15d212db3071b9a14abfbf4ed651da9b503475b42d42b68ffea8d`, `maxSupply_ = 100` |
| PrimusBadge | `airdrop_ = 0x2036ED85651486BB53ca2F4Ed1747eD6230Ddf1b`, `badgeURI_ = ipfs://<badge.json CID>` (a single-file CID, no filename) |

## Merkle data

| Tree | Source file | Leaf | Root |
|------|-------------|------|------|
| Airdrop | `src/allowlist.json` | `(address, amount in 18-decimal units)` | `0xeaf3e88aaf392b0651e41e81f2769654335ba9b8a54625dea6851f19446b9ed7` |
| NFT allowlist | `src/nftAllowlist.json` (falls back to the airdrop addresses) | `(address)` | `0x0b9d0cf070d15d212db3071b9a14abfbf4ed651da9b503475b42d42b68ffea8d` |

Airdrop allowlist amounts in whole tokens: `0x37B4...d450` 500, `0x7161...e39c` 250, `0x87C1...EE63` 1000, `0x951e...c2EB` 100.

Both leaf formats are `keccak256(bytes.concat(keccak256(abi.encode(...))))`, matching `@openzeppelin/merkle-tree` StandardMerkleTree. Roots are stored as immutables, so changing a list means deploying a new contract.

## Uniswap v4 pool (ETH / PRM)

| Item | Value |
|------|-------|
| Pool ID | `0xc2b2ec193b0294cfd3c05eea38956a5f350b55e59a245128051e8bc7e3a6e674` |
| currency0 / currency1 | ETH (`0x0000...0000`) / PRM |
| Fee | 2500 (0.25%) |
| Tick spacing | 25 |
| Hooks | none |
| Range | Full range |
| Initial liquidity | about 0.02 ETH and 20,000 PRM, starting price about 1,000,000 PRM per ETH (tick 138162) |
| Creation transaction | sent from the owner wallet, hash begins `0xfbd235d5f5233bdf`. Its Initialize and ModifyLiquidity events hold the pool ID, fee and tick spacing |
| PoolManager (Sepolia) | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` |
| StateView (Sepolia) | `0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c` |
| PositionManager | `0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4` (the owner's position NFT id is 41735) |

Addresses for PoolManager and StateView come from Uniswap's v4 deployments documentation. Re-check them there if anything fails.

## IPFS data (Pinata)

| Item | Value |
|------|-------|
| NFT images folder | `ipfs://bafybeif5jbcdue5k44rjrji42jel3zqyisbzyogf3hxasduc45jwmosvgi/` containing `1.png` to `6.png` (six samurai) |
| NFT metadata folder | `ipfs://bafybeigwzjyur7ttyoh24aee6hedq4fccjekmv67eh24vhtm3jkqdcf534/` containing `1.json` to `6.json` |
| Badge image (single file) | `ipfs://bafkreichfpkqszsgszuvwndsa6g3okohpcac4kxj3ite2xeet7flajkauu` |
| Badge metadata (single file) | `ipfs://bafkreialed5tgu2fgasmyxi46gwnfa4omqkjygfrhnf7quz24h367jnjpy` |
| Gateway used by the app | `https://gateway.pinata.cloud/ipfs/` (set in `src/constants.js`) |
| Dedicated Pinata gateway | `olive-characteristic-newt-976.mypinata.cloud` |

The images folder does not contain a badge image. The badge image file was named `bagde.png` locally (a typo), so it was never in the folder under `badge.png`. The badge image was uploaded on its own and `badge.json` points at it directly.

## Contract behaviors

**MerkleAirdrop.** `claim(address account, uint256 amount, bytes32[] proof)`. Tokens always go to `account`. Reverts `AlreadyClaimed` or `InvalidProof`. `hasClaimed(address)` is public. Owner can call `withdrawRemaining()`.

**PrimusNFT.** `mint(address account, bytes32[] proof)`, one per wallet, reverts `AlreadyMinted`, `InvalidProof`, `SoldOut`. Token IDs cycle through six metadata files: token 1 uses `1.json`, token 6 uses `6.json`, token 7 uses `1.json`. Owner can call `setBaseURI`.

**PrimusBadge.** `mint(address account)`, one per wallet, reverts `AlreadyMinted` or `NotClaimed`. `_update` is overridden so only minting works (transfers and burns revert `Soulbound`). Every badge shares one metadata file. Owner can call `setBadgeURI`.

## Deployment history and superseded contracts

| Contract | Address | Status |
|----------|---------|--------|
| First MerkleAirdrop (used `msg.sender`) | `0x031290074A4796a979936126b5a3e964011152E8` | Superseded. It broke when MetaMask "Added protection" routed claims through a forwarder. It may still hold unclaimed PRM, which the owner can recover with `withdrawRemaining` |
| PrimusBadge, first deploy | `0x9c5F9c8A0607012012fa59456B4a2ef78C38bDa4` | Unused (its badge image link was broken) |
| PrimusBadge, second deploy | `0xbB941D89Fa894F7569a2b3949C4bd071349cD65a` | Unused |

## Checklist when a contract changes

1. Update the address in `src/constants.js` (lowercase).
2. Update this file and `README.md`.
3. If a Merkle list changed, regenerate the tree (`npm run merkle` or `npm run merkle:nft`), deploy a new contract with the new root, and fund it if it is an airdrop.
4. Test with a fresh wallet state: connect, mint or claim, refresh, confirm the state persists.
