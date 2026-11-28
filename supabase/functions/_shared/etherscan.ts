import { CHAIN_ID } from "./chain.ts";

// Thin client for the Etherscan V2 API (one endpoint, chain chosen with
// `chainid`). The API key travels in the request URL, so errors thrown here
// never include the URL.

const BASE = "https://api.etherscan.io/v2/api";

export class EtherscanError extends Error {}

export type EtherscanRecord = Record<string, string | string[]>;
export type EtherscanCall = (params: Record<string, string>) => Promise<EtherscanRecord[]>;

export function createEtherscan(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): EtherscanCall {
  return async (params) => {
    const url = new URL(BASE);
    url.searchParams.set("chainid", String(CHAIN_ID));
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("apikey", apiKey);

    let res: Response;
    try {
      res = await fetchFn(url);
    } catch {
      throw new EtherscanError("Could not reach Etherscan");
    }
    if (!res.ok) throw new EtherscanError(`Etherscan returned HTTP ${res.status}`);

    const body = await res.json();
    if (body.status === "1" && Array.isArray(body.result)) return body.result;
    // "No records found" is an empty result, not a failure
    if (typeof body.message === "string" && body.message.toLowerCase().includes("no records")) {
      return [];
    }
    throw new EtherscanError(
      typeof body.result === "string" ? body.result : String(body.message ?? "Etherscan error"),
    );
  };
}
