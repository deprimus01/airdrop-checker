import { useState, useEffect } from "react";
import { formatUnits } from "ethers";
import {
  Gift,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { roundClaimEnabled, fetchRoundClaims } from "../utils/roundClaim";
import { hasClaimedAt, claimWithProof } from "../utils/airdrop";

function formatAmount(raw) {
  return Number(formatUnits(raw, 18)).toLocaleString();
}

// Claim cards for the registration rounds whose airdrop is live.
// `account` is the connected wallet. Renders nothing unless this wallet is in
// at least one live round.
export default function RoundClaimCard({ account }) {
  const [rounds, setRounds] = useState([]);
  const [claimedIds, setClaimedIds] = useState({}); // roundId -> true
  const [txHashes, setTxHashes] = useState({}); // roundId -> hash
  const [claimingId, setClaimingId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!roundClaimEnabled || !account) return;
    let cancelled = false;

    async function load() {
      setLoaded(false);
      setError("");
      setTxHashes({});
      try {
        const all = await fetchRoundClaims(account);
        const mine = all.filter((r) => r.claim);
        const claimed = {};
        for (const r of mine) {
          claimed[r.id] = await hasClaimedAt(r.airdropAddress, account);
        }
        if (cancelled) return;
        setRounds(mine);
        setClaimedIds(claimed);
      } catch (err) {
        if (cancelled) return;
        setRounds([]);
        setError(err.shortMessage || err.message);
      }
      if (!cancelled) setLoaded(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [account]);

  async function handleClaim(round) {
    setError("");
    setClaimingId(round.id);
    try {
      const hash = await claimWithProof(
        round.airdropAddress,
        account,
        round.claim.amount,
        round.claim.proof,
      );
      setTxHashes((prev) => ({ ...prev, [round.id]: hash }));
      setClaimedIds((prev) => ({ ...prev, [round.id]: true }));
    } catch (err) {
      if (err.code === "ACTION_REJECTED" || err.info?.error?.code === 4001) {
        setError("You rejected the transaction.");
      } else if (err.revert?.name === "AlreadyClaimed") {
        setClaimedIds((prev) => ({ ...prev, [round.id]: true }));
        setError("This wallet has already claimed this round.");
      } else if (err.revert?.name === "InvalidProof") {
        setError("Invalid proof for this round. Please contact the project owner.");
      } else {
        setError(err.shortMessage || err.message);
      }
    }
    setClaimingId(null);
  }

  if (!roundClaimEnabled || !account) return null;
  if (loaded && rounds.length === 0 && !error) return null;

  return (
    <div className="card reg-card">
      <div className="row">
        <span className="label nft-title">
          <Gift size={16} />
          Round airdrop
        </span>
      </div>

      {!loaded && <p className="nft-note">Checking your round claims…</p>}

      {rounds.map((round) => (
        <div className="reg-rows" key={round.id}>
          <div className="row">
            <span className="label">{round.name}</span>
            <strong>{formatAmount(round.claim.amount)} PRM</strong>
          </div>

          {claimedIds[round.id] ? (
            <div className="net ok reg-state">
              <CheckCircle2 size={16} />
              Claimed
              {txHashes[round.id] && (
                <a
                  className="tx-link"
                  href={`https://sepolia.etherscan.io/tx/${txHashes[round.id]}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={14} />
                  View transaction
                </a>
              )}
            </div>
          ) : (
            <button
              className="btn nft-btn"
              onClick={() => handleClaim(round)}
              disabled={claimingId !== null}
            >
              {claimingId === round.id ? (
                <>
                  <Loader2 size={18} className="spin-icon" />
                  Claiming…
                </>
              ) : (
                <>
                  <Gift size={18} />
                  Claim {formatAmount(round.claim.amount)} PRM
                </>
              )}
            </button>
          )}
        </div>
      ))}

      {error && <div className="error">{error}</div>}
    </div>
  );
}
