import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import nftMerkle from "../nftMerkle.json";
import { SEPOLIA, NFT_ADDRESS, IPFS_GATEWAY } from "../constants";

const ABI = [
  "function mint(address account, bytes32[] proof)",
  "function hasMinted(address) view returns (bool)",
  "function totalSupply() view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "event Minted(address indexed account, uint256 indexed tokenId)",
  "error AlreadyMinted()",
  "error InvalidProof()",
  "error SoldOut()",
];

// Read-only connection, so supply and status load without a wallet popup
const readProvider = new JsonRpcProvider(SEPOLIA.rpcUrls[0]);
const reader = () => new Contract(NFT_ADDRESS, ABI, readProvider);

// ipfs://CID/file becomes https://gateway/ipfs/CID/file
function ipfsToHttp(uri) {
  return uri.startsWith("ipfs://") ? IPFS_GATEWAY + uri.slice(7) : uri;
}

// The Merkle proof for this wallet, or null if it is not on the NFT allowlist
export function getNftProof(address) {
  return nftMerkle.proofs[address.toLowerCase()] || null;
}

export async function getNftStatus(account) {
  const contract = reader();
  const [supply, max, minted] = await Promise.all([
    contract.totalSupply(),
    contract.maxSupply(),
    contract.hasMinted(account),
  ]);
  return { supply: Number(supply), max: Number(max), minted };
}

// Finds which token ID this wallet owns by checking the owner of each minted
// token. With a small supply that is only a handful of calls, and it avoids
// the block-range limits that public RPCs put on log queries.
export async function findTokenId(account) {
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

// Loads the token's metadata JSON from IPFS: { name, image }
export async function getNftMetadata(tokenId) {
  const uri = await reader().tokenURI(tokenId);
  const res = await fetch(ipfsToHttp(uri));
  if (!res.ok) throw new Error("Could not load the NFT metadata.");
  const json = await res.json();
  return { name: json.name, image: ipfsToHttp(json.image) };
}

export async function mintNft(account) {
  const proof = getNftProof(account);
  if (!proof) throw new Error("This wallet is not on the NFT allowlist.");

  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new Contract(NFT_ADDRESS, ABI, signer);

  // 1. Simulate first so a rejection shows its real reason without spending gas
  await contract.mint.staticCall(account, proof);

  // 2. Estimate gas and add a 30% safety buffer
  const estimate = await contract.mint.estimateGas(account, proof);
  const gasLimit = (estimate * 130n) / 100n;

  // 3. Send, wait for it to be mined, then read the token ID from the event
  const tx = await contract.mint(account, proof, { gasLimit });
  const receipt = await tx.wait();

  let tokenId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "Minted") tokenId = Number(parsed.args.tokenId);
    } catch {
      /* not one of our events */
    }
  }
  return { hash: tx.hash, tokenId };
}
