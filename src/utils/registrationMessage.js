// The text a wallet signs to register. The server rebuilds this exact text in
// supabase/functions/_shared/registration.ts and a test checks the two match,
// so change both together.
export function buildMessage({ address, roundId, issuedAt }) {
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
