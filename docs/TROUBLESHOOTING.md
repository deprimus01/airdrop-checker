# Troubleshooting

Problems already hit during the build, with the cause and the fix.

## Wallet and transactions

| Symptom | Cause | Fix |
|---------|-------|-----|
| Claim reverts with "transaction execution reverted" only when MetaMask "Added protection" is on | The transaction was routed through a forwarding contract, so `msg.sender` was the forwarder | Contracts take an explicit `account` argument (fixed). If it ever recurs, turn protection off to confirm, then check the contract |
| "insufficient funds for gas" on a claim or mint | The wallet has no Sepolia ETH | Send a little Sepolia ETH or use a faucet. Every claim, mint and badge needs gas |
| MetaMask asked for a connection but the address did not change after Switch Wallet | The account picker lets several accounts stay ticked | Untick the old account and tick only the new one |
| `eth_requestAccounts` shows no popup after a disconnect | MetaMask remembers the site approval. The app's Disconnect only clears its own state | Use Switch Wallet, or revoke the site in MetaMask permissions |
| MetaMask warns that the site is malicious or shows "Continue at your own risk" | A new free `vercel.app` domain is flagged by MetaMask's security provider (false positive) | Deferred. Report it to MetaMask support and consider a custom domain |
| NFT image is blank in MetaMask but shows in the app | MetaMask loads IPFS media through its own gateway and caches empty results | Check Settings, Privacy, IPFS gateway is on. Remove and re-import the NFT. It is cosmetic |

## Remix

| Symptom | Cause | Fix |
|---------|-------|-----|
| Deploy panel shows no constructor fields | The dropdown has an interface or a library selected (for example `IMerkleAirdrop`) | Choose the real contract. It is near the bottom of the dropdown list. Compile the file again if it is missing |
| Deployed contracts disappeared after a reload | Remix forgets deployed contracts | Use "At Address" with the contract address, or test from the app instead |
| The environment says Remix VM and 100 ETH | The default environment is a fake local chain | Select Browser Extension and Sepolia Testnet - MetaMask before deploying |
| A red underline on an address field | The address is invalid or truncated | Copy it again in full from Etherscan or the Remix card |
| Wrong contract address copied from Etherscan | The long text on the Contract tab is bytecode | Use the address in the page header or the URL |

## Uniswap

| Symptom | Cause | Fix |
|---------|-------|-----|
| "New position" is missing | Uniswap renamed it | Use Create Pool (new pool) or Create position |
| Price card shows "Pool not found" | `POOL_ID` is wrong or still a placeholder | Copy the `id` from the Initialize event in the pool creation transaction on Etherscan |

## IPFS and Pinata

| Symptom | Cause | Fix |
|---------|-------|-----|
| "no link named X ... The root CID exists but the child file does not" | The folder exists but has no file with that name | List the folder in Pinata and use the real file name. The badge image had been named `bagde.png` |
| Badge image broken in the app, name shows | `badge.json` pointed at a file that was not in the folder | Upload the image as a single file and use `ipfs://<CID>` with no filename |
| Metadata link looks like `ipfs://https://...` | Mixed formats | Use `ipfs://<CID>` only |

## App

| Symptom | Cause | Fix |
|---------|-------|-----|
| Vite error: failed to resolve import "ethers" | Dependencies not installed | `npm install` |
| NFT card: "Could not read the NFT contract" with the supply showing | Log queries over a wide block range were rejected by the public RPC | Fixed: the app uses `ownerOf` |
| Price card does not appear | `<PriceCard />` was only in the "no wallet" return | It must be in the main return |
| Lint warnings `set-state-in-effect` | Data-loading effects call an async function that sets state | Known and harmless (6 warnings, 0 errors) |

## Supabase

| Symptom | Cause | Fix |
|---------|-------|-----|
| `supabase init` says `config.toml` file exists | A file was already there | `npx supabase init --force` (replaces it with defaults; the migration and functions are untouched) |
| `db push` fails with `ECONNREFUSED 127.0.0.1:54322` and mentions Docker | Supabase CLI 3.4.0 and later target a local database by default | `npx supabase db push --remote` |
| `db push --remote` cannot connect | Network without IPv6 or a firewall | Run the migration in the dashboard SQL Editor |
| Function returns CORS errors in the browser | Preflight not handled or the function is not deployed | Redeploy; the shared handler answers `OPTIONS` |
| Registration card is missing | `VITE_SUPABASE_URL` is not set, or no non-draft round exists | Set the variable and restart or rebuild, and check the `rounds` table |
| "The signature has expired" | The message is older than 10 minutes or the device clock is far off | Try again, and check the device clock |
| `permission denied for table rounds` from `npm run round:export` | `.env.admin` holds the publishable key instead of the secret key | Use the key labelled secret (`sb_secret_...`) from the API keys page |
| Deno tests fail on `@types/node` or type-check errors | `node_modules` exists next to the functions, so Deno resolves npm types differently | `npm run test:functions` already passes `--node-modules-dir=none` |

## Round airdrop (Remix and claims)

| Symptom | Cause | Fix |
|---------|-------|-----|
| Remix: `bad address checksum` when deploying | A mixed-case address whose capitals are wrong, or a mistyped address | Take the address from `src/constants.js` or an on-chain read. The all-lowercase form is always accepted |
| Round claim card: `execution reverted (unknown custom error)` | The claim reaches the token transfer and fails there. Usually the contract holds too little PRM, or its immutable `token` address is wrong. A wrong proof or an already-claimed wallet shows a named message instead | `npm run round:check -- <contract>`. If the token is wrong, redeploy. Anything already sent to that contract is stuck |
| `balanceOf` through a contract's token returns `0x` | The address has no contract code | The address is mistyped. Compare it with the on-chain value |
| Registration card shows registration as closed while a test round exists | The card follows the newest non-draft round | Delete the temporary round row |

## Pool stats and history (Phase 5)

| Symptom | Cause | Fix |
|---------|-------|-----|
| `chain-history` returns `not_configured` | The `ETHERSCAN_API_KEY` function secret is not set | `npx supabase secrets set ETHERSCAN_API_KEY=...`, then redeploy |
| `history_unavailable` | Etherscan refused or failed: wrong key, the free plan not covering Sepolia, or a rate limit | Check the key and your Etherscan plan. The function logs the Etherscan message (never the key) in the Supabase function logs |
| Pool card shows fee, liquidity and tick but no volume or swaps | The history service is not set up or unavailable | See the two rows above |
| Swaps are labelled the wrong way round (bought instead of sold) | The direction comes from the price move, which assumes currency0 is ETH and currency1 is PRM | Check the pool order in `CONTRACTS.md`. If it differs, flip the comparison in `buildPoolActivity` |
| A swap you made is missing | Etherscan indexing lags a little, and results are cached for 30 seconds | Wait a minute and refresh the card |
| Wallet history misses ETH-only or approval transactions | It lists PRM transfers and NFT and badge transfers only | By design. Open the wallet on Etherscan for everything |
| Swap on Uniswap opens the wrong network or no pair | The `chain=sepolia` value in `UNISWAP_SWAP_URL` is not confirmed by Uniswap's docs | Check the URL Uniswap shows after loading, and fix the `chain` value in `src/constants.js` |

