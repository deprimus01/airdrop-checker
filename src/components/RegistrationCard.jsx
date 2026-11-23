import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList,
  CheckCircle2,
  CalendarClock,
  Loader2,
  Lock,
  Users,
} from "lucide-react";
import {
  registrationEnabled,
  fetchRegistrationInfo,
  registerWallet,
} from "../utils/registration";

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// `account` is the connected wallet, or null before connecting
export default function RegistrationCard({ account }) {
  const [round, setRound] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setRound(await fetchRegistrationInfo(account));
      setError("");
    } catch (err) {
      setError(err.message);
    }
    setLoaded(true);
  }, [account]);

  // Load on mount and whenever the wallet changes, then refresh every minute so
  // the count and the open and closed states stay current
  useEffect(() => {
    if (!registrationEnabled) return;
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  async function handleRegister() {
    setError("");
    setRegistering(true);
    try {
      await registerWallet(account, round.id);
      await load();
    } catch (err) {
      setError(err.message);
      // Already registered or round state changed: refresh what we show
      if (["already_registered", "round_full", "closed"].includes(err.code)) {
        await load();
      }
    }
    setRegistering(false);
  }

  // Not configured, or no round has been created yet
  if (!registrationEnabled) return null;
  if (loaded && !round && !error) return null;

  const { phase, registered } = round || {};

  return (
    <div className="card reg-card">
      <div className="row">
        <span className="label nft-title">
          <ClipboardList size={16} />
          Airdrop registration
        </span>
        {round && <span className="label">{round.name}</span>}
      </div>

      {!loaded && <p className="nft-note">Loading registration…</p>}

      {round && (
        <>
          <div className="reg-rows">
            <div className="row">
              <span className="label">Reward</span>
              <strong>{round.amount.toLocaleString()} PRM per wallet</strong>
            </div>
            <div className="row">
              <span className="label">Opens</span>
              <span>{formatDate(round.opensAt)}</span>
            </div>
            <div className="row">
              <span className="label">Closes</span>
              <span>{formatDate(round.closesAt)}</span>
            </div>
            <div className="row">
              <span className="label">
                <Users size={14} className="reg-inline-icon" />
                Registered
              </span>
              <span>
                {round.registeredCount.toLocaleString()}
                {round.maxRegistrations !== null &&
                  ` / ${round.maxRegistrations.toLocaleString()}`}
              </span>
            </div>
          </div>

          {registered && (
            <div className="net ok reg-state">
              <CheckCircle2 size={16} />
              You are registered
            </div>
          )}

          {!registered && phase === "upcoming" && (
            <p className="nft-note reg-state">
              <CalendarClock size={14} className="reg-inline-icon" />
              Registration opens on {formatDate(round.opensAt)}.
            </p>
          )}

          {!registered && phase === "open" && !account && (
            <p className="nft-note reg-state">Connect your wallet to register.</p>
          )}

          {!registered && phase === "open" && account && (
            <button
              className="btn nft-btn"
              onClick={handleRegister}
              disabled={registering}
            >
              {registering ? (
                <>
                  <Loader2 size={18} className="spin-icon" />
                  Waiting for signature…
                </>
              ) : (
                <>
                  <ClipboardList size={18} />
                  Register for airdrop
                </>
              )}
            </button>
          )}

          {!registered && phase === "full" && (
            <p className="nft-note reg-state">
              <Lock size={14} className="reg-inline-icon" />
              This round is full.
            </p>
          )}

          {!registered && phase === "closed" && (
            <p className="nft-note reg-state">
              <Lock size={14} className="reg-inline-icon" />
              Registration is closed.
            </p>
          )}

          {phase === "open" && !registered && account && (
            <p className="nft-note reg-hint">
              You sign a free message to prove you own this wallet. No gas or
              ETH is needed.
            </p>
          )}
        </>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}
