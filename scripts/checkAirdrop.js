// Read-only sanity check for a deployed MerkleAirdrop. Run it BEFORE funding.
//
//   npm run round:check -- <airdropAddress> [expectedMerkleRoot]
//
// It confirms the contract is wired to the real PRM token (the token address
// is immutable, so a wrong one cannot be fixed and strands anything you send),
// that the root is the one you meant, and who owns the contract. Public data
// only: no keys are needed.

import { Contract, JsonRpcProvider, getAddress, isAddress } from "ethers";
import { SEPOLIA, TOKEN_ADDRESS } from "../src/constants.js";

const [airdrop, expectedRoot] = process.argv.slice(2);
if (!airdrop || !isAddress(airdrop)) {
  console.error("Usage: npm run round:check -- <airdropAddress> [expectedMerkleRoot]");
  process.exit(1);
}

const provider = new JsonRpcProvider(SEPOLIA.rpcUrls[0]);
const contract = new Contract(
  airdrop,
  [
    "function token() view returns (address)",
    "function merkleRoot() view returns (bytes32)",
    "function owner() view returns (address)",
  ],
  provider,
);

let failed = false;
function report(ok, label, value) {
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${value}`);
}

const token = await contract.token();
const root = await contract.merkleRoot();
const owner = await contract.owner();

report(
  token.toLowerCase() === TOKEN_ADDRESS.toLowerCase(),
  "token() is the PRM address from constants.js",
  token,
);

const code = await provider.getCode(token);
report(code.length > 2, "the token address has contract code", `${(code.length - 2) / 2} bytes`);

let symbol = "(unreadable)";
try {
  symbol = await new Contract(token, ["function symbol() view returns (string)"], provider).symbol();
} catch {
  // reported below
}
report(symbol === "PRM", "token symbol is PRM", symbol);

if (expectedRoot) {
  report(root.toLowerCase() === expectedRoot.toLowerCase(), "merkleRoot() matches the expected root", root);
} else {
  console.log(`INFO  merkleRoot(): ${root} (pass the expected root as a second argument to check it)`);
}
console.log(`INFO  owner(): ${owner}`);

if (failed) {
  console.log("\nDo NOT fund this contract. Redeploy it with the correct values.");
  process.exit(1);
}
console.log(`\nAll checks passed for ${getAddress(airdrop)}. It is safe to fund.`);
