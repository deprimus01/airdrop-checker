export const SEPOLIA = {
  chainId: "0xaa36a7", // 11155111 in hex
  chainName: "Sepolia",
  nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"],
};

// Lowercase on purpose: ethers accepts lowercase without a checksum check.
export const TOKEN_ADDRESS = "0xa0f6517d67ae29486c73c70f26e5cb57a4b6f760";
export const AIRDROP_ADDRESS = "0x031290074a4796a979936126b5a3e964011152e8";
