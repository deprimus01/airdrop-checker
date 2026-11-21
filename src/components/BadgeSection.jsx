import { useState, useEffect } from "react";
import {
  BadgeCheck,
  Lock,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  getBadgeStatus,
  findBadgeTokenId,
  getBadgeMetadata,
  mintBadge,
} from "../utils/badge";
import { BADGE_ADDRESS } from "../constants";

// `claimed` is true once this wallet has claimed PRM from the airdrop contract
export default function BadgeSection({ account, claimed }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ supply: 0, owned: false });
  const [badge, setBadge] = useState(null); // { tokenId, name, image }
  const [minting, setMinting] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  async function showBadge(tokenId) {
    try {
      const meta = await getBadgeMetadata(tokenId);
      setBadge({ tokenId, ...meta });
    } catch {
      // Metadata is a nice extra, so a failure here is not fatal
      setBadge({ tokenId, name: "Primus Airdrop Claimer", image: "" });
    }
  }

  // Load status whenever the connected wallet changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setBadge(null);
    setTxHash("");

    (async () => {
      try {
        const s = await getBadgeStatus(account);
        if (cancelled) return;
        setStatus(s);

        if (s.owned) {
          const tokenId = await findBadgeTokenId(account);
          if (!cancelled && tokenId) await showBadge(tokenId);
        }
      } catch {
        if (!cancelled) setError("Could not read the badge contract.");
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [account]);

  async function handleMint() {
    setError("");
    setMinting(true);
    try {
      const { hash, tokenId } = await mintBadge(account);
      setTxHash(hash);
      setStatus((s) => ({ ...s, owned: true, supply: s.supply + 1 }));
      if (tokenId) await showBadge(tokenId);
    } catch (err) {
      if (err.code === "ACTION_REJECTED" || err.info?.error?.code === 4001) {
        setError("You rejected the transaction.");
      } else if (err.revert?.name === "AlreadyMinted") {
        setStatus((s) => ({ ...s, owned: true }));
        setError("This wallet already has the badge.");
      } else if (err.revert?.name === "NotClaimed") {
        setError("This wallet has not claimed PRM from the airdrop yet.");
      } else {
        setError(err.shortMessage || err.message);
      }
    }
    setMinting(false);
  }

  return (
    <div className="card nft-card">
      <div className="row">
        <span className="label nft-title">
          <BadgeCheck size={16} />
          Airdrop Claimer Badge
        </span>
        {!loading && <span className="label">{status.supply} minted</span>}
      </div>

      {loading && <p className="nft-note">Checking badge status…</p>}

      {!loading && !status.owned && !claimed && (
        <p className="nft-note">
          Only wallets that claimed PRM from the airdrop can mint this badge.
        </p>
      )}

      {!loading && !status.owned && claimed && (
        <button className="btn nft-btn" onClick={handleMint} disabled={minting}>
          {minting ? (
            <>
              <Loader2 size={18} className="spin-icon" />
              Minting…
            </>
          ) : (
            <>
              <BadgeCheck size={18} />
              Mint your free badge
            </>
          )}
        </button>
      )}

      {!loading && status.owned && (
        <div className="nft-minted">
          <div className="net ok">
            <CheckCircle2 size={16} />
            Badge minted
          </div>
          {badge && (
            <div className="nft-preview">
              {badge.image && (
                <img className="nft-img" src={badge.image} alt={badge.name} />
              )}
              <strong>{badge.name}</strong>
              <span className="label soulbound-tag">
                <Lock size={14} />
                Soulbound (cannot be transferred)
              </span>
            </div>
          )}
          {txHash && (
            <a
              className="tx-link"
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={14} />
              View transaction
            </a>
          )}
          {!badge && (
            <a
              className="tx-link"
              href={`https://sepolia.etherscan.io/address/${BADGE_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={14} />
              View the contract
            </a>
          )}
        </div>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}
