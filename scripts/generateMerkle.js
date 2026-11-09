import fs from "fs";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { parseUnits } from "ethers";

// Load the allowlist (addresses and whole-token amounts)
const allowlist = JSON.parse(fs.readFileSync("./src/allowlist.json", "utf8"));

// Convert amounts to 18-decimal units, exactly as the token stores them
// (e.g. 500 tokens becomes 500000000000000000000)
const values = Object.entries(allowlist).map(([address, amount]) => [
  address,
  parseUnits(String(amount), 18).toString(),
]);

// Build the tree. Each leaf is an (address, uint256) pair.
const tree = StandardMerkleTree.of(values, ["address", "uint256"]);

// Collect one proof per address
const proofs = {};
for (const [index, [address, amount]] of tree.entries()) {
  proofs[address.toLowerCase()] = {
    amount,
    proof: tree.getProof(index),
  };
}

// Save the root and proofs for the frontend
fs.writeFileSync(
  "./src/merkle.json",
  JSON.stringify({ root: tree.root, proofs }, null, 2),
);

console.log("Merkle root:", tree.root);
console.log("Addresses in tree:", values.length);
