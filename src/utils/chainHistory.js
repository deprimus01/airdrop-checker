// Pool activity and wallet history. The data comes from the chain-history Edge
// Function, which reads the Etherscan API with a key kept in Supabase, so no
// key is needed (or exposed) in the browser.

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const API = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : "";

export const historyEnabled = Boolean(API);

async function get(params) {
  const url = new URL(`${API}/chain-history`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Could not reach the history service.");
  }
  if (!res.ok) throw new Error("History is unavailable right now.");
  return res.json();
}

// { swapCount, volumeEth, volumePrm, last24h, history, recent }
export async function fetchPoolActivity() {
  const data = await get({ view: "pool" });
  return data.pool;
}

// [{ hash, t, kind, amount?, tokenId?, counterparty }], newest first
export async function fetchWalletHistory(address) {
  const data = await get({ view: "wallet", address });
  return data.items;
}
