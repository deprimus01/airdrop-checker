import rawAllowlist from "../allowlist.json";

// Wallets return addresses in mixed upper/lower case (checksum format).
// Comparing "0xAbC..." to "0xabc..." fails, so we lowercase everything.
export function normalizeAddress(address) {
  return String(address).trim().toLowerCase();
}

// Build a lookup table with normalized keys, once.
const allowlist = {};
for (const [address, amount] of Object.entries(rawAllowlist)) {
  allowlist[normalizeAddress(address)] = amount;
}

export default allowlist;
