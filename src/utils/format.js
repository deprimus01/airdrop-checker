// "5 minutes ago", "3 hours ago", "2 days ago" for a unix timestamp in seconds
export function timeAgo(unixSeconds, nowMs = Date.now()) {
  const seconds = Math.max(0, Math.floor(nowMs / 1000) - unixSeconds);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

// Short readable numbers: 1,234.5 or 0.001234
export function formatAmount(value, significant = 4) {
  return Number(value).toLocaleString(undefined, {
    maximumSignificantDigits: significant,
  });
}
