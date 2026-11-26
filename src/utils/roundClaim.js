// Round airdrops: which live rounds include this wallet, and its proof for each.
// The proofs come from the round-claim Edge Function, so the browser never
// sees the full list of wallets.

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const API = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : "";

export const roundClaimEnabled = Boolean(API);

// Returns [{ id, name, amountPerWallet, airdropAddress, claim: {amount, proof} | null }]
export async function fetchRoundClaims(address) {
  const url = new URL(`${API}/round-claim`);
  url.searchParams.set("address", address);

  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Could not reach the claim service. Please try again.");
  }
  if (!res.ok) throw new Error("Could not load round claims. Please try again.");
  const data = await res.json();
  return data.rounds || [];
}
