// The functions are public endpoints (no login). Writes are protected by the
// wallet signature check, so a wide-open CORS policy is fine here.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
