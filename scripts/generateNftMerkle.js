import fs from "fs";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { getAddress, isAddress } from "ethers";

// Who can mint the NFT:
// - If src/nftAllowlist.json exists, it is used (a plain list of addresses).
// - Otherwise the NFT allowlist is the same wallets as the airdrop allowlist.
let list;
if (fs.existsSync("./src/nftAllowlist.json")) {
  list = JSON.parse(fs.readFileSync("./src/nftAllowlist.json", "utf8"));
  console.log("Using src/nftAllowlist.json");
} else {
  list = Object.keys(
    JSON.parse(fs.readFileSync("./src/allowlist.json", "utf8")),
  );
  console.log("Using the addresses in src/allowlist.json");
}

const seen = new Set();
const values = [];

for (const address of list) {
  if (!isAddress(address)) {
    throw new Error(`Invalid address: ${address}`);
  }
  const key = address.toLowerCase();
  if (seen.has(key)) {
    console.warn(`Skipping duplicate: ${address}`);
    continue;
  }
  seen.add(key);
  // Checksummed address, wrapped in an array because each leaf is a list of values
  values.push([getAddress(address)]);
}

if (values.length === 0) {
  throw new Error("No addresses found for the NFT allowlist.");
}

// Each leaf is a single address, matching keccak256(abi.encode(account)) in PrimusNFT
const tree = StandardMerkleTree.of(values, ["address"]);

// One proof per address, keyed by lowercase address
const proofs = {};
for (const [index, [address]] of tree.entries()) {
  proofs[address.toLowerCase()] = tree.getProof(index);
}

fs.writeFileSync(
  "./src/nftMerkle.json",
  JSON.stringify({ root: tree.root, proofs }, null, 2),
);

console.log("NFT Merkle root:", tree.root);
console.log("Addresses in tree:", values.length);
