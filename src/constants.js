export const SEPOLIA = {
  chainId: "0xaa36a7", // 11155111 in hex
  chainName: "Sepolia",
  nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};

// Lowercase on purpose: ethers accepts lowercase without a checksum check.

// PRM token and Merkle airdrop
export const TOKEN_ADDRESS = "0xa0f6517d67ae29486c73c70f26f5cb57a4b6f760";
export const AIRDROP_ADDRESS = "0x2036ed85651486bb53ca2f4ed1747ed6230ddf1b";

// Uniswap v4 PRM/ETH pool (read through StateView)
export const STATE_VIEW_ADDRESS = "0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c";
export const POOL_ID =
  "0xc2b2ec193b0294cfd3c05eea38956a5f350b55e59a245128051e8bc7e3a6e674";

// NFTs: allowlist mint and soulbound claim badge
export const NFT_ADDRESS = "0x6d48c2b7479dc5574529471f39d4fb0bf27f45b6";
export const BADGE_ADDRESS = "0x867816bc5107463f16e92073de5d418daa8087b0";

// Gateway used to show IPFS images in the app
export const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";
