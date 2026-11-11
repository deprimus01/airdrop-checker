import { Gift, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";

export default function ClaimSection({
  amount,
  claimed,
  claiming,
  txHash,
  onClaim,
}) {
  if (claimed) {
    return (
      <div className="card claim-done">
        <CheckCircle2 size={24} />
        <div>
          <strong>Tokens claimed</strong>
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
        </div>
      </div>
    );
  }

  return (
    <div className="claim-wrap">
      <button className="btn" onClick={onClaim} disabled={claiming}>
        {claiming ? (
          <>
            <Loader2 size={18} className="spin-icon" />
            Claiming…
          </>
        ) : (
          <>
            <Gift size={18} />
            Claim {amount} PRM
          </>
        )}
      </button>
    </div>
  );
}
