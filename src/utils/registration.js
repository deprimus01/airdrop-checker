import { BrowserProvider } from "ethers";
import { buildMessage } from "./registrationMessage";

// Only the project URL is needed. The Edge Functions are public endpoints, and
// the secret key never leaves Supabase.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const API = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : "";

// Registration is optional: without the env var the card simply stays hidden.
export const registrationEnabled = Boolean(API);

const MESSAGES = {
  invalid_request: "The request was not valid.",
  invalid_signature: "The signature does not match this wallet.",
  expired_signature: "The signature expired. Please try again.",
  round_not_found: "There is no open registration round.",
  not_open_yet: "Registration has not opened yet.",
  closed: "Registration is closed.",
  round_full: "This round is full.",
  already_registered: "This wallet is already registered.",
  wrong_account:
    "Your wallet switched accounts. Select the connected account in MetaMask and try again.",
  rejected: "You rejected the signature request.",
  network: "Could not reach the registration service. Please try again.",
  server_error: "Something went wrong. Please try again.",
};

export class RegistrationError extends Error {
  constructor(code) {
    super(MESSAGES[code] || MESSAGES.server_error);
    this.code = code;
  }
}

// Current round, how many wallets registered, and whether `address` is one of them
export async function fetchRegistrationInfo(address) {
  const url = new URL(`${API}/registration-info`);
  if (address) url.searchParams.set("address", address);

  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new RegistrationError("network");
  }
  if (!res.ok) throw new RegistrationError("server_error");
  const data = await res.json();
  return data.round;
}

// Asks the wallet to sign the registration message (no gas), then submits it
export async function registerWallet(address, roundId) {
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  // The signature must come from the account the app is showing
  if ((await signer.getAddress()).toLowerCase() !== address.toLowerCase()) {
    throw new RegistrationError("wrong_account");
  }

  const issuedAt = new Date().toISOString();
  let signature;
  try {
    signature = await signer.signMessage(buildMessage({ address, roundId, issuedAt }));
  } catch (err) {
    if (err.code === "ACTION_REJECTED" || err.info?.error?.code === 4001) {
      throw new RegistrationError("rejected");
    }
    throw err;
  }

  let res;
  try {
    res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, roundId, issuedAt, signature }),
    });
  } catch {
    throw new RegistrationError("network");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new RegistrationError(data.error || "server_error");
}
