import { useState, useEffect, useMemo } from "react";
import {
  GOLD_PURITIES,
  SILVER_PURITIES,
  CURRENCIES,
  calculatePrice,
  formatCurrency,
  formatLastUpdated,
} from "../utils/priceUtils";

/**
 * Main calculator section — shows live price header + purity/weight/currency calculator.
 */
export default function PriceCalculator({
  activeTab,
  prices,
  loading,
  error,
  lastUpdated,
  onRefresh,
}) {
  const [selectedPurity, setSelectedPurity] = useState(0);
  const [weight, setWeight] = useState("");
  const [currency, setCurrency] = useState("INR");

  const isGold = activeTab === "gold";
  const purities = isGold ? GOLD_PURITIES : SILVER_PURITIES;

  // Reset purity index when switching metals
  useEffect(() => {
    setSelectedPurity(0);
  }, [activeTab]);

  // ── Derived values ───────────────────────────────

  const basePricePerGram = useMemo(() => {
    if (!prices) return 0;
    return isGold ? prices.gold?.[currency] || 0 : prices.silver?.[currency] || 0;
  }, [prices, isGold, currency]);

  const adjustedPricePerGram = useMemo(
    () => basePricePerGram * purities[selectedPurity].value,
    [basePricePerGram, purities, selectedPurity]
  );

  const totalPrice = useMemo(() => {
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0) return 0;
    return calculatePrice(basePricePerGram, purities[selectedPurity].value, w);
  }, [basePricePerGram, purities, selectedPurity, weight]);

  const currencyObj = CURRENCIES.find((c) => c.code === currency);

  // ── Theme tokens ─────────────────────────────────

  const theme = isGold
    ? {
        accent:      "#f59e0b",
        accentRgb:   "245,158,11",
        gradient:    "linear-gradient(135deg, #f59e0b, #f97316, #eab308)",
        textClass:   "gradient-text-gold",
        borderCol:   "rgba(245,158,11,0.15)",
        bgCol:       "rgba(245,158,11,0.06)",
        glowCol:     "rgba(245,158,11,0.12)",
        focusRing:   "focus-ring-gold",
        emoji:       "🥇",
        metalName:   "Gold",
      }
    : {
        accent:      "#94a3b8",
        accentRgb:   "148,163,184",
        gradient:    "linear-gradient(135deg, #94a3b8, #e2e8f0, #cbd5e1)",
        textClass:   "gradient-text-silver",
        borderCol:   "rgba(148,163,184,0.15)",
        bgCol:       "rgba(148,163,184,0.06)",
        glowCol:     "rgba(148,163,184,0.1)",
        focusRing:   "focus-ring-silver",
        emoji:       "🥈",
        metalName:   "Silver",
      };

  // ── Render ───────────────────────────────────────

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* ─── LIVE PRICE CARD ─── */}
      <div
        id="live-price-card"
        className="glass-card relative overflow-hidden p-6 sm:p-8 mb-6 animate-fadeIn"
        style={{
          borderColor: theme.borderCol,
          boxShadow: `0 8px 40px ${theme.glowCol}`,
        }}
      >
        {/* Decorative glow blob */}
        <div
          className="absolute -top-20 -right-20 w-56 h-56 rounded-full blur-[80px] animate-pulse-glow pointer-events-none"
          style={{ background: theme.gradient, opacity: 0.15 }}
        />

        <div className="relative z-10">
          {/* Title row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl animate-float">{theme.emoji}</span>
              <div>
                <h2 className="text-xl font-bold text-white">{theme.metalName} Price</h2>
                <p className="text-xs text-gray-500 mt-0.5">Live rate per gram</p>
              </div>
            </div>
            <button
              id="refresh-btn"
              onClick={onRefresh}
              disabled={loading}
              className={`p-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                loading ? "animate-spin-slow" : ""
              }`}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: loading ? theme.accent : "#9ca3af",
              }}
              title="Refresh prices"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
          </div>

          {/* Loading state */}
          {loading && !prices && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div
                className="w-6 h-6 border-2 rounded-full animate-spin"
                style={{ borderColor: `${theme.accent} transparent transparent transparent` }}
              />
              <span className="text-gray-400 text-sm">Fetching live prices…</span>
            </div>
          )}

          {/* Error state */}
          {error && !prices && (
            <div className="py-5">
              <div
                className="flex items-start gap-3 text-sm rounded-2xl p-4"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}
              >
                <span className="text-lg mt-0.5">⚠️</span>
                <div>
                  <p className="text-red-400 font-medium">{error}</p>
                  <button
                    onClick={onRefresh}
                    className="mt-2 px-4 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5" }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Price display */}
          {prices && (
            <div className="animate-fadeIn">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span
                  className={`text-4xl sm:text-5xl font-extrabold ${theme.textClass}`}
                >
                  {formatCurrency(basePricePerGram, currency)}
                </span>
                <span className="text-gray-500 text-sm font-medium">/ gram</span>
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <span>🕐</span>
                <span>Last updated: {formatLastUpdated(lastUpdated)}</span>
                {loading && (
                  <span
                    className="w-3 h-3 border rounded-full animate-spin inline-block"
                    style={{ borderColor: `${theme.accent} transparent transparent transparent`, borderWidth: "1.5px" }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── CALCULATOR CARD ─── */}
      {prices && (
        <div
          id="calculator-card"
          className="glass-card p-6 sm:p-8 animate-slideUp"
          style={{
            borderColor: theme.borderCol,
            boxShadow: `0 8px 40px ${theme.glowCol}`,
          }}
        >
          {/* Purity Selector */}
          <div className="mb-7">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 block">
              Purity
            </label>
            <div id="purity-selector" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {purities.map((p, idx) => {
                const isSelected = selectedPurity === idx;
                return (
                  <button
                    key={p.label}
                    id={`purity-${p.label}`}
                    onClick={() => setSelectedPurity(idx)}
                    className="relative p-3.5 rounded-2xl text-center transition-all duration-300 cursor-pointer glass-card-hover"
                    style={{
                      background: isSelected ? theme.bgCol : "rgba(255,255,255,0.03)",
                      border: `1px solid ${isSelected ? theme.borderCol : "rgba(255,255,255,0.05)"}`,
                      boxShadow: isSelected ? `0 0 0 1px ${theme.accent}40` : "none",
                    }}
                  >
                    <div
                      className="text-lg font-extrabold"
                      style={{ color: isSelected ? theme.accent : "#f5f5f7" }}
                    >
                      {p.label}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 font-medium">{p.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Weight + Currency Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
            {/* Weight */}
            <div className="sm:col-span-2">
              <label
                htmlFor="weight-input"
                className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block"
              >
                Weight (grams)
              </label>
              <div className="relative">
                <input
                  id="weight-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter weight…"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className={`w-full rounded-2xl px-4 py-3.5 text-white text-lg font-semibold placeholder-gray-600 outline-none transition-all duration-200 ${theme.focusRing}`}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 text-sm font-bold">
                  g
                </span>
              </div>
            </div>

            {/* Currency */}
            <div>
              <label
                htmlFor="currency-select"
                className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block"
              >
                Currency
              </label>
              <select
                id="currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={`w-full rounded-2xl px-4 py-3.5 text-white text-lg font-semibold outline-none transition-all duration-200 appearance-none cursor-pointer ${theme.focusRing}`}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code} style={{ background: "#0f0f17", color: "#fff" }}>
                    {c.symbol} {c.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Adjusted Price per Gram */}
          <div
            className="rounded-2xl p-4 mb-4 flex items-center justify-between"
            style={{ background: theme.bgCol, border: `1px solid ${theme.borderCol}` }}
          >
            <span className="text-sm text-gray-400 font-medium">
              {purities[selectedPurity].label} price per gram
            </span>
            <span className={`text-lg font-bold ${theme.textClass}`}>
              {formatCurrency(adjustedPricePerGram, currency)}
            </span>
          </div>

          {/* Total Price Display */}
          <div
            id="total-price-display"
            className="rounded-2xl p-[1.5px]"
            style={{ background: theme.gradient }}
          >
            <div
              className="rounded-2xl p-5 sm:p-6 flex items-center justify-between"
              style={{ background: "#0a0a0f" }}
            >
              <div>
                <div className="text-sm text-gray-400 font-semibold mb-0.5">Total Price</div>
                <div className="text-xs text-gray-600">
                  {purities[selectedPurity].label} × {weight || "0"}g
                </div>
              </div>
              <div
                className={`text-3xl sm:text-4xl font-extrabold ${theme.textClass} transition-all duration-300`}
              >
                {totalPrice > 0
                  ? formatCurrency(totalPrice, currency)
                  : `${currencyObj?.symbol || "₹"}0.00`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
