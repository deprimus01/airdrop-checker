import { useState, useEffect } from "react";
import {
  History,
  Gift,
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  BadgeCheck,
  ExternalLink,
} from "lucide-react";
import { SEPOLIA } from "../constants";
import { historyEnabled, fetchWalletHistory } from "../utils/chainHistory";
import { formatAmount, timeAgo } from "../utils/format";

// How each kind of activity is shown: icon and sentence
function describe(item) {
  const prm = item.amount !== undefined ? `${formatAmount(item.amount)} PRM` : "";
  const nft = `Genesis NFT #${item.tokenId}`;
  const badge = `claimer badge #${item.tokenId}`;

  switch (item.kind) {
    case "airdrop":
      return { icon: Gift, text: `Airdrop claim: ${prm}` };
    case "swap_buy":
      return { icon: ArrowLeftRight, text: `Bought ${prm}` };
    case "swap_sell":
      return { icon: ArrowLeftRight, text: `Sold ${prm}` };
    case "received":
      return { icon: ArrowDownLeft, text: `Received ${prm}` };
    case "sent":
      return { icon: ArrowUpRight, text: `Sent ${prm}` };
    case "nft_mint":
      return { icon: Sparkles, text: `Minted ${nft}` };
    case "badge_mint":
      return { icon: BadgeCheck, text: `Minted ${badge}` };
    case "nft_in":
      return { icon: ArrowDownLeft, text: `Received ${nft}` };
    case "nft_out":
      return { icon: ArrowUpRight, text: `Sent ${nft}` };
    case "badge_in":
      return { icon: ArrowDownLeft, text: `Received ${badge}` };
    case "badge_out":
      return { icon: ArrowUpRight, text: `Sent ${badge}` };
    default:
      return { icon: History, text: "Activity" };
  }
}

// Recent PRM, NFT and badge activity of the connected wallet. It is read from
// the history service, so the card stays hidden if that is not set up.
export default function HistoryCard({ account }) {
  const [result, setResult] = useState(null); // { account, items } or { account, failed }

  useEffect(() => {
    if (!historyEnabled || !account) return;
    let cancelled = false;
    fetchWalletHistory(account)
      .then((items) => !cancelled && setResult({ account, items }))
      .catch(() => !cancelled && setResult({ account, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [account]);

  if (!historyEnabled || !account) return null;

  // A result for a previous wallet counts as not loaded yet
  const ready = result && result.account === account;

  return (
    <div className="card reg-card">
      <div className="row">
        <span className="label nft-title">
          <History size={16} />
          Recent activity
        </span>
      </div>

      {!ready && <p className="nft-note">Loading activity…</p>}
      {ready && result.failed && (
        <p className="nft-note">Activity is unavailable right now.</p>
      )}
      {ready && result.items && result.items.length === 0 && (
        <p className="nft-note">No PRM, NFT or badge activity yet.</p>
      )}

      {ready && result.items && result.items.length > 0 && (
        <div className="activity-list">
          {result.items.slice(0, 10).map((item) => {
            const { icon: Icon, text } = describe(item);
            return (
              <div className="activity-item" key={`${item.hash}-${item.kind}-${item.tokenId ?? ""}`}>
                <Icon size={16} />
                <div className="activity-text">
                  {text}
                  <div className="activity-time">{timeAgo(item.t)}</div>
                </div>
                <a
                  className="tx-link"
                  href={`${SEPOLIA.blockExplorerUrls[0]}/tx/${item.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="View transaction"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
