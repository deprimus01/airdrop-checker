import { useState } from "react";
import { getAddress } from "ethers";
import { Coins, CheckCircle2 } from "lucide-react";
import { TOKEN_ADDRESS, TOKEN_LOGO_URL } from "../constants";

// Asks the wallet to add PRM to its token list (wallet_watchAsset).
// Shown only when a wallet is connected on Sepolia, because the wallet adds the
// token to whichever network is active.
export default function AddTokenButton() {
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    setError("");
    try {
      const ok = await window.ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: getAddress(TOKEN_ADDRESS),
            symbol: "PRM",
            decimals: 18,
            image: TOKEN_LOGO_URL,
          },
        },
      });
      // false means the request was dismissed
      setAdded(Boolean(ok));
    } catch (err) {
      if (err.code === 4001) {
        setError("You dismissed the request.");
      } else {
        setError(err.shortMessage || err.message);
      }
    }
  }

  return (
    <>
      <button className="btn secondary" onClick={handleAdd}>
        <Coins size={16} />
        Add PRM to MetaMask
      </button>
      {added && (
        <div className="net ok reg-state">
          <CheckCircle2 size={16} />
          PRM added to your wallet
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </>
  );
}
