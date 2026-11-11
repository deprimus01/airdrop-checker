import { BrowserProvider, Contract } from "ethers";
import merkle from "../merkle.json";
import { AIRDROP_ADDRESS } from "../constants";

// Only the parts of the contract the frontend needs
const ABI = [
  "function claim(uint256 amount, bytes32[] proof)",
  "function hasClaimed(address) view returns (bool)",
  "error AlreadyClaimed()",
  "error InvalidProof()",
];

// Look up this wallet's amount (in raw units) and proof from merkle.json
export function getClaimData(address) {
  return merkle.proofs[address.toLowerCase()] || null;
}

async function getContract(withSigner) {
  const provider = new BrowserProvider(window.ethereum);
  const runner = withSigner ? await provider.getSigner() : provider;
  return new Contract(AIRDROP_ADDRESS, ABI, runner);
}

export async function hasClaimed(address) {
  const contract = await getContract(false);
  return contract.hasClaimed(address);
}

// Sends the claim transaction and waits for it to be mined
export async function claimTokens(address) {
  const data = getClaimData(address);
  if (!data) throw new Error("No claim data found for this wallet.");

  const contract = await getContract(true);
  const tx = await contract.claim(data.amount, data.proof);
  await tx.wait();
  return tx.hash;
}
