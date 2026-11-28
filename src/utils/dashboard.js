import { Contract, JsonRpcProvider, formatEther, formatUnits } from "ethers";
import { SEPOLIA, TOKEN_ADDRESS } from "../constants";
import { checkEligibility } from "./checkEligibility";
import { hasClaimed, hasClaimedAt } from "./airdrop";
import { getNftStatus, findTokenId } from "./nft";
import { getBadgeStatus } from "./badge";
import { registrationEnabled, fetchRegistrationInfo } from "./registration";
import { roundClaimEnabled, fetchRoundClaims } from "./roundClaim";

// Read-only connection, so balances load without a wallet popup
const readProvider = new JsonRpcProvider(SEPOLIA.rpcUrls[0]);

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

// Runs one lookup. A failure gives null for that row only, so one slow or
// failing source never blanks the whole dashboard.
async function attempt(fn) {
  try {
    return await fn();
  } catch {
    return null;
  }
}

// Everything the dashboard shows for one wallet. Each field is null when it
// could not be loaded (or does not apply, such as registration when it is off).
export async function getDashboard(account) {
  const token = new Contract(TOKEN_ADDRESS, ERC20_ABI, readProvider);

  const [prm, eth, launch, nft, badge, registration, rounds] = await Promise.all([
    attempt(async () => formatUnits(await token.balanceOf(account), 18)),
    attempt(async () => formatEther(await readProvider.getBalance(account))),
    attempt(async () => {
      const { eligible, amount } = checkEligibility(account);
      return {
        eligible,
        amount,
        claimed: eligible ? await hasClaimed(account) : false,
      };
    }),
    attempt(async () => {
      const { minted } = await getNftStatus(account);
      return { minted, tokenId: minted ? await findTokenId(account) : null };
    }),
    attempt(async () => ({ owned: (await getBadgeStatus(account)).owned })),
    attempt(async () => {
      if (!registrationEnabled) return null;
      const round = await fetchRegistrationInfo(account);
      return round
        ? { name: round.name, phase: round.phase, registered: round.registered }
        : null;
    }),
    attempt(async () => {
      if (!roundClaimEnabled) return null;
      const all = await fetchRoundClaims(account);
      const mine = all.filter((r) => r.claim);
      return Promise.all(
        mine.map(async (r) => ({
          name: r.name,
          amount: r.claim.amount,
          claimed: await hasClaimedAt(r.airdropAddress, account),
        })),
      );
    }),
  ]);

  return { account, prm, eth, launch, nft, badge, registration, rounds };
}
