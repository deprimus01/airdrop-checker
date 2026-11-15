import { useState, useEffect, useCallback } from "react";
import { TrendingUp, RefreshCw } from "lucide-react";
import { getPoolPrice } from "../utils/price";

function format(value) {
  return value.toLocaleString(undefined, { maximumSignificantDigits: 5 });
}

export default function PriceCard() {
  const [price, setPrice] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPrice(await getPoolPrice());
      setError("");
    } catch (err) {
      setError(err.shortMessage || err.message);
    }
    setLoading(false);
  }, []);

  // Load once, then refresh every 20 seconds
  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="card price-card">
      <div className="row">
        <span className="label price-title">
          <TrendingUp size={16} />
          PRM price (Uniswap v4, Sepolia)
        </span>
        <button className="icon-btn" onClick={load} aria-label="Refresh price">
          <RefreshCw size={16} className={loading ? "spin-icon" : ""} />
        </button>
      </div>

      {price && (
        <>
          <div className="price-main">
            1 PRM = {format(price.ethPerPrm)} ETH
          </div>
          <div className="price-sub">1 ETH = {format(price.prmPerEth)} PRM</div>
        </>
      )}

      {!price && loading && <div className="price-sub">Loading price…</div>}
      {error && <div className="price-error">{error}</div>}
    </div>
  );
}
