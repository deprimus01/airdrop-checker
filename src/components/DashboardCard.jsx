import { useState, useEffect } from "react";
import { formatUnits } from "ethers";
import {
  LayoutDashboard,
  RefreshCw,
  Coins,
  Fuel,
  Gift,
  ClipboardList,
  Sparkles,
  BadgeCheck,
  Loader2,
} from "lucide-react";
import { getDashboard } from "../utils/dashboard";

function amount(value, maxDigits) {
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: maxDigits,
  });
}

function launchText(launch) {
  if (!launch.eligible) return "Not on the list";
  if (launch.claimed) return `${launch.amount.toLocaleString()} PRM claimed`;
  return `${launch.amount.toLocaleString()} PRM ready to claim`;
}

function registrationText(reg) {
  if (reg.registered) return `Registered for ${reg.name}`;
  if (reg.phase === "open") return `${reg.name} is open`;
  if (reg.phase === "upcoming") return `${reg.name} opens soon`;
  if (reg.phase === "full") return `${reg.name} is full`;
  return `${reg.name} is closed`;
}

function roundsText(rounds) {
  if (rounds.length === 0) return "None yet";
  return rounds
    .map((r) => {
      const prm = amount(formatUnits(r.amount, 18), 0);
      return r.claimed ? `${prm} PRM claimed` : `${prm} PRM ready to claim`;
    })
    .join(", ");
}

// One row: icon, label, and either the value or a dash while it is missing
function Row({ icon, label, value }) {
  return (
    <div className="row">
      <span className="label nft-title">
        {icon}
        {label}
      </span>
      <strong>{value ?? "Unavailable"}</strong>
    </div>
  );
}

// An at-a-glance summary of the connected wallet. It reads the same sources as
// the cards below it, so it adds no new contracts.
export default function DashboardCard({ account }) {
  const [data, setData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getDashboard(account).then((result) => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [account, refreshKey]);

  // Data from a previous wallet counts as not loaded yet
  const ready = data && data.account === account;

  function refresh() {
    setData(null);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="card reg-card">
      <div className="row">
        <span className="label nft-title">
          <LayoutDashboard size={16} />
          Your dashboard
        </span>
        <button
          className="btn secondary"
          onClick={refresh}
          disabled={!ready}
          aria-label="Refresh dashboard"
          style={{ width: "auto", padding: "6px 10px" }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {!ready && (
        <p className="nft-note">
          <Loader2 size={14} className="spin-icon" /> Loading your wallet…
        </p>
      )}

      {ready && (
        <div className="reg-rows">
          <Row
            icon={<Coins size={14} />}
            label="PRM balance"
            value={data.prm !== null ? `${amount(data.prm, 2)} PRM` : null}
          />
          <Row
            icon={<Fuel size={14} />}
            label="Sepolia ETH"
            value={data.eth !== null ? `${amount(data.eth, 4)} ETH` : null}
          />
          <Row
            icon={<Gift size={14} />}
            label="Launch airdrop"
            value={data.launch ? launchText(data.launch) : null}
          />
          {data.rounds !== null && (
            <Row
              icon={<Gift size={14} />}
              label="Round airdrops"
              value={roundsText(data.rounds)}
            />
          )}
          {data.registration && (
            <Row
              icon={<ClipboardList size={14} />}
              label="Registration"
              value={registrationText(data.registration)}
            />
          )}
          <Row
            icon={<Sparkles size={14} />}
            label="Genesis NFT"
            value={
              data.nft
                ? data.nft.minted
                  ? data.nft.tokenId
                    ? `Minted (token #${data.nft.tokenId})`
                    : "Minted"
                  : "Not minted"
                : null
            }
          />
          <Row
            icon={<BadgeCheck size={14} />}
            label="Claimer badge"
            value={
              data.badge ? (data.badge.owned ? "Minted" : "Not minted") : null
            }
          />
        </div>
      )}
    </div>
  );
}
