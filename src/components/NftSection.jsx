import { useState, useEffect } from "react";
import { Sparkles, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import {
  getNftProof,
  getNftStatus,
  findTokenId,
  getNftMetadata,
  mintNft,
} from "../utils/nft";
import { NFT_ADDRESS } from "../constants";

export default function NftSection({ account }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [status, setStatus] = useState({ supply: 0, max: 0, minted: false });
  const [nft, setNft] = useState(null); // { tokenId, name, image }
  const [minting, setMinting] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  async function showNft(tokenId) {
    try {
      const meta = await getNftMetadata(tokenId);
      setNft({ tokenId, ...meta });
    } catch {
      // Metadata is a nice extra, so a failure here is not fatal
      setNft({ tokenId, name: `Primus Genesis #${tokenId}`, image: "" });
    }
  }

  // Load status whenever the connected wallet changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setNft(null);
    setTxHash("");

    (async () => {
      const isAllowed = Boolean(getNftProof(account));
      try {
        const s = await getNftStatus(account);
        if (cancelled) return;
        setAllowed(isAllowed);
        setStatus(s);

        if (s.minted) {
          const tokenId = await findTokenId(account);
          if (!cancelled && tokenId) await showNft(tokenId);
        }
      } catch {
        if (!cancelled) setError("Could not read the NFT contract.");
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
      const { hash, tokenId } = await mintNft(account);
      setTxHash(hash);
      setStatus((s) => ({ ...s, minted: true, supply: s.supply + 1 }));
      if (tokenId) await showNft(tokenId);
    } catch (err) {
      if (err.code === "ACTION_REJECTED" || err.info?.error?.code === 4001) {
        setError("You rejected the transaction.");
      } else if (err.revert?.name === "AlreadyMinted") {
        setStatus((s) => ({ ...s, minted: true }));
        setError("This wallet has already minted.");
      } else if (err.revert?.name === "InvalidProof") {
        setError(
          "Invalid proof. The NFT allowlist may not match the contract.",
        );
      } else if (err.revert?.name === "SoldOut") {
        setError("The collection is sold out.");
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
          <Sparkles size={16} />
          Primus Genesis NFT
        </span>
        {!loading && (
          <span className="label">
            {status.supply} / {status.max} minted
          </span>
        )}
      </div>

      {loading && <p className="nft-note">Checking the NFT allowlist…</p>}

      {!loading && !allowed && !status.minted && (
        <p className="nft-note">This wallet is not on the NFT allowlist.</p>
      )}

      {!loading && allowed && !status.minted && (
        <button className="btn nft-btn" onClick={handleMint} disabled={minting}>
          {minting ? (
            <>
              <Loader2 size={18} className="spin-icon" />
              Minting…
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Mint your free NFT
            </>
          )}
        </button>
      )}

      {!loading && status.minted && (
        <div className="nft-minted">
          <div className="net ok">
            <CheckCircle2 size={16} />
            NFT minted
          </div>
          {nft && (
            <div className="nft-preview">
              {nft.image && (
                <img className="nft-img" src={nft.image} alt={nft.name} />
              )}
              <strong>{nft.name}</strong>
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
          {!nft && (
            <a
              className="tx-link"
              href={`https://sepolia.etherscan.io/address/${NFT_ADDRESS}`}
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
