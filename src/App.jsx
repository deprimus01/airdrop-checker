import { useState, useEffect } from "react";
import { BrowserProvider } from "ethers";
import {
  Wallet,
  RefreshCw,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Network,
  ExternalLink,
} from "lucide-react";
import { checkEligibility } from "./utils/checkEligibility";
import EligibilityCard from "./components/EligibilityCard";
import CopyAddress from "./components/CopyAddress";
import { SEPOLIA } from "./constants";

const DISCONNECT_KEY = "manuallyDisconnected";

// localStorage can throw in some privacy modes, so wrap it safely
function readFlag() {
  try {
    return localStorage.getItem(DISCONNECT_KEY) === "true";
  } catch {
    return false;
  }
}

function writeFlag(value) {
  try {
    if (value) localStorage.setItem(DISCONNECT_KEY, "true");
    else localStorage.removeItem(DISCONNECT_KEY);
  } catch {
    /* ignore */
  }
}

export default function App() {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("idle"); // idle | checking | done
  const [result, setResult] = useState(null);

  const hasWallet = Boolean(window.ethereum);
  const onSepolia = chainId?.toLowerCase() === SEPOLIA.chainId;

  async function connectWallet() {
    setError("");

    try {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      writeFlag(false);
      setAccount(accounts[0]);
    } catch (err) {
      if (err.code === "ACTION_REJECTED" || err.info?.error?.code === 4001) {
        setError("You rejected the connection request.");
      } else if (err.code === -32002) {
        setError("A MetaMask request is already open. Check your wallet.");
      } else {
        setError(err.shortMessage || err.message);
      }
    }
  }

  async function switchWallet() {
    setError("");
    try {
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });
      setAccount(accounts[0] || null);
    } catch (err) {
      if (err.code === 4001) {
        setError("You cancelled the wallet switch.");
      } else {
        setError(err.message);
      }
    }
  }

  function disconnectWallet() {
    writeFlag(true);
    setError("");
    setAccount(null);
  }

  async function switchToSepolia() {
    setError("");
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA.chainId }],
      });
    } catch (err) {
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [SEPOLIA],
          });
        } catch (addErr) {
          setError(addErr.message);
        }
      } else if (err.code === 4001) {
        setError("You cancelled the network switch.");
      } else {
        setError(err.message);
      }
    }
  }

  // Auto-reconnect on page load if the site was already approved
  useEffect(() => {
    if (!window.ethereum || readFlag()) return;

    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (accounts.length > 0) setAccount(accounts[0]);
      })
      .catch(() => {});
  }, []);

  // Read the current network whenever the account changes
  useEffect(() => {
    if (!account) {
      setChainId(null);
      return;
    }
    window.ethereum
      .request({ method: "eth_chainId" })
      .then(setChainId)
      .catch((err) => setError(err.message));
  }, [account]);

  // Run the eligibility check once we have an account on the right network
  useEffect(() => {
    if (!account || !onSepolia) {
      setStatus("idle");
      setResult(null);
      return;
    }

    setStatus("checking");
    const timer = setTimeout(() => {
      setResult(checkEligibility(account));
      setStatus("done");
    }, 600);

    return () => clearTimeout(timer);
  }, [account, onSepolia]);

  // Listen for account and network changes in MetaMask
  useEffect(() => {
    if (!window.ethereum) return;

    function handleAccountsChanged(accounts) {
      setAccount(accounts.length > 0 ? accounts[0] : null);
    }

    function handleChainChanged(newChainId) {
      setChainId(newChainId);
    }

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  // No wallet extension installed
  if (!hasWallet) {
    return (
      <div className="app">
        <h1 className="title">Airdrop Eligibility Checker</h1>
        <p className="subtitle">Connect your wallet to see if you qualify.</p>
        <div className="warning">
          <div className="icon">
            <AlertTriangle size={32} />
          </div>
          <h2>No wallet detected</h2>
          <p>
            You need a browser wallet to use this app. Install MetaMask and
            refresh the page.
          </p>
          <a
            className="btn link-btn"
            href="https://metamask.io/download/"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={18} />
            Install MetaMask
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <h1 className="title">Airdrop Eligibility Checker</h1>
      <p className="subtitle">Connect your wallet to see if you qualify.</p>

      {!account ? (
        <button className="btn" onClick={connectWallet}>
          <Wallet size={18} />
          Connect Wallet
        </button>
      ) : (
        <>
          <div className="card">
            <div className="row">
              <span className="label">Connected wallet</span>
              <CopyAddress address={account} />
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <span className="label">Network</span>
              {onSepolia ? (
                <span className="net ok">
                  <CheckCircle2 size={16} />
                  Sepolia
                </span>
              ) : (
                <span className="net bad">
                  <AlertTriangle size={16} />
                  Wrong network
                </span>
              )}
            </div>
          </div>

          {!onSepolia ? (
            <div className="warning">
              <div className="icon">
                <AlertTriangle size={32} />
              </div>
              <h2>Wrong network</h2>
              <p>Please switch to Sepolia to continue.</p>
              <button className="btn" onClick={switchToSepolia}>
                <Network size={18} />
                Switch to Sepolia
              </button>
            </div>
          ) : (
            <EligibilityCard status={status} result={result} />
          )}

          <div className="actions">
            <button className="btn secondary" onClick={switchWallet}>
              <RefreshCw size={16} />
              Switch Wallet
            </button>
            <button className="btn secondary" onClick={disconnectWallet}>
              <LogOut size={16} />
              Disconnect
            </button>
          </div>
        </>
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}
