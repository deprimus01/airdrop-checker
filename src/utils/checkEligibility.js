import allowlist, { normalizeAddress } from "./allowlist";

// Returns { eligible: boolean, amount: number }
export function checkEligibility(address) {
  // Nothing connected yet
  if (!address) {
    return { eligible: false, amount: 0 };
  }

  const key = normalizeAddress(address);

  // Object.hasOwn avoids false matches on built-in object keys
  const eligible = Object.hasOwn(allowlist, key);

  return {
    eligible,
    amount: eligible ? allowlist[key] : 0,
  };
}
