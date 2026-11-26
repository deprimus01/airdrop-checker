import { createClient } from "npm:@supabase/supabase-js@2";
import type { Db, RegisterResult, RoundRow } from "./registration.ts";
import type { ClaimDb, LiveRound, ProofRow } from "./roundClaim.ts";

// Supabase exposes the secret key to Edge Functions under one of two names,
// depending on how the project's API keys are set up.
function getSecretKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const keys = JSON.parse(raw) as Record<string, string>;
      const key = keys.default ?? Object.values(keys)[0];
      if (key) return key;
    } catch {
      /* fall through to the error below */
    }
  }
  throw new Error("No Supabase secret key found in the function environment");
}

// A Db backed by the real project, using the secret key (never sent to browsers).
export function createDb(): Db {
  const client = createClient(Deno.env.get("SUPABASE_URL")!, getSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async registerWallet({ roundId, address, signature, message }) {
      const { data, error } = await client.rpc("register_wallet", {
        p_round_id: roundId,
        p_address: address,
        p_signature: signature,
        p_message: message,
      });
      if (error) throw error;
      return data as RegisterResult;
    },

    // The newest round that is not a draft
    async getActiveRound() {
      const { data, error } = await client
        .from("rounds")
        .select("id, name, opens_at, closes_at, amount, max_registrations, status")
        .neq("status", "draft")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as RoundRow | null;
    },

    async countRegistrations(roundId) {
      const { count, error } = await client
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("round_id", roundId);
      if (error) throw error;
      return count ?? 0;
    },

    async isRegistered(roundId, address) {
      const { data, error } = await client
        .from("registrations")
        .select("id")
        .eq("round_id", roundId)
        .eq("address", address)
        .maybeSingle();
      if (error) throw error;
      return data !== null;
    },
  };
}

// A ClaimDb backed by the real project. Only rounds the owner has marked live
// (airdrop contract deployed and funded) are ever returned.
export function createClaimDb(): ClaimDb {
  const client = createClient(Deno.env.get("SUPABASE_URL")!, getSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async getLiveRounds() {
      const { data, error } = await client
        .from("rounds")
        .select("id, name, amount, airdrop_address")
        .eq("status", "live")
        .not("airdrop_address", "is", null)
        .order("id", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LiveRound[];
    },

    async getProof(roundId, address) {
      const { data, error } = await client
        .from("round_proofs")
        .select("amount, proof")
        .eq("round_id", roundId)
        .eq("address", address)
        .maybeSingle();
      if (error) throw error;
      return data as ProofRow | null;
    },
  };
}
