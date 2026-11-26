import { BrowserProvider, Contract } from "ethers";
import merkle from "../merkle.json";
import { AIRDROP_ADDRESS } from "../constants";

// Only the parts of the contract the frontend needs. Every MerkleAirdrop
// deployment (the launch airdrop and each round's airdrop) has the same ABI.
const ABI = [
  "function claim(address account, uint256 amount, bytes32[] proof)",
  "function hasClaimed(address) view returns (bool)",
  "error AlreadyClaimed()",
  "error InvalidProof()",
];

// Look up this wallet's amount (in raw units) and proof from merkle.json
export function getClaimData(address) {
  return merkle.proofs[address.toLowerCase()] || null;
}

async function getContract(contractAddress, withSigner) {
  const provider = new BrowserProvider(window.ethereum);
  const runner = withSigner ? await provider.getSigner() : provider;
  return new Contract(contractAddress, ABI, runner);
}

// Has `address` already claimed from the airdrop contract at `contractAddress`?
export async function hasClaimedAt(contractAddress, address) {
  const contract = await getContract(contractAddress, false);
  return contract.hasClaimed(address);
}

// Claims from any airdrop contract with a given amount (raw units) and proof
export async function claimWithProof(contractAddress, address, amount, proof) {
  const contract = await getContract(contractAddress, true);

  // 1. Simulate first so a rejection shows its real reason without spending gas
  await contract.claim.staticCall(address, amount, proof);

  // 2. Estimate gas and add a 30% safety buffer
  const estimate = await contract.claim.estimateGas(address, amount, proof);
  const gasLimit = (estimate * 130n) / 100n;

  // 3. Send and wait for it to be mined
  const tx = await contract.claim(address, amount, proof, { gasLimit });
  await tx.wait();
  return tx.hash;
}

// The launch airdrop (the original contract and merkle.json)
export async function hasClaimed(address) {
  return hasClaimedAt(AIRDROP_ADDRESS, address);
}

export async function claimTokens(address) {
  const data = getClaimData(address);
  if (!data) throw new Error("No claim data found for this wallet.");
  return claimWithProof(AIRDROP_ADDRESS, address, data.amount, data.proof);
}
