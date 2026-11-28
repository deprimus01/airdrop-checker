import { handleChainHistory } from "../_shared/chainHistory.ts";
import { createHistoryDeps } from "../_shared/supabase.ts";

Deno.serve((req) => handleChainHistory(req, createHistoryDeps()));
