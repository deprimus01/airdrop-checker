import { BrowserProvider, Contract } from "ethers";
import merkle from "../merkle.json";
import { AIRDROP_ADDRESS } from "../constants";

// Only the parts of the contract the frontend needs
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

async function getContract(withSigner) {
  const provider = new BrowserProvider(window.ethereum);
  const runner = withSigner ? await provider.getSigner() : provider;
  return new Contract(AIRDROP_ADDRESS, ABI, runner);
}

export async function hasClaimed(address) {
  const contract = await getContract(false);
  return contract.hasClaimed(address);
}

export async function claimTokens(address) {
  const data = getClaimData(address);
  if (!data) throw new Error("No claim data found for this wallet.");

  const contract = await getContract(true);

  // 1. Simulate first so a rejection shows its real reason without spending gas
  await contract.claim.staticCall(address, data.amount, data.proof);

  // 2. Estimate gas and add a 30% safety buffer
  const estimate = await contract.claim.estimateGas(
    address,
    data.amount,
    data.proof,
  );
  const gasLimit = (estimate * 130n) / 100n;

  // 3. Send and wait for it to be mined
  const tx = await contract.claim(address, data.amount, data.proof, {
    gasLimit,
  });
  await tx.wait();
  return tx.hash;
}
