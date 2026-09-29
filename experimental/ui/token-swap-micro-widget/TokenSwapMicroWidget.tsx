import React, { useMemo, useState } from "react";
import type { TokenSwapMicroWidgetProps } from "./types";

const SLIPPAGE_PRESETS = [0.5, 1, 2];

export function TokenSwapMicroWidget({
  fromToken,
  toToken,
  exchangeRate,
  onSwap,
}: TokenSwapMicroWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(1);
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);

  const numericAmount = Number(amount);
  const output = useMemo(
    () => (Number.isFinite(numericAmount) && numericAmount > 0 ? numericAmount * exchangeRate : 0),
    [numericAmount, exchangeRate],
  );
  const exceedsBalance = numericAmount > fromToken.balance;
  const canSwap = numericAmount > 0 && !exceedsBalance && !pending;

  const setPreset = (value: number) => {
    setAmount(String(Math.min(value, fromToken.balance)));
    setCompleted(false);
  };

  const handleSwap = async () => {
    if (!canSwap) return;
    setPending(true);
    setCompleted(false);
    try {
      await onSwap(amount, slippage);
      setCompleted(true);
      setAmount("");
    } finally {
      setPending(false);
    }
  };

  return (
    <aside
      aria-label="Token swap"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 20,
        width: expanded ? 320 : "auto",
        padding: 12,
        border: "2px solid #111",
        background: "#fff",
        boxShadow: "4px 4px 0 #111",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        style={{ width: "100%", fontWeight: 700, textAlign: "left" }}
      >
        {expanded ? "Hide swap" : "Swap tokens"}
      </button>

      {expanded && (
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>{fromToken.symbol} to {toToken.symbol}</strong>
            <span>{fromToken.balance} {fromToken.symbol} available</span>
          </div>

          <label>
            Amount
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setCompleted(false);
              }}
              aria-label={"Amount in " + fromToken.symbol}
              style={{ display: "block", width: "100%" }}
            />
          </label>

          <div style={{ display: "flex", gap: 6 }}>
            {[10, 50].map((value) => (
              <button type="button" key={value} onClick={() => setPreset(value)}>
                +{value} {fromToken.symbol}
              </button>
            ))}
            <button type="button" onClick={() => setPreset(fromToken.balance)}>
              MAX
            </button>
          </div>

          <div>
            Rate: 1 {fromToken.symbol} = {exchangeRate} {toToken.symbol}
            <br />
            Receive: {output.toFixed(4)} {toToken.symbol}
          </div>

          <label>
            Slippage
            <select value={slippage} onChange={(event) => setSlippage(Number(event.target.value))}>
              {SLIPPAGE_PRESETS.map((value) => (
                <option key={value} value={value}>{value.toFixed(1)}%</option>
              ))}
            </select>
          </label>

          {exceedsBalance && (
            <p role="alert">Amount exceeds your available {fromToken.symbol} balance.</p>
          )}
          {completed && <p role="status">Swap submitted successfully.</p>}

          <button type="button" disabled={!canSwap} onClick={handleSwap}>
            {pending ? "Swapping..." : "Swap now"}
          </button>
        </div>
      )}
    </aside>
  );
}

export default TokenSwapMicroWidget;