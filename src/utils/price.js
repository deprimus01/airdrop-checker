import { JsonRpcProvider, Contract, formatUnits } from "ethers";
import { SEPOLIA, STATE_VIEW_ADDRESS, POOL_ID } from "../constants";

const ABI = [
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
];

// Read-only connection, so the price shows even before a wallet is connected
const provider = new JsonRpcProvider(SEPOLIA.rpcUrls[0]);

const Q192 = 2n ** 192n;
const ONE = 10n ** 18n;

// Returns { prmPerEth, ethPerPrm } as plain numbers.
// Token order in the pool: currency0 = ETH, currency1 = PRM (both 18 decimals),
// so (sqrtPriceX96 / 2^96)^2 is the number of PRM per 1 ETH.
export async function getPoolPrice() {
  const stateView = new Contract(STATE_VIEW_ADDRESS, ABI, provider);
  const slot0 = await stateView.getSlot0(POOL_ID);
  const sqrtPriceX96 = slot0[0];

  if (sqrtPriceX96 === 0n) {
    throw new Error("Pool not found. Check POOL_ID in constants.js.");
  }

  // PRM per ETH, scaled by 1e18
  const prmPerEthScaled = (sqrtPriceX96 * sqrtPriceX96 * ONE) / Q192;
  // ETH per PRM, scaled by 1e18
  const ethPerPrmScaled = (ONE * ONE) / prmPerEthScaled;

  return {
    prmPerEth: Number(formatUnits(prmPerEthScaled, 18)),
    ethPerPrm: Number(formatUnits(ethPerPrmScaled, 18)),
  };
}
