import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import { SEPOLIA, BADGE_ADDRESS, IPFS_GATEWAY } from "../constants";

const ABI = [
  "function mint(address account)",
  "function hasBadge(address) view returns (bool)",
  "function totalSupply() view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "event BadgeMinted(address indexed account, uint256 indexed tokenId)",
  "error AlreadyMinted()",
  "error NotClaimed()",
  "error Soulbound()",
];

// Read-only connection, so status loads without a wallet popup
const readProvider = new JsonRpcProvider(SEPOLIA.rpcUrls[0]);
const reader = () => new Contract(BADGE_ADDRESS, ABI, readProvider);

// ipfs://CID/file becomes https://gateway/ipfs/CID/file
function ipfsToHttp(uri) {
  return uri.startsWith("ipfs://") ? IPFS_GATEWAY + uri.slice(7) : uri;
}

export async function getBadgeStatus(account) {
  const contract = reader();
  const [supply, owned] = await Promise.all([
    contract.totalSupply(),
    contract.hasBadge(account),
  ]);
  return { supply: Number(supply), owned };
}

// Finds which token ID this wallet owns by checking the owner of each minted
// token. With a small supply that is only a handful of calls, and it avoids
// the block-range limits that public RPCs put on log queries.
export async function findBadgeTokenId(account) {
  const contract = reader();
  const supply = Number(await contract.totalSupply());
  const owners = await Promise.all(
    Array.from({ length: supply }, (_, i) =>
      contract.ownerOf(i + 1).catch(() => null),
    ),
  );
  const index = owners.findIndex(
    (owner) => owner && owner.toLowerCase() === account.toLowerCase(),
  );
  return index === -1 ? null : index + 1;
}

// Loads the badge metadata JSON from IPFS: { name, image }
export async function getBadgeMetadata(tokenId) {
  const uri = await reader().tokenURI(tokenId);
  const res = await fetch(ipfsToHttp(uri));
  if (!res.ok) throw new Error("Could not load the badge metadata.");
  const json = await res.json();
  return { name: json.name, image: ipfsToHttp(json.image) };
}

export async function mintBadge(account) {
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new Contract(BADGE_ADDRESS, ABI, signer);

  // 1. Simulate first so a rejection shows its real reason without spending gas
  await contract.mint.staticCall(account);

  // 2. Estimate gas and add a 30% safety buffer
  const estimate = await contract.mint.estimateGas(account);
  const gasLimit = (estimate * 130n) / 100n;

  // 3. Send, wait for it to be mined, then read the token ID from the event
  const tx = await contract.mint(account, { gasLimit });
  const receipt = await tx.wait();

  let tokenId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "BadgeMinted") tokenId = Number(parsed.args.tokenId);
    } catch {
      /* not one of our events */
    }
  }
  return { hash: tx.hash, tokenId };
}
