import { isAddress, verifyMessage } from "npm:ethers@6";
import { corsHeaders } from "./cors.ts";

// ---------------------------------------------------------------------------
// The message a wallet signs. The browser (src/utils/registration.js) builds the
// exact same text. The server rebuilds it from the request fields instead of
// trusting a message string sent by the client.
// ---------------------------------------------------------------------------

export const MAX_AGE_MS = 10 * 60 * 1000; // a signature is valid for 10 minutes
export const MAX_FUTURE_MS = 2 * 60 * 1000; // allow a little clock drift

export function buildMessage(
  { address, roundId, issuedAt }: { address: string; roundId: number; issuedAt: string },
): string {
  return [
    "Primus dApp airdrop registration",
    "",
    "I am registering this wallet for the airdrop.",
    "",
    `Wallet: ${address.toLowerCase()}`,
    `Round: ${roundId}`,
    "Chain: Sepolia (11155111)",
    `Issued at: ${issuedAt}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ErrorCode =
  | "invalid_request"
  | "invalid_signature"
  | "expired_signature"
  | "round_not_found"
  | "not_open_yet"
  | "closed"
  | "round_full"
  | "already_registered"
  | "server_error";

export type RegisterResult = "ok" | ErrorCode;

export interface RegisterBody {
  address: string;
  roundId: number;
  issuedAt: string;
  signature: string;
}

export interface RoundRow {
  id: number;
  name: string;
  opens_at: string;
  closes_at: string;
  amount: number | string;
  max_registrations: number | null;
  status: string;
}

// Everything the handlers need from the database, so tests can swap in a fake.
export interface Db {
  registerWallet(args: {
    roundId: number;
    address: string;
    signature: string;
    message: string;
  }): Promise<RegisterResult>;
  getActiveRound(): Promise<RoundRow | null>;
  countRegistrations(roundId: number): Promise<number>;
  isRegistered(roundId: number, address: string): Promise<boolean>;
}

const STATUS: Record<ErrorCode, number> = {
  invalid_request: 400,
  expired_signature: 400,
  invalid_signature: 401,
  round_not_found: 404,
  not_open_yet: 403,
  closed: 403,
  round_full: 409,
  already_registered: 409,
  server_error: 500,
};

const MESSAGES: Record<ErrorCode, string> = {
  invalid_request: "The request was not valid.",
  expired_signature: "The signature has expired. Please try again.",
  invalid_signature: "The signature does not match this wallet.",
  round_not_found: "There is no open registration round.",
  not_open_yet: "Registration has not opened yet.",
  closed: "Registration is closed.",
  round_full: "This round is full.",
  already_registered: "This wallet is already registered.",
  server_error: "Something went wrong. Please try again.",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(code: ErrorCode): Response {
  return json({ error: code, message: MESSAGES[code] }, STATUS[code]);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateBody(raw: unknown): RegisterBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { address, roundId, issuedAt, signature } = raw as Record<string, unknown>;

  if (typeof address !== "string" || !isAddress(address)) return null;
  if (typeof roundId !== "number" || !Number.isSafeInteger(roundId) || roundId < 1) return null;
  if (typeof issuedAt !== "string") return null;
  // A 65-byte signature: 0x plus 130 hex characters
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(signature)) return null;

  return { address, roundId, issuedAt, signature };
}

// Checks the timestamp and that the signature was made by `address`.
export function checkSignature(body: RegisterBody, nowMs: number): ErrorCode | null {
  const issued = Date.parse(body.issuedAt);
  // Only the canonical ISO format is accepted, so the signed text is unambiguous
  if (Number.isNaN(issued) || new Date(issued).toISOString() !== body.issuedAt) {
    return "invalid_request";
  }
  if (nowMs - issued > MAX_AGE_MS || issued - nowMs > MAX_FUTURE_MS) {
    return "expired_signature";
  }

  const message = buildMessage(body);
  let recovered: string;
  try {
    recovered = verifyMessage(message, body.signature);
  } catch {
    return "invalid_signature";
  }
  return recovered.toLowerCase() === body.address.toLowerCase() ? null : "invalid_signature";
}

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------

export async function handleRegister(
  req: Request,
  db: Db,
  now: () => number = Date.now,
): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return fail("invalid_request");

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > 4096) return fail("invalid_request");
    raw = JSON.parse(text);
  } catch {
    return fail("invalid_request");
  }

  const body = validateBody(raw);
  if (!body) return fail("invalid_request");

  const problem = checkSignature(body, now());
  if (problem) return fail(problem);

  try {
    const result = await db.registerWallet({
      roundId: body.roundId,
      address: body.address.toLowerCase(),
      signature: body.signature,
      message: buildMessage(body),
    });
    if (result === "ok") return json({ ok: true });
    return fail(result);
  } catch (err) {
    console.error("register failed:", err);
    return fail("server_error");
  }
}

// ---------------------------------------------------------------------------
// GET /registration-info?address=0x...
// ---------------------------------------------------------------------------

export type Phase = "upcoming" | "open" | "closed" | "full";

export async function handleInfo(
  req: Request,
  db: Db,
  now: () => number = Date.now,
): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET") return fail("invalid_request");

  try {
    const round = await db.getActiveRound();
    if (!round) return json({ round: null });

    const registeredCount = await db.countRegistrations(round.id);

    const param = new URL(req.url).searchParams.get("address");
    const registered = param && isAddress(param)
      ? await db.isRegistered(round.id, param.toLowerCase())
      : false;

    const nowMs = now();
    const full = round.max_registrations !== null && registeredCount >= round.max_registrations;
    let phase: Phase;
    if (round.status !== "open") phase = "closed";
    else if (nowMs < Date.parse(round.opens_at)) phase = "upcoming";
    else if (nowMs > Date.parse(round.closes_at)) phase = "closed";
    else phase = full ? "full" : "open";

    return json({
      round: {
        id: round.id,
        name: round.name,
        opensAt: new Date(round.opens_at).toISOString(),
        closesAt: new Date(round.closes_at).toISOString(),
        amount: Number(round.amount),
        maxRegistrations: round.max_registrations,
        registeredCount,
        phase,
        registered,
      },
    });
  } catch (err) {
    console.error("info failed:", err);
    return fail("server_error");
  }
}
