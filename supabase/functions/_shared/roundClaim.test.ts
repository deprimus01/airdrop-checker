// Run with: npm run test:functions   (uses Deno, downloaded on demand)
import assert from "node:assert/strict";
import { Wallet } from "npm:ethers@6";
import { type ClaimDb, handleRoundClaim, type LiveRound, type ProofRow } from "./roundClaim.ts";

const wallet = Wallet.createRandom();
const other = Wallet.createRandom();

const live: LiveRound = {
  id: 1,
  name: "Round 1",
  amount: 5000,
  airdrop_address: "0x2036ED85651486BB53ca2F4Ed1747eD6230Ddf1b",
};
const entry: ProofRow = {
  amount: "5000000000000000000000",
  proof: ["0x" + "ab".repeat(32)],
};

function fakeDb(overrides: Partial<ClaimDb> = {}) {
  const lookups: Array<[number, string]> = [];
  const db: ClaimDb = {
    getLiveRounds: async () => [live],
    getProof: async (roundId, address) => {
      lookups.push([roundId, address]);
      return address === wallet.address.toLowerCase() ? entry : null;
    },
    ...overrides,
  };
  return { db, lookups };
}

const get = (address?: string, method = "GET") =>
  new Request(
    `https://x.test/round-claim${address === undefined ? "" : `?address=${address}`}`,
    { method },
  );

Deno.test("returns the wallet's own proof for a live round", async () => {
  const { db, lookups } = fakeDb();
  const res = await handleRoundClaim(get(wallet.address), db);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.rounds[0].claim, entry);
  assert.equal(body.rounds[0].airdropAddress, live.airdrop_address);
  assert.equal(body.rounds[0].amountPerWallet, 5000);
  // The address is looked up in lowercase, matching how proofs are stored
  assert.deepEqual(lookups[0], [1, wallet.address.toLowerCase()]);
});

Deno.test("claim is null for a wallet that is not in the round", async () => {
  const res = await handleRoundClaim(get(other.address), fakeDb().db);
  const body = await res.json();
  assert.equal(body.rounds[0].claim, null);
});

Deno.test("no live rounds gives an empty list", async () => {
  const { db, lookups } = fakeDb({ getLiveRounds: async () => [] });
  const res = await handleRoundClaim(get(wallet.address), db);
  assert.deepEqual(await res.json(), { rounds: [] });
  assert.equal(lookups.length, 0);
});

Deno.test("rejects a missing or invalid address", async () => {
  assert.equal((await handleRoundClaim(get(), fakeDb().db)).status, 400);
  assert.equal((await handleRoundClaim(get("0x123"), fakeDb().db)).status, 400);
});

Deno.test("rejects non-GET methods and answers OPTIONS", async () => {
  assert.equal((await handleRoundClaim(get(wallet.address, "POST"), fakeDb().db)).status, 400);
  assert.equal((await handleRoundClaim(get(wallet.address, "OPTIONS"), fakeDb().db)).status, 204);
});

Deno.test("a database error gives a generic 500", async () => {
  const { db } = fakeDb({
    getLiveRounds: async () => {
      throw new Error("secret detail");
    },
  });
  const res = await handleRoundClaim(get(wallet.address), db);
  assert.equal(res.status, 500);
  assert.ok(!JSON.stringify(await res.json()).includes("secret detail"));
});
