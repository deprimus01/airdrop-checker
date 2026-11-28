import { JsonRpcProvider, Contract } from "ethers";
import { SEPOLIA, STATE_VIEW_ADDRESS, POOL_ID } from "../constants";

const ABI = [
  "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
  "function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)",
];

// Read-only connection, so the stats show before a wallet is connected
const provider = new JsonRpcProvider(SEPOLIA.rpcUrls[0]);

// Current state of the PRM/ETH pool, read from StateView:
// { tick, feePercent, liquidity }  (liquidity is the active liquidity "L", unitless)
export async function getPoolState() {
  const stateView = new Contract(STATE_VIEW_ADDRESS, ABI, provider);
  const [slot0, liquidity] = await Promise.all([
    stateView.getSlot0(POOL_ID),
    stateView.getLiquidity(POOL_ID),
  ]);

  if (slot0[0] === 0n) {
    throw new Error("Pool not found. Check POOL_ID in constants.js.");
  }

  return {
    tick: Number(slot0[1]),
    // lpFee is in hundredths of a basis point: 2500 means 0.25%
    feePercent: Number(slot0[3]) / 10000,
    liquidity: liquidity.toString(),
  };
}
