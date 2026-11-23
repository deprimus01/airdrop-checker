import { handleRegister } from "../_shared/registration.ts";
import { createDb } from "../_shared/supabase.ts";

Deno.serve((req) => handleRegister(req, createDb()));
