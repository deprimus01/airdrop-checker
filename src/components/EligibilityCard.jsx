import { CheckCircle2, XCircle } from "lucide-react";

export default function EligibilityCard({ status, result }) {
  if (status === "checking") {
    return (
      <div className="card result">
        <div className="spinner" />
        <p>Checking eligibility…</p>
      </div>
    );
  }

  if (status !== "done" || !result) return null;

  if (result.eligible) {
    return (
      <div className="card result eligible">
        <div className="icon">
          <CheckCircle2 size={44} />
        </div>
        <h2>You're eligible!</h2>
        <div className="amount">{result.amount}</div>
        <p>tokens available to claim</p>
      </div>
    );
  }

  return (
    <div className="card result not-eligible">
      <div className="icon">
        <XCircle size={44} />
      </div>
      <h2>Not eligible</h2>
      <p>This wallet isn't on the allowlist.</p>
    </div>
  );
}
