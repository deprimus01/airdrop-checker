import { AbiCoder, formatUnits, id, isAddress } from "npm:ethers@6";
import { corsHeaders } from "./cors.ts";
import {
  BADGE,
  LAUNCH_AIRDROP,
  NFT,
  POOL_ID,
  POOL_MANAGER,
  PRM,
  ZERO_ADDRESS,
} from "./chain.ts";
import { type EtherscanCall, EtherscanError } from "./etherscan.ts";

// ---------------------------------------------------------------------------
// GET /chain-history?view=pool
//     Swap activity of the PRM/ETH pool: volume, price history, recent swaps.
// GET /chain-history?view=wallet&address=0x...
//     Recent PRM, NFT and badge activity of one wallet.
//
// Data comes from the Etherscan API, because public RPCs limit log queries.
// The Etherscan key is a function secret and never reaches the browser.
// ---------------------------------------------------------------------------

export const SWAP_TOPIC = id("Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)");
export const INITIALIZE_TOPIC = id(
  "Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)",
);

const coder = AbiCoder.defaultAbiCoder();
const Q192 = 2n ** 192n;
const ONE = 10n ** 18n;
const DAY = 24 * 60 * 60;

const MAX_LOG_PAGES = 5; // up to 5,000 pool events
const MAX_HISTORY_POINTS = 60;
const RECENT_SWAPS = 8;
const WALLET_ITEMS = 30;
const CACHE_MS = 30_000;

// ---------------------------------------------------------------------------
// Pool activity
// ---------------------------------------------------------------------------

interface RawLog {
  topics: string[];
  data: string;
  blockNumber: string; // hex
  logIndex: string; // hex, may be empty
  timeStamp: string; // hex
  transactionHash: string;
}

export interface SwapPoint {
  hash: string;
  t: number; // unix seconds
  side: "buy" | "sell" | null; // buy = ETH in, PRM out
  eth: string;
  prm: string;
  ethPerPrm: number;
}

export interface PoolActivity {
  swapCount: number;
  volumeEth: string;
  volumePrm: string;
  last24h: { swaps: number; volumeEth: string; volumePrm: string };
  history: { t: number; ethPerPrm: number }[];
  recent: SwapPoint[];
}

function ethPerPrm(sqrtPriceX96: bigint): number {
  // Pool order is currency0 = ETH, currency1 = PRM, so sqrtPriceX96 gives PRM per ETH
  const prmPerEthScaled = (sqrtPriceX96 * sqrtPriceX96 * ONE) / Q192;
  if (prmPerEthScaled === 0n) return 0;
  return Number(formatUnits((ONE * ONE) / prmPerEthScaled, 18));
}

const abs = (n: bigint) => (n < 0n ? -n : n);
const hexToNumber = (hex: string) => (hex && hex !== "0x" ? Number(BigInt(hex)) : 0);

// Turns the pool's raw logs into swaps. The direction of each swap comes from
// how it moved the price (selling ETH into the pool lowers PRM-per-ETH's
// inverse), which does not depend on the sign convention of the event amounts.
export function buildPoolActivity(logs: RawLog[], nowSec: number): PoolActivity {
  const ordered = [...logs].sort(
    (a, b) =>
      hexToNumber(a.blockNumber) - hexToNumber(b.blockNumber) ||
      hexToNumber(a.logIndex) - hexToNumber(b.logIndex),
  );

  let previousSqrt: bigint | null = null;
  const swaps: SwapPoint[] = [];
  const rawAmounts: { t: number; eth: bigint; prm: bigint }[] = [];
  let totalEth = 0n;
  let totalPrm = 0n;

  for (const log of ordered) {
    const topic0 = log.topics[0]?.toLowerCase();

    if (topic0 === INITIALIZE_TOPIC.toLowerCase()) {
      // fee, tickSpacing, hooks, sqrtPriceX96, tick
      const decoded = coder.decode(["uint24", "int24", "address", "uint160", "int24"], log.data);
      previousSqrt = BigInt(decoded[3]);
      continue;
    }
    if (topic0 !== SWAP_TOPIC.toLowerCase()) continue;

    const decoded = coder.decode(
      ["int128", "int128", "uint160", "uint128", "int24", "uint24"],
      log.data,
    );
    const amount0 = BigInt(decoded[0]);
    const amount1 = BigInt(decoded[1]);
    const sqrtPriceX96 = BigInt(decoded[2]);

    // ETH going in pushes sqrtPriceX96 down (the buyer gets PRM)
    let side: "buy" | "sell" | null = null;
    if (previousSqrt !== null) {
      if (sqrtPriceX96 < previousSqrt) side = "buy";
      else if (sqrtPriceX96 > previousSqrt) side = "sell";
    }
    previousSqrt = sqrtPriceX96;

    totalEth += abs(amount0);
    totalPrm += abs(amount1);
    rawAmounts.push({ t: hexToNumber(log.timeStamp), eth: abs(amount0), prm: abs(amount1) });
    swaps.push({
      hash: log.transactionHash,
      t: hexToNumber(log.timeStamp),
      side,
      eth: formatUnits(abs(amount0), 18),
      prm: formatUnits(abs(amount1), 18),
      ethPerPrm: ethPerPrm(sqrtPriceX96),
    });
  }

  const since = nowSec - DAY;
  let dayEth = 0n;
  let dayPrm = 0n;
  let daySwaps = 0;
  for (const raw of rawAmounts) {
    if (raw.t >= since) {
      daySwaps++;
      dayEth += raw.eth;
      dayPrm += raw.prm;
    }
  }

  return {
    swapCount: swaps.length,
    volumeEth: formatUnits(totalEth, 18),
    volumePrm: formatUnits(totalPrm, 18),
    last24h: {
      swaps: daySwaps,
      volumeEth: formatUnits(dayEth, 18),
      volumePrm: formatUnits(dayPrm, 18),
    },
    history: downsample(swaps).map((s) => ({ t: s.t, ethPerPrm: s.ethPerPrm })),
    recent: swaps.slice(-RECENT_SWAPS).reverse(),
  };
}

// Keeps the first and last point and spreads the rest evenly
function downsample<T>(items: T[], max = MAX_HISTORY_POINTS): T[] {
  if (items.length <= max) return items;
  const out: T[] = [];
  for (let i = 0; i < max; i++) {
    out.push(items[Math.round((i * (items.length - 1)) / (max - 1))]);
  }
  return out;
}

// All events of this pool come from one query on the pool ID (an indexed
// topic), so no topic operator is needed. Swap and Initialize events are
// picked out afterwards.
async function fetchPoolLogs(call: EtherscanCall): Promise<RawLog[]> {
  const logs: RawLog[] = [];
  for (let page = 1; page <= MAX_LOG_PAGES; page++) {
    const result = await call({
      module: "logs",
      action: "getLogs",
      address: POOL_MANAGER,
      topic1: POOL_ID,
      fromBlock: "0",
      toBlock: "latest",
      page: String(page),
      offset: "1000",
    });
    logs.push(...(result as unknown as RawLog[]));
    if (result.length < 1000) break;
  }
  return logs;
}

// ---------------------------------------------------------------------------
// Wallet activity
// ---------------------------------------------------------------------------

export type ActivityKind =
  | "airdrop"
  | "swap_buy"
  | "swap_sell"
  | "received"
  | "sent"
  | "nft_mint"
  | "badge_mint"
  | "nft_in"
  | "nft_out"
  | "badge_in"
  | "badge_out";

export interface ActivityItem {
  hash: string;
  t: number;
  kind: ActivityKind;
  amount?: string; // PRM, decimal string
  tokenId?: string;
  counterparty: string;
}

interface TokenTx {
  hash: string;
  timeStamp: string; // decimal
  from: string;
  to: string;
  value: string;
  tokenDecimal: string;
}

interface NftTx {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  tokenID: string;
  contractAddress: string;
}

export function classifyPrm(tx: TokenTx, wallet: string, airdrops: string[]): ActivityItem {
  const from = tx.from.toLowerCase();
  const to = tx.to.toLowerCase();
  const incoming = to === wallet;
  const counterparty = incoming ? from : to;

  let kind: ActivityKind;
  if (incoming && airdrops.includes(from)) kind = "airdrop";
  else if (counterparty === POOL_MANAGER) kind = incoming ? "swap_buy" : "swap_sell";
  else kind = incoming ? "received" : "sent";

  return {
    hash: tx.hash,
    t: Number(tx.timeStamp),
    kind,
    amount: formatUnits(BigInt(tx.value), Number(tx.tokenDecimal || "18")),
    counterparty,
  };
}

export function classifyNft(tx: NftTx, wallet: string): ActivityItem {
  const from = tx.from.toLowerCase();
  const to = tx.to.toLowerCase();
  const isBadge = tx.contractAddress.toLowerCase() === BADGE;
  const incoming = to === wallet;

  let kind: ActivityKind;
  if (from === ZERO_ADDRESS && incoming) kind = isBadge ? "badge_mint" : "nft_mint";
  else if (incoming) kind = isBadge ? "badge_in" : "nft_in";
  else kind = isBadge ? "badge_out" : "nft_out";

  return {
    hash: tx.hash,
    t: Number(tx.timeStamp),
    kind,
    tokenId: tx.tokenID,
    counterparty: incoming ? from : to,
  };
}

export async function loadWalletActivity(
  call: EtherscanCall,
  wallet: string,
  airdrops: string[],
): Promise<ActivityItem[]> {
  const base = { module: "account", address: wallet, page: "1", offset: "50", sort: "desc" };

  // One request after another: the free plan has a low requests-per-second limit
  const prm = await call({ ...base, action: "tokentx", contractaddress: PRM });
  const nft = await call({ ...base, action: "tokennfttx", contractaddress: NFT });
  const badge = await call({ ...base, action: "tokennfttx", contractaddress: BADGE });

  const items = [
    ...(prm as unknown as TokenTx[]).map((tx) => classifyPrm(tx, wallet, airdrops)),
    ...(nft as unknown as NftTx[]).map((tx) => classifyNft(tx, wallet)),
    ...(badge as unknown as NftTx[]).map((tx) => classifyNft(tx, wallet)),
  ];
  return items.sort((a, b) => b.t - a.t).slice(0, WALLET_ITEMS);
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

export interface HistoryDeps {
  // null when ETHERSCAN_API_KEY is not set
  etherscan: EtherscanCall | null;
  // Airdrop contracts that pay out PRM: the launch airdrop plus live rounds
  getAirdropAddresses(): Promise<string[]>;
  now(): number; // ms
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Short-lived cache so a page refresh does not spend Etherscan requests
const cache = new Map<string, { at: number; body: unknown }>();
export function clearCache() {
  cache.clear();
}

export async function handleChainHistory(req: Request, deps: HistoryDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET") {
    return json({ error: "invalid_request", message: "The request was not valid." }, 400);
  }

  const params = new URL(req.url).searchParams;
  const view = params.get("view");
  const address = params.get("address");

  if (view !== "pool" && view !== "wallet") {
    return json({ error: "invalid_request", message: "The request was not valid." }, 400);
  }
  if (view === "wallet" && (!address || !isAddress(address))) {
    return json({ error: "invalid_request", message: "The request was not valid." }, 400);
  }
  if (!deps.etherscan) {
    return json({ error: "not_configured", message: "History is not set up yet." }, 503);
  }

  const wallet = address ? address.toLowerCase() : "";
  const key = view === "pool" ? "pool" : `wallet:${wallet}`;
  const hit = cache.get(key);
  if (hit && deps.now() - hit.at < CACHE_MS) return json(hit.body);

  try {
    let body: unknown;
    if (view === "pool") {
      const logs = await fetchPoolLogs(deps.etherscan);
      body = { pool: buildPoolActivity(logs, Math.floor(deps.now() / 1000)) };
    } else {
      const airdrops = [LAUNCH_AIRDROP, ...(await deps.getAirdropAddresses())];
      body = { items: await loadWalletActivity(deps.etherscan, wallet, airdrops) };
    }
    cache.set(key, { at: deps.now(), body });
    return json(body);
  } catch (err) {
    console.error("chain-history failed:", err instanceof Error ? err.message : err);
    if (err instanceof EtherscanError) {
      return json(
        { error: "history_unavailable", message: "History is unavailable right now." },
        502,
      );
    }
    return json({ error: "server_error", message: "Something went wrong. Please try again." }, 500);
  }
}
