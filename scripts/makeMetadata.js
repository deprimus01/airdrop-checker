import fs from "fs";

// Usage: node scripts/makeMetadata.js <IMAGES_CID>
const imagesCid = process.argv[2];
if (!imagesCid) {
  console.error(
    "Usage: node scripts/makeMetadata.js bafybeif5jbcdue5k44rjrji42jel3zqyisbzyogf3hxasduc45jwmosvgi",
  );
  process.exit(1);
}

const IMAGE_EXT = "png";

// One name per samurai image, in order (1, 2, 3...).
// Add or remove names so the count matches your images.
const samurai = ["Ronin", "Kensei", "Shogun", "Ashigaru", "Shinobi", "Daimyo"];

// The filename of the badge image inside your images folder (without extension).
// Use "badge" for option A, or "6" if the badge is saved as 6.png (option B).
const BADGE_FILE = "badge";

fs.mkdirSync("metadata", { recursive: true });

samurai.forEach((className, i) => {
  const n = i + 1;
  const metadata = {
    name: `Primus Genesis: ${className}`,
    description:
      "Allowlist NFT from the Primus dApp, minted on the Sepolia testnet.",
    image: `ipfs://${imagesCid}/${n}.${IMAGE_EXT}`,
    attributes: [
      { trait_type: "Collection", value: "Primus Genesis" },
      { trait_type: "Class", value: className },
    ],
  };
  fs.writeFileSync(`metadata/${n}.json`, JSON.stringify(metadata, null, 2));
});

const badge = {
  name: "Primus Airdrop Claimer",
  description:
    "Soulbound badge for wallets that claimed PRM from the Primus airdrop.",
  image: `ipfs://${imagesCid}/${BADGE_FILE}.${IMAGE_EXT}`,
  attributes: [{ trait_type: "Type", value: "Soulbound badge" }],
};
fs.writeFileSync("metadata/badge.json", JSON.stringify(badge, null, 2));

console.log(
  `Wrote metadata/1.json to ${samurai.length}.json and metadata/badge.json`,
);
