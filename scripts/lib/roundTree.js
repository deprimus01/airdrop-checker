import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { getAddress, parseUnits, verifyMessage } from "ethers";

// Builds the Merkle tree for one closed round.
//
// round:         { amount } where amount is whole PRM per wallet (the rounds row)
// registrations: [{ address, signature, message }] (the registrations rows)
//
// Every registration is re-checked before it goes into the tree: addresses
// must be unique and each stored signature must recover to its own address.
// The leaf format is the one MerkleAirdrop.sol expects: (address, uint256).
export function buildRoundTree({ round, registrations }) {
  if (!registrations.length) {
    throw new Error("No registrations to export");
  }

  const seen = new Set();
  for (const r of registrations) {
    const address = r.address.toLowerCase();
    if (seen.has(address)) {
      throw new Error(`Duplicate address in registrations: ${address}`);
    }
    seen.add(address);

    let signer = null;
    try {
      signer = verifyMessage(r.message, r.signature).toLowerCase();
    } catch {
      signer = null;
    }
    if (signer !== address) {
      throw new Error(`Stored signature does not match address ${address}`);
    }
  }

  // Whole tokens to 18-decimal units, exactly as the token stores them
  const amountRaw = parseUnits(String(round.amount), 18).toString();
  const values = registrations.map((r) => [
    getAddress(r.address.toLowerCase()),
    amountRaw,
  ]);

  const tree = StandardMerkleTree.of(values, ["address", "uint256"]);

  const proofs = {};
  for (const [index, [address, amount]] of tree.entries()) {
    const proof = tree.getProof(index);
    if (!tree.verify(index, proof)) {
      throw new Error(`Generated proof failed verification for ${address}`);
    }
    proofs[address.toLowerCase()] = { amount, proof };
  }

  const count = values.length;
  const totalRaw = (BigInt(amountRaw) * BigInt(count)).toString();

  return { root: tree.root, count, amountRaw, totalRaw, proofs };
}
