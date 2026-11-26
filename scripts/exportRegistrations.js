// Round close export.
//
//   npm run round:export -- --round 1               dry run: builds the tree, writes a local file
//   npm run round:export -- --round 1 --write       also stores the proofs in round_proofs
//   add --allow-open to run before the round has closed (testing only)
//
// Needs SUPABASE_URL and SUPABASE_SECRET_KEY in a local .env.admin file
// (never committed, see .env.example). The secret key is used only here, on
// your machine. This script never changes the rounds row: after deploying the
// airdrop contract you edit merkle_root, airdrop_address and status by hand.

import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { formatUnits } from "ethers";
import { buildRoundTree } from "./lib/roundTree.js";

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const roundIndex = args.indexOf("--round");
const roundId = roundIndex >= 0 ? Number(args[roundIndex + 1]) : NaN;
const write = args.includes("--write");
const allowOpen = args.includes("--allow-open");

if (!Number.isInteger(roundId) || roundId < 1) {
  fail("pass the round id, for example: --round 1");
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  fail("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.admin");
}

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: round, error: roundError } = await client
  .from("rounds")
  .select(
    "id, name, opens_at, closes_at, amount, max_registrations, status, merkle_root, airdrop_address",
  )
  .eq("id", roundId)
  .maybeSingle();
if (roundError) fail(`could not read the round: ${roundError.message}`);
if (!round) fail(`round ${roundId} does not exist`);

console.log(`Round ${round.id}: ${round.name} (status ${round.status})`);
console.log(`Amount per wallet: ${round.amount} PRM`);

if (round.status === "draft") fail("the round is still a draft");
if (round.status === "live") {
  fail("the round is already live; refusing to rebuild its tree");
}
if (
  round.status === "open" &&
  Date.now() < Date.parse(round.closes_at) &&
  !allowOpen
) {
  fail(
    `the round closes at ${round.closes_at}. Wait for it to close, or add --allow-open for a test run`,
  );
}

// Read every registration (the API returns at most 1000 rows per request)
const registrations = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await client
    .from("registrations")
    .select("address, signature, message")
    .eq("round_id", roundId)
    .order("id", { ascending: true })
    .range(from, from + 999);
  if (error) fail(`could not read registrations: ${error.message}`);
  registrations.push(...data);
  if (data.length < 1000) break;
}
console.log(`Registrations read: ${registrations.length}`);

let result;
try {
  result = buildRoundTree({ round, registrations });
} catch (err) {
  fail(err.message);
}

const totalPrm = formatUnits(result.totalRaw, 18);
fs.mkdirSync("round-exports", { recursive: true });
const file = `round-exports/round-${roundId}.json`;
fs.writeFileSync(
  file,
  JSON.stringify(
    {
      roundId,
      generatedAt: new Date().toISOString(),
      root: result.root,
      count: result.count,
      amountPerWallet: result.amountRaw,
      total: result.totalRaw,
      proofs: result.proofs,
    },
    null,
    2,
  ),
);

console.log("");
console.log(`Merkle root:        ${result.root}`);
console.log(`Wallets in tree:    ${result.count}`);
console.log(`Fund the contract:  ${totalPrm} PRM`);
console.log(`Written to:         ${file}`);

if (!write) {
  console.log("");
  console.log("Dry run only. Nothing was stored in the database.");
  console.log("Add --write to store the proofs in round_proofs.");
  process.exit(0);
}

// Replace any earlier export of this round, then insert in batches
const { error: deleteError } = await client
  .from("round_proofs")
  .delete()
  .eq("round_id", roundId);
if (deleteError) fail(`could not clear old proofs: ${deleteError.message}`);

const rows = Object.entries(result.proofs).map(([address, p]) => ({
  round_id: roundId,
  address,
  amount: p.amount,
  proof: p.proof,
}));
for (let i = 0; i < rows.length; i += 100) {
  const { error } = await client
    .from("round_proofs")
    .insert(rows.slice(i, i + 100));
  if (error) fail(`could not store proofs: ${error.message}`);
}
console.log(`Stored ${rows.length} proofs in round_proofs.`);
