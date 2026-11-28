import { useState, useEffect } from "react";
import { BarChart3, RefreshCw, ExternalLink } from "lucide-react";
import { SEPOLIA } from "../constants";
import { getPoolState } from "../utils/poolStats";
import { historyEnabled, fetchPoolActivity } from "../utils/chainHistory";
import { formatAmount, timeAgo } from "../utils/format";

// A small line chart of the ETH-per-PRM price after each swap
function Sparkline({ points }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.ethPerPrm);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const line = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 300;
      const y = 54 - ((v - min) / range) * 48;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className="spark"
      viewBox="0 0 300 60"
      preserveAspectRatio="none"
      role="img"
      aria-label="PRM price after each swap"
    >
      <polyline points={line} fill="none" stroke="#6be3a0" strokeWidth="2" />
    </svg>
  );
}

function swapText(swap) {
  const prm = `${formatAmount(swap.prm)} PRM`;
  const eth = `${formatAmount(swap.eth)} ETH`;
  if (swap.side === "buy") return `Bought ${prm} for ${eth}`;
  if (swap.side === "sell") return `Sold ${prm} for ${eth}`;
  return `Swapped ${eth} and ${prm}`;
}

// Live stats of the Uniswap v4 PRM/ETH pool. The on-chain numbers load
// straight from the pool; volume, price history and recent swaps come from the
// history service and are left out when it is not set up.
export default function PoolStatsCard() {
  const [state, setState] = useState(null); // pool state, or { failed: true }
  const [activity, setActivity] = useState(null); // swap activity, or { failed: true }
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPoolState()
      .then((s) => !cancelled && setState(s))
      .catch(() => !cancelled && setState({ failed: true }));
    if (historyEnabled) {
      fetchPoolActivity()
        .then((a) => !cancelled && setActivity(a))
        .catch(() => !cancelled && setActivity({ failed: true }));
    }
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  function refresh() {
    setState(null);
    setActivity(null);
    setRefreshKey((k) => k + 1);
  }

  const loading = state === null || (historyEnabled && activity === null);

  return (
    <div className="card reg-card">
      <div className="row">
        <span className="label nft-title">
          <BarChart3 size={16} />
          Pool stats
        </span>
        <button
          className="btn secondary"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh pool stats"
          style={{ width: "auto", padding: "6px 10px" }}
        >
          <RefreshCw size={14} className={loading ? "spin-icon" : ""} />
        </button>
      </div>

      {state === null && <p className="nft-note">Loading pool…</p>}
      {state?.failed && <p className="price-error">Could not load the pool.</p>}

      {state && !state.failed && (
        <div className="reg-rows">
          <div className="row">
            <span className="label">Fee</span>
            <strong>{state.feePercent}%</strong>
          </div>
          <div className="row">
            <span className="label">Active liquidity</span>
            <strong>
              {Number(state.liquidity).toLocaleString(undefined, {
                notation: "compact",
                maximumFractionDigits: 2,
              })}
            </strong>
          </div>
          <div className="row">
            <span className="label">Current tick</span>
            <strong>{state.tick.toLocaleString()}</strong>
          </div>
        </div>
      )}

      {activity?.failed && (
        <p className="nft-note">Swap activity is unavailable right now.</p>
      )}

      {activity && !activity.failed && (
        <>
          <div className="reg-rows">
            <div className="row">
              <span className="label">Volume, 24 h</span>
              <strong>{formatAmount(activity.last24h.volumeEth)} ETH</strong>
            </div>
            <div className="row">
              <span className="label">Volume, all time</span>
              <strong>{formatAmount(activity.volumeEth)} ETH</strong>
            </div>
            <div className="row">
              <span className="label">Swaps, 24 h / all time</span>
              <strong>
                {activity.last24h.swaps} / {activity.swapCount}
              </strong>
            </div>
          </div>

          <Sparkline points={activity.history} />

          {activity.recent.length === 0 && (
            <p className="nft-note">No swaps yet.</p>
          )}
          {activity.recent.length > 0 && (
            <div className="activity-list">
              {activity.recent.slice(0, 5).map((swap) => (
                <div className="activity-item" key={swap.hash}>
                  <div className="activity-text">
                    {swapText(swap)}
                    <div className="activity-time">{timeAgo(swap.t)}</div>
                  </div>
                  <a
                    className="tx-link"
                    href={`${SEPOLIA.blockExplorerUrls[0]}/tx/${swap.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="View transaction"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
