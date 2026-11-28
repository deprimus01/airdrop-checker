import test from "node:test";
import assert from "node:assert/strict";
import { timeAgo, formatAmount } from "./format.js";

const NOW = 1_800_000_000_000; // ms

test("timeAgo picks the right unit", () => {
  const s = NOW / 1000;
  assert.equal(timeAgo(s - 5, NOW), "just now");
  assert.equal(timeAgo(s - 5 * 60, NOW), "5 min ago");
  assert.equal(timeAgo(s - 3 * 3600, NOW), "3 h ago");
  assert.equal(timeAgo(s - 2 * 86400, NOW), "2 d ago");
  // A timestamp slightly in the future never shows a negative time
  assert.equal(timeAgo(s + 30, NOW), "just now");
});

test("formatAmount keeps four significant digits", () => {
  assert.equal(formatAmount("0.0012345678", 4), Number("0.001235").toLocaleString(undefined, { maximumSignificantDigits: 4 }));
  assert.equal(formatAmount("5000.0"), Number("5000").toLocaleString(undefined, { maximumSignificantDigits: 4 }));
});
