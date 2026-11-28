// Run with: npm run test:functions
import assert from "node:assert/strict";
import { AbiCoder, id, zeroPadValue, toBeHex, Wallet } from "npm:ethers@6";
import {
  buildPoolActivity,
  classifyNft,
  classifyPrm,
  clearCache,
  handleChainHistory,
  INITIALIZE_TOPIC,
  SWAP_TOPIC,
  type HistoryDeps,
} from "./chainHistory.ts";
import { BADGE, LAUNCH_AIRDROP, NFT, POOL_ID, POOL_MANAGER, PRM, ZERO_ADDRESS } from "./chain.ts";
import { createEtherscan, EtherscanError, type EtherscanCall } from "./etherscan.ts";

const coder = AbiCoder.defaultAbiCoder();
const Q96 = 2n ** 96n;
const E18 = 10n ** 18n;
const NOW = 1_800_000_000; // seconds
const wallet = Wallet.createRandom().address.toLowerCase();
const other = Wallet.createRandom().address.toLowerCase();

// sqrtPriceX96 for a given PRM-per-ETH price (a perfect square keeps this exact)
const sqrtFor = (prmPerEth: bigint) => Q96 * BigInt(Math.round(Math.sqrt(Number(prmPerEth))));

function initLog(sqrt: bigint, block: number) {
  return {
    topics: [INITIALIZE_TOPIC, POOL_ID, zeroPadValue("0x00", 32), zeroPadValue("0x01", 32)],
    data: coder.encode(
      ["uint24", "int24", "address", "uint160", "int24"],
      [2500, 50, ZERO_ADDRESS, sqrt, 0],
    ),
    blockNumber: toBeHex(block),
    logIndex: "0x",
    timeStamp: toBeHex(NOW - 100_000),
    transactionHash: "0xinit",
  };
}

function swapLog(
  amount0: bigint,
  amount1: bigint,
  sqrt: bigint,
  block: number,
  ageSeconds: number,
  hash: string,
) {
  return {
    topics: [SWAP_TOPIC, POOL_ID, zeroPadValue(other, 32)],
    data: coder.encode(
      ["int128", "int128", "uint160", "uint128", "int24", "uint24"],
      [amount0, amount1, sqrt, 1000n, 0, 2500],
    ),
    blockNumber: toBeHex(block),
    logIndex: "0x1",
    timeStamp: toBeHex(NOW - ageSeconds),
    transactionHash: hash,
  };
}

Deno.test("topics match the Uniswap v4 event signatures", () => {
  // The well-known v4 Swap topic
  assert.equal(SWAP_TOPIC, "0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f");
  assert.equal(INITIALIZE_TOPIC, id("Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)"));
});

Deno.test("pool activity: direction comes from the price move, volumes add up", () => {
  const start = sqrtFor(1_000_000n); // 1,000,000 PRM per ETH
  const lower = sqrtFor(810_000n); // ETH in: PRM per ETH falls
  const higher = sqrtFor(1_000_000n); // PRM in: PRM per ETH rises again

  const logs = [
    // Out of order on purpose; Initialize comes first by block
    swapLog(-(E18 / 100n), 1_000n * E18, higher, 12, 3600, "0xsell"),
    initLog(start, 10),
    swapLog(E18 / 50n, -(900n * E18), lower, 11, 200_000, "0xold"),
  ];
  const out = buildPoolActivity(logs as never, NOW);

  assert.equal(out.swapCount, 2);
  assert.equal(out.recent[0].hash, "0xsell"); // newest first
  assert.equal(out.recent[0].side, "sell");
  assert.equal(out.recent[1].side, "buy");
  // Magnitudes ignore the sign convention
  assert.equal(out.recent[1].eth, "0.02");
  assert.equal(out.recent[1].prm, "900.0");
  assert.equal(out.volumeEth, "0.03");
  // Only the recent swap is inside the last 24 hours
  assert.equal(out.last24h.swaps, 1);
  assert.equal(out.last24h.volumeEth, "0.01");
  assert.equal(out.history.length, 2);
  // Oldest first: 1/810,000 ETH per PRM after the buy, then 1/1,000,000 after the sell
  assert.ok(out.history[0].ethPerPrm > out.history[1].ethPerPrm);
});

Deno.test("pool activity: no swaps gives an empty summary", () => {
  const out = buildPoolActivity([initLog(sqrtFor(1_000_000n), 5)] as never, NOW);
  assert.equal(out.swapCount, 0);
  assert.equal(out.volumeEth, "0.0");
  assert.deepEqual(out.history, []);
  assert.deepEqual(out.recent, []);
});

Deno.test("pool activity: long histories are downsampled and keep both ends", () => {
  const logs = [initLog(sqrtFor(1_000_000n), 1)];
  for (let i = 0; i < 200; i++) {
    logs.push(swapLog(E18, -E18, sqrtFor(BigInt(1_000_000 - i * 1000)), 2 + i, 1000 - i, `0x${i}`) as never);
  }
  const out = buildPoolActivity(logs as never, NOW);
  assert.equal(out.swapCount, 200);
  assert.equal(out.history.length, 60);
  assert.equal(out.recent.length, 8);
});

Deno.test("wallet activity is classified by who sent what", () => {
  const prm = (from: string, to: string, value = "5000000000000000000000") => ({
    hash: "0xh", timeStamp: "1700000000", from, to, value, tokenDecimal: "18",
  });
  const roundAirdrop = Wallet.createRandom().address.toLowerCase();
  const airdrops = [LAUNCH_AIRDROP, roundAirdrop];

  assert.equal(classifyPrm(prm(roundAirdrop, wallet), wallet, airdrops).kind, "airdrop");
  assert.equal(classifyPrm(prm(LAUNCH_AIRDROP, wallet), wallet, airdrops).kind, "airdrop");
  assert.equal(classifyPrm(prm(POOL_MANAGER, wallet), wallet, airdrops).kind, "swap_buy");
  assert.equal(classifyPrm(prm(wallet, POOL_MANAGER), wallet, airdrops).kind, "swap_sell");
  assert.equal(classifyPrm(prm(other, wallet), wallet, airdrops).kind, "received");
  assert.equal(classifyPrm(prm(wallet, other), wallet, airdrops).kind, "sent");
  assert.equal(classifyPrm(prm(other, wallet), wallet, airdrops).amount, "5000.0");

  const nft = (from: string, to: string, contract: string) => ({
    hash: "0xn", timeStamp: "1700000000", from, to, tokenID: "7", contractAddress: contract,
  });
  assert.equal(classifyNft(nft(ZERO_ADDRESS, wallet, NFT), wallet).kind, "nft_mint");
  assert.equal(classifyNft(nft(ZERO_ADDRESS, wallet, BADGE), wallet).kind, "badge_mint");
  assert.equal(classifyNft(nft(other, wallet, NFT), wallet).kind, "nft_in");
  assert.equal(classifyNft(nft(wallet, other, BADGE), wallet).kind, "badge_out");
  assert.equal(classifyNft(nft(ZERO_ADDRESS, wallet, NFT), wallet).tokenId, "7");
});

// A fake Etherscan that answers by action and records the calls
function fakeEtherscan(answers: Record<string, unknown[]>) {
  const calls: Record<string, string>[] = [];
  const call: EtherscanCall = async (params) => {
    calls.push(params);
    return (answers[params.action + ":" + (params.contractaddress ?? "")] ??
      answers[params.action] ?? []) as never;
  };
  return { call, calls };
}

function deps(call: EtherscanCall | null, overrides: Partial<HistoryDeps> = {}): HistoryDeps {
  return {
    etherscan: call,
    getAirdropAddresses: async () => [],
    now: () => NOW * 1000,
    ...overrides,
  };
}

const get = (query: string, method = "GET") =>
  new Request(`https://x.test/chain-history?${query}`, { method });

Deno.test("handler: wallet view merges PRM, NFT and badge activity, newest first", async () => {
  clearCache();
  const { call, calls } = fakeEtherscan({
    ["tokentx:" + PRM]: [
      { hash: "0x1", timeStamp: "1000", from: LAUNCH_AIRDROP, to: wallet, value: "250000000000000000000", tokenDecimal: "18" },
    ],
    ["tokennfttx:" + NFT]: [
      { hash: "0x2", timeStamp: "3000", from: ZERO_ADDRESS, to: wallet, tokenID: "4", contractAddress: NFT },
    ],
    ["tokennfttx:" + BADGE]: [
      { hash: "0x3", timeStamp: "2000", from: ZERO_ADDRESS, to: wallet, tokenID: "9", contractAddress: BADGE },
    ],
  });
  const res = await handleChainHistory(get(`view=wallet&address=${wallet}`), deps(call));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.items.map((i: { kind: string }) => i.kind), ["nft_mint", "badge_mint", "airdrop"]);
  // The wallet is sent to Etherscan in lowercase, one request at a time per contract
  assert.equal(calls.length, 3);
  assert.ok(calls.every((c) => c.address === wallet));
});

Deno.test("handler: live round airdrops count as airdrop claims", async () => {
  clearCache();
  const round = Wallet.createRandom().address.toLowerCase();
  const { call } = fakeEtherscan({
    ["tokentx:" + PRM]: [
      { hash: "0x1", timeStamp: "1000", from: round, to: wallet, value: "5000000000000000000000", tokenDecimal: "18" },
    ],
  });
  const res = await handleChainHistory(
    get(`view=wallet&address=${wallet}`),
    deps(call, { getAirdropAddresses: async () => [round] }),
  );
  assert.equal((await res.json()).items[0].kind, "airdrop");
});

Deno.test("handler: pool view queries only the pool's events, not a topic operator", async () => {
  clearCache();
  const { call, calls } = fakeEtherscan({
    getLogs: [initLog(sqrtFor(1_000_000n), 1), swapLog(E18, -E18, sqrtFor(810_000n), 2, 60, "0xs")],
  });
  const res = await handleChainHistory(get("view=pool"), deps(call));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).pool.swapCount, 1);
  assert.equal(calls[0].address, POOL_MANAGER);
  assert.equal(calls[0].topic1, POOL_ID);
  assert.equal(calls[0].topic0, undefined);
});

Deno.test("handler: bad requests, missing key and Etherscan failures", async () => {
  clearCache();
  const { call } = fakeEtherscan({});
  assert.equal((await handleChainHistory(get("view=nope"), deps(call))).status, 400);
  assert.equal((await handleChainHistory(get("view=wallet"), deps(call))).status, 400);
  assert.equal((await handleChainHistory(get("view=wallet&address=0x123"), deps(call))).status, 400);
  assert.equal((await handleChainHistory(get("view=pool", "POST"), deps(call))).status, 400);
  assert.equal((await handleChainHistory(get("view=pool", "OPTIONS"), deps(call))).status, 204);
  // No ETHERSCAN_API_KEY
  assert.equal((await handleChainHistory(get("view=pool"), deps(null))).status, 503);

  clearCache();
  const failing: EtherscanCall = async () => {
    throw new EtherscanError("secret detail");
  };
  const res = await handleChainHistory(get("view=pool"), deps(failing));
  assert.equal(res.status, 502);
  assert.ok(!JSON.stringify(await res.json()).includes("secret detail"));

  clearCache();
  const broken: EtherscanCall = async () => {
    throw new Error("boom");
  };
  assert.equal((await handleChainHistory(get("view=pool"), deps(broken))).status, 500);
});

Deno.test("handler: a repeat request inside 30 seconds is answered from the cache", async () => {
  clearCache();
  const { call, calls } = fakeEtherscan({ getLogs: [] });
  let now = NOW * 1000;
  const d = deps(call, { now: () => now });
  await handleChainHistory(get("view=pool"), d);
  const first = calls.length;
  now += 10_000;
  await handleChainHistory(get("view=pool"), d);
  assert.equal(calls.length, first);
  now += 30_000;
  await handleChainHistory(get("view=pool"), d);
  assert.ok(calls.length > first);
});

Deno.test("etherscan client: sends chainid and key, maps results and errors", async () => {
  const seen: URL[] = [];
  const respond = (body: unknown, ok = true) =>
    (async (url: URL) => {
      seen.push(url);
      return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
    }) as unknown as typeof fetch;

  const ok = createEtherscan("KEY123", respond({ status: "1", message: "OK", result: [{ a: "1" }] }));
  assert.deepEqual(await ok({ module: "logs" }), [{ a: "1" }]);
  assert.equal(seen[0].searchParams.get("chainid"), "11155111");
  assert.equal(seen[0].searchParams.get("apikey"), "KEY123");

  const none = createEtherscan("KEY123", respond({ status: "0", message: "No records found", result: [] }));
  assert.deepEqual(await none({}), []);

  const plan = createEtherscan(
    "KEY123",
    respond({ status: "0", message: "NOTOK", result: "Free API access is not supported for this chain" }),
  );
  await assert.rejects(() => plan({}), (e: Error) => e instanceof EtherscanError && !e.message.includes("KEY123"));

  const down = createEtherscan("KEY123", respond({}, false));
  await assert.rejects(() => down({}), (e: Error) => !e.message.includes("KEY123"));
});

Deno.test("constants match src/constants.js", () => {
  const src = Deno.readTextFileSync("src/constants.js").toLowerCase();
  for (const value of [PRM, NFT, BADGE, LAUNCH_AIRDROP, POOL_ID]) {
    assert.ok(src.includes(value), `${value} is missing from src/constants.js`);
  }
});
