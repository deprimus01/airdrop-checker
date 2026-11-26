import { handleRoundClaim } from "../_shared/roundClaim.ts";
import { createClaimDb } from "../_shared/supabase.ts";

Deno.serve((req) => handleRoundClaim(req, createClaimDb()));
