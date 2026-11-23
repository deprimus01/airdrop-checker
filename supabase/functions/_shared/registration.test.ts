// Run with: npm run test:functions   (uses Deno, downloaded on demand)
import assert from "node:assert/strict";
import { Wallet } from "npm:ethers@6";
import {
  buildMessage,
  handleInfo,
  handleRegister,
  MAX_AGE_MS,
  type Db,
  type RegisterResult,
  type RoundRow,
} from "./registration.ts";

const NOW = Date.parse("2026-11-26T12:00:00.000Z");
const now = () => NOW;

const wallet = Wallet.createRandom();
const other = Wallet.createRandom();

const round: RoundRow = {
  id: 1,
  name: "Round 1",
  opens_at: "2026-11-25T00:00:00+00:00",
  closes_at: "2026-12-25T23:59:59+00:00",
  amount: 5000,
  max_registrations: 100,
  status: "open",
};

// A fake database that records calls and returns what the test asks for
function fakeDb(overrides: Partial<Db> & { result?: RegisterResult } = {}) {
  const calls: unknown[] = [];
  const db: Db = {
    registerWallet: async (args) => {
      calls.push(args);
      return overrides.result ?? "ok";
    },
    getActiveRound: async () => round,
    countRegistrations: async () => 7,
    isRegistered: async () => false,
    ...overrides,
  };
  return { db, calls };
}

async function signedBody(signer = wallet, issuedAtMs = NOW, roundId = 1) {
  const issuedAt = new Date(issuedAtMs).toISOString();
  const address = wallet.address;
  const signature = await signer.signMessage(buildMessage({ address, roundId, issuedAt }));
  return { address, roundId, issuedAt, signature };
}

function post(body: unknown) {
  return new Request("http://x/register", { method: "POST", body: JSON.stringify(body) });
}

async function code(res: Response) {
  return (await res.json()).error as string;
}

Deno.test("register: valid signature is stored with a lowercase address", async () => {
  const { db, calls } = fakeDb();
  const res = await handleRegister(post(await signedBody()), db, now);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.length, 1);
  assert.equal((calls[0] as { address: string }).address, wallet.address.toLowerCase());
});

Deno.test("register: signature from a different wallet is rejected", async () => {
  const { db, calls } = fakeDb();
  const res = await handleRegister(post(await signedBody(other)), db, now);
  assert.equal(res.status, 401);
  assert.equal(await code(res), "invalid_signature");
  assert.equal(calls.length, 0);
});

Deno.test("register: tampering with the round id invalidates the signature", async () => {
  const { db, calls } = fakeDb();
  const body = await signedBody(wallet, NOW, 1);
  const res = await handleRegister(post({ ...body, roundId: 2 }), db, now);
  assert.equal(await code(res), "invalid_signature");
  assert.equal(calls.length, 0);
});

Deno.test("register: old and future signatures are rejected", async () => {
  const { db, calls } = fakeDb();
  const old = await handleRegister(post(await signedBody(wallet, NOW - MAX_AGE_MS - 1000)), db, now);
  assert.equal(await code(old), "expired_signature");
  const future = await handleRegister(post(await signedBody(wallet, NOW + 10 * 60 * 1000)), db, now);
  assert.equal(await code(future), "expired_signature");
  assert.equal(calls.length, 0);
});

Deno.test("register: malformed requests are rejected", async () => {
  const { db } = fakeDb();
  const good = await signedBody();
  const bad = [
    {},
    { ...good, address: "not-an-address" },
    { ...good, roundId: "1" },
    { ...good, roundId: 0 },
    { ...good, signature: "0x1234" },
    { ...good, issuedAt: "yesterday" },
    { ...good, issuedAt: "2026-11-26 12:00:00" },
  ];
  for (const body of bad) {
    const res = await handleRegister(post(body), db, now);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  const notJson = await handleRegister(new Request("http://x", { method: "POST", body: "{oops" }), db, now);
  assert.equal(notJson.status, 400);
  const get = await handleRegister(new Request("http://x", { method: "GET" }), db, now);
  assert.equal(get.status, 400);
});

Deno.test("register: database results map to the right HTTP errors", async () => {
  const expected: Record<string, number> = {
    round_not_found: 404,
    not_open_yet: 403,
    closed: 403,
    round_full: 409,
    already_registered: 409,
  };
  for (const [result, status] of Object.entries(expected)) {
    const { db } = fakeDb({ result: result as RegisterResult });
    const res = await handleRegister(post(await signedBody()), db, now);
    assert.equal(res.status, status, result);
    assert.equal(await code(res), result);
  }
});

Deno.test("register: database failure returns a generic error", async () => {
  const { db } = fakeDb({ registerWallet: async () => { throw new Error("secret detail"); } });
  const res = await handleRegister(post(await signedBody()), db, now);
  assert.equal(res.status, 500);
  const text = JSON.stringify(await res.json());
  assert.ok(!text.includes("secret detail"));
});

Deno.test("cors: preflight succeeds on both endpoints", async () => {
  const { db } = fakeDb();
  for (const handler of [handleRegister, handleInfo]) {
    const res = await handler(new Request("http://x", { method: "OPTIONS" }), db, now);
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
  }
});

const info = (address?: string) =>
  new Request("http://x/registration-info" + (address ? `?address=${address}` : ""));

Deno.test("info: returns no round when none exists", async () => {
  const { db } = fakeDb({ getActiveRound: async () => null });
  const res = await handleInfo(info(), db, now);
  assert.deepEqual(await res.json(), { round: null });
});

Deno.test("info: phases follow the window, status and cap", async () => {
  const phase = async (r: Partial<RoundRow>, count: number, at = NOW) => {
    const { db } = fakeDb({
      getActiveRound: async () => ({ ...round, ...r }),
      countRegistrations: async () => count,
    });
    const res = await handleInfo(info(), db, () => at);
    return (await res.json()).round.phase;
  };
  assert.equal(await phase({}, 7), "open");
  assert.equal(await phase({}, 7, Date.parse("2026-11-24T00:00:00Z")), "upcoming");
  assert.equal(await phase({}, 7, Date.parse("2026-12-26T00:00:00Z")), "closed");
  assert.equal(await phase({}, 100), "full");
  assert.equal(await phase({ max_registrations: null }, 5000), "open");
  assert.equal(await phase({ status: "closed" }, 7), "closed");
  assert.equal(await phase({ status: "live" }, 7), "closed");
});

Deno.test("info: reports the round details and the wallet's registration", async () => {
  const seen: string[] = [];
  const { db } = fakeDb({
    isRegistered: async (_id, address) => { seen.push(address); return true; },
  });
  const res = await handleInfo(info(wallet.address), db, now);
  const { round: r } = await res.json();
  assert.equal(r.amount, 5000);
  assert.equal(r.maxRegistrations, 100);
  assert.equal(r.registeredCount, 7);
  assert.equal(r.registered, true);
  assert.deepEqual(seen, [wallet.address.toLowerCase()]);

  // An invalid address is ignored, not an error
  const res2 = await handleInfo(info("0xnope"), db, now);
  assert.equal((await res2.json()).round.registered, false);
});

// The browser and the server must build byte-identical text, or every signature fails.
import { buildMessage as clientBuildMessage } from "../../../src/utils/registrationMessage.js";

Deno.test("message: browser and server build identical text", () => {
  const args = {
    address: "0x951e354EB75452e81a4B782BF57878DE3644c2EB",
    roundId: 1,
    issuedAt: "2026-11-26T12:00:00.000Z",
  };
  assert.equal(clientBuildMessage(args), buildMessage(args));
});
