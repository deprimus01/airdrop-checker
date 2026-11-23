import { handleInfo } from "../_shared/registration.ts";
import { createDb } from "../_shared/supabase.ts";

Deno.serve((req) => handleInfo(req, createDb()));
