import test from "node:test";
import assert from "node:assert/strict";
import { Wallet, keccak256, AbiCoder, getBytes, concat } from "ethers";
import { buildRoundTree } from "./roundTree.js";

async function registration(wallet) {
  const message = `Register ${wallet.address}`;
  return {
    address: wallet.address.toLowerCase(),
    message,
    signature: await wallet.signMessage(message),
  };
}

test("builds a tree whose proofs verify against the contract leaf format", async () => {
  const wallets = [Wallet.createRandom(), Wallet.createRandom(), Wallet.createRandom()];
  const registrations = await Promise.all(wallets.map(registration));
  const out = buildRoundTree({ round: { amount: 5000 }, registrations });

  assert.equal(out.count, 3);
  assert.equal(out.amountRaw, "5000000000000000000000");
  assert.equal(out.totalRaw, "15000000000000000000000");

  // Recompute the leaf exactly as MerkleAirdrop.sol does and walk the proof
  for (const w of wallets) {
    const entry = out.proofs[w.address.toLowerCase()];
    assert.ok(entry);
    const inner = keccak256(
      AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [w.address, entry.amount]),
    );
    let node = keccak256(getBytes(inner));
    for (const sibling of entry.proof) {
      const [a, b] = node.toLowerCase() < sibling.toLowerCase() ? [node, sibling] : [sibling, node];
      node = keccak256(concat([a, b]));
    }
    assert.equal(node, out.root);
  }
});

test("single registration works", async () => {
  const regs = [await registration(Wallet.createRandom())];
  const out = buildRoundTree({ round: { amount: "5000" }, registrations: regs });
  assert.equal(out.count, 1);
  assert.ok(out.root.startsWith("0x"));
});

test("rejects an empty round", () => {
  assert.throws(() => buildRoundTree({ round: { amount: 5000 }, registrations: [] }), /No registrations/);
});

test("rejects duplicate addresses", async () => {
  const r = await registration(Wallet.createRandom());
  assert.throws(() => buildRoundTree({ round: { amount: 5000 }, registrations: [r, r] }), /Duplicate/);
});

test("rejects a signature from a different wallet", async () => {
  const a = await registration(Wallet.createRandom());
  const b = await registration(Wallet.createRandom());
  const forged = { ...a, signature: b.signature };
  assert.throws(() => buildRoundTree({ round: { amount: 5000 }, registrations: [forged] }), /does not match/);
});
