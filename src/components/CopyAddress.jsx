import { useState } from "react";
import { Copy, Check } from "lucide-react";

function shortenAddress(address) {
  return address.slice(0, 6) + "…" + address.slice(-4);
}

export default function CopyAddress({ address }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked in some browsers, so fail quietly
    }
  }

  return (
    <button
      className="copy-btn"
      onClick={handleCopy}
      title={copied ? "Copied" : "Copy full address"}
      aria-label="Copy wallet address"
    >
      <span className="address">{shortenAddress(address)}</span>
      {copied ? <Check size={16} className="icon-ok" /> : <Copy size={16} />}
    </button>
  );
}
