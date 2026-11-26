import { isAddress } from "npm:ethers@6";
import { corsHeaders } from "./cors.ts";

// ---------------------------------------------------------------------------
// GET /round-claim?address=0x...
//
// Lists the rounds whose airdrop contract is live and returns this wallet's own
// Merkle proof for each one (or null if the wallet is not in that round). The
// full list of wallets is never returned. Proofs are not secret: the claim
// contract only pays the wallet the leaf was built for.
// ---------------------------------------------------------------------------

export interface LiveRound {
  id: number;
  name: string;
  amount: number | string; // whole PRM per wallet
  airdrop_address: string;
}

export interface ProofRow {
  amount: string; // raw units (18 decimals)
  proof: string[];
}

// Everything the handler needs from the database, so tests can swap in a fake.
export interface ClaimDb {
  getLiveRounds(): Promise<LiveRound[]>;
  getProof(roundId: number, address: string): Promise<ProofRow | null>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleRoundClaim(req: Request, db: ClaimDb): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET") {
    return json({ error: "invalid_request", message: "The request was not valid." }, 400);
  }

  const address = new URL(req.url).searchParams.get("address");
  if (!address || !isAddress(address)) {
    return json({ error: "invalid_request", message: "The request was not valid." }, 400);
  }

  try {
    const rounds = await db.getLiveRounds();
    const out = [];
    for (const round of rounds) {
      const entry = await db.getProof(round.id, address.toLowerCase());
      out.push({
        id: round.id,
        name: round.name,
        amountPerWallet: Number(round.amount),
        airdropAddress: round.airdrop_address,
        claim: entry ? { amount: entry.amount, proof: entry.proof } : null,
      });
    }
    return json({ rounds: out });
  } catch (err) {
    console.error("round-claim failed:", err);
    return json({ error: "server_error", message: "Something went wrong. Please try again." }, 500);
  }
}
