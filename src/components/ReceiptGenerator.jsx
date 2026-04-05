import { useState, useMemo, useCallback } from "react";
import {
  GOLD_PURITIES,
  CURRENCIES,
  calculatePrice,
  formatCurrency,
} from "../utils/priceUtils";
import { generateReceiptPDF } from "../utils/receiptPdf";
import "./ReceiptGenerator.css";

/**
 * Default empty item template.
 */
const createEmptyItem = () => ({
  id: crypto.randomUUID(),
  name: "",
  weight: "",
  purityIndex: 0, // maps to GOLD_PURITIES
});

/**
 * ReceiptGenerator — generates professional gold shop receipts.
 *
 * Props:
 *   prices        – live/fallback price data from parent
 *   isFallback    – whether prices are from fallback
 */
export default function ReceiptGenerator({ prices, isFallback }) {
  // ── Mode ─────────────────────────────────────────────
  const [mode, setMode] = useState("cash"); // "cash" | "gold"

  // ── Shop details ─────────────────────────────────────
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");

  // ── Currency ─────────────────────────────────────────
  const [currency, setCurrency] = useState("INR");

  // ── Manual price entry ───────────────────────────────
  const [isManual, setIsManual] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [manualError, setManualError] = useState(null);

  // ── Items ────────────────────────────────────────────
  const [items, setItems] = useState([createEmptyItem()]);

  // ── Validation ───────────────────────────────────────
  const [validationError, setValidationError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const currencyObj = CURRENCIES.find((c) => c.code === currency);

  // ── Manual price validation ──────────────────────────
  const validManualPrice = useMemo(() => {
    const v = parseFloat(manualPrice);
    if (manualPrice === "" || isNaN(v)) return null;
    if (v <= 0) return null;
    return v;
  }, [manualPrice]);

  const handleManualPriceChange = (e) => {
    const raw = e.target.value;
    setManualPrice(raw);
    const v = parseFloat(raw);
    if (raw !== "" && (isNaN(v) || v <= 0)) {
      setManualError("Enter a valid positive number");
    } else {
      setManualError(null);
    }
  };

  const handleToggleManual = () => {
    setIsManual((prev) => !prev);
    setManualError(null);
  };

  // ── API gold price (per 10g) ─────────────────────────
  const apiPricePer10g = useMemo(() => {
    if (!prices) return 0;
    return prices.gold?.[currency] || 0;
  }, [prices, currency]);

  // ── Effective price: manual → API → fallback ─────────
  const basePricePer10g = useMemo(() => {
    if (isManual && validManualPrice !== null) return validManualPrice;
    return apiPricePer10g;
  }, [isManual, validManualPrice, apiPricePer10g]);

  // ── Price source badge ───────────────────────────────
  const priceSource = useMemo(() => {
    if (isManual && validManualPrice !== null) return "manual";
    if (isFallback) return "fallback";
    return "api";
  }, [isManual, validManualPrice, isFallback]);

  // ── Item management ──────────────────────────────────
  const addItem = useCallback(() => {
    setItems((prev) => [...prev, createEmptyItem()]);
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => {
      if (prev.length <= 1) return prev; // keep at least one
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const updateItem = useCallback((id, field, value) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }, []);

  // ── Calculations ─────────────────────────────────────
  const computedItems = useMemo(() => {
    return items.map((item) => {
      const purity = GOLD_PURITIES[item.purityIndex] || GOLD_PURITIES[0];
      const w = parseFloat(item.weight) || 0;
      const price = calculatePrice(basePricePer10g, purity.value, w);
      const pureWeight = w * purity.value;
      return {
        ...item,
        purityLabel: purity.label,
        purityValue: purity.value,
        weightNum: w,
        price,
        pureWeight,
      };
    });
  }, [items, basePricePer10g]);

  const totalPrice = useMemo(
    () => computedItems.reduce((sum, i) => sum + i.price, 0),
    [computedItems]
  );

  const totalPureWeight = useMemo(
    () => computedItems.reduce((sum, i) => sum + i.pureWeight, 0),
    [computedItems]
  );

  // ── Validation ───────────────────────────────────────
  const validate = useCallback(() => {
    if (!storeName.trim()) return "Please enter a store name.";
    if (!storeAddress.trim()) return "Please enter a store address.";
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name.trim()) return `Item ${i + 1}: Please enter an item name.`;
      const w = parseFloat(item.weight);
      if (!w || w <= 0) return `Item ${i + 1}: Please enter a valid weight.`;
    }
    if (basePricePer10g <= 0) return "Gold price is unavailable. Please wait for prices to load.";
    return null;
  }, [storeName, storeAddress, items, basePricePer10g]);

  // ── Generate PDF ─────────────────────────────────────
  const handleGenerate = useCallback(() => {
    setSubmitted(true);
    const err = validate();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);

    const now = new Date();
    const dateTime = now.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    generateReceiptPDF({
      storeName: storeName.trim(),
      storeAddress: storeAddress.trim(),
      mode,
      currencyCode: currency,
      currencySymbol: currencyObj?.symbol || "₹",
      pricePer10g: basePricePer10g,
      items: computedItems.map((it) => ({
        name: it.name,
        weight: it.weightNum,
        purityLabel: it.purityLabel,
        purityValue: it.purityValue,
        price: it.price,
        pureWeight: it.pureWeight,
      })),
      totalPrice,
      totalPureWeight,
      dateTime,
    });
  }, [
    validate,
    storeName,
    storeAddress,
    mode,
    currency,
    currencyObj,
    basePricePer10g,
    computedItems,
    totalPrice,
    totalPureWeight,
  ]);

  // ── Theme ────────────────────────────────────────────
  const modeTheme =
    mode === "cash"
      ? {
          accent: "#10b981",
          accentRgb: "16,185,129",
          gradient: "linear-gradient(135deg, #10b981, #34d399)",
          borderCol: "rgba(16,185,129,0.15)",
          bgCol: "rgba(16,185,129,0.06)",
          glowCol: "rgba(16,185,129,0.1)",
        }
      : {
          accent: "#f59e0b",
          accentRgb: "245,158,11",
          gradient: "linear-gradient(135deg, #f59e0b, #f97316)",
          borderCol: "rgba(245,158,11,0.15)",
          bgCol: "rgba(245,158,11,0.06)",
          glowCol: "rgba(245,158,11,0.1)",
        };

  // ── Render ───────────────────────────────────────────
  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="text-4xl mb-3 block">🧾</span>
        <h2 className="text-2xl font-extrabold text-white mb-1">
          Receipt Generator
        </h2>
        <p className="text-sm text-gray-500">
          Generate professional receipts for your gold shop
        </p>
      </div>

      {/* ─── MODE TOGGLE ─── */}
      <div className="receipt-section" style={{ borderColor: modeTheme.borderCol }}>
        <label className="receipt-label">Calculation Mode</label>
        <div className="receipt-mode-toggle">
          <button
            type="button"
            className={`receipt-mode-btn ${mode === "cash" ? "active-cash" : ""}`}
            onClick={() => setMode("cash")}
          >
            <span>💵</span>
            <span>Cash Mode</span>
          </button>
          <button
            type="button"
            className={`receipt-mode-btn ${mode === "gold" ? "active-gold" : ""}`}
            onClick={() => setMode("gold")}
          >
            <span>🥇</span>
            <span>Gold Mode</span>
          </button>
        </div>

        <div
          className="mt-3 px-4 py-2.5 rounded-xl text-xs text-gray-500"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          {mode === "cash"
            ? "💡 Calculate total price in currency based on weight & purity."
            : "💡 Calculate total gold weight + show equivalent cash value."}
        </div>
      </div>

      {/* ─── SHOP DETAILS ─── */}
      <div className="receipt-section" style={{ borderColor: modeTheme.borderCol }}>
        <div className="flex items-center gap-2 mb-5">
          <span className="text-lg">🏪</span>
          <h3 className="text-base font-bold text-white">Shop Details</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="receipt-label" htmlFor="receipt-store-name">
              Store Name
            </label>
            <input
              id="receipt-store-name"
              type="text"
              className="receipt-input"
              placeholder="e.g. Rajesh Jewellers"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
            {submitted && !storeName.trim() && (
              <p className="text-red-400 text-[11px] mt-1.5 ml-1">Required</p>
            )}
          </div>
          <div>
            <label className="receipt-label" htmlFor="receipt-store-address">
              Store Address
            </label>
            <input
              id="receipt-store-address"
              type="text"
              className="receipt-input"
              placeholder="e.g. MG Road, Bangalore"
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
            />
            {submitted && !storeAddress.trim() && (
              <p className="text-red-400 text-[11px] mt-1.5 ml-1">Required</p>
            )}
          </div>
        </div>
      </div>

      {/* ─── CURRENCY & PRICE INFO ─── */}
      <div className="receipt-section" style={{ borderColor: modeTheme.borderCol }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="receipt-label" htmlFor="receipt-currency">
              Currency
            </label>
            <select
              id="receipt-currency"
              className="receipt-select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="receipt-label">Gold Price (per 10g)</label>
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-2xl"
              style={{
                background: modeTheme.bgCol,
                border: `1px solid ${modeTheme.borderCol}`,
              }}
            >
              <span className="text-lg font-bold" style={{ color: modeTheme.accent }}>
                {basePricePer10g > 0
                  ? formatCurrency(basePricePer10g, currency)
                  : "Loading…"}
              </span>
              {/* Price source badge */}
              {priceSource === "manual" && (
                <span
                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(99,102,241,0.14)", color: "#a5b4fc" }}
                >
                  ✏️ Manual
                </span>
              )}
              {priceSource === "fallback" && (
                <span
                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24" }}
                >
                  ● Default
                </span>
              )}
              {priceSource === "api" && (
                <span
                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}
                >
                  ● Live
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ─── MANUAL PRICE TOGGLE + INPUT ─── */}
        <div>
          <button
            id="receipt-manual-price-toggle"
            onClick={handleToggleManual}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-300"
            style={{
              background: isManual ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${isManual ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.08)"}`,
              color: isManual ? "#a5b4fc" : "#9ca3af",
            }}
          >
            {/* Toggle pill */}
            <span
              className="relative inline-block w-8 h-[18px] rounded-full transition-colors duration-300"
              style={{ background: isManual ? "#6366f1" : "rgba(255,255,255,0.12)" }}
            >
              <span
                className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform duration-300"
                style={{ left: isManual ? "15px" : "2px" }}
              />
            </span>
            Enter Price Manually
          </button>

          {/* Manual input (animated reveal) */}
          <div
            className="overflow-hidden transition-all duration-400 ease-out"
            style={{
              maxHeight: isManual ? "120px" : "0",
              opacity: isManual ? 1 : 0,
              marginTop: isManual ? "12px" : "0",
            }}
          >
            <div className="relative">
              <input
                id="receipt-manual-price-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="Custom gold price per 10g…"
                value={manualPrice}
                onChange={handleManualPriceChange}
                className="receipt-input"
                style={{
                  background: "rgba(99,102,241,0.06)",
                  border: manualError
                    ? "1px solid rgba(239,68,68,0.4)"
                    : "1px solid rgba(99,102,241,0.2)",
                }}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">
                {currencyObj?.symbol || "₹"}/10g
              </span>
            </div>
            {manualError && (
              <p className="text-red-400 text-[11px] mt-1.5 ml-1">{manualError}</p>
            )}
            {isManual && validManualPrice !== null && (
              <p className="text-indigo-400 text-[11px] mt-1.5 ml-1">
                Calculations now use your custom price.
              </p>
            )}
            {isManual && manualPrice === "" && (
              <p className="text-gray-500 text-[11px] mt-1.5 ml-1">
                Using {isFallback ? "default" : "API"} price until you enter a value.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ─── ITEMS ─── */}
      <div className="receipt-section" style={{ borderColor: modeTheme.borderCol }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-lg">📦</span>
            <h3 className="text-base font-bold text-white">Items</h3>
            <span className="text-xs text-gray-600 font-medium ml-1">
              ({items.length} {items.length === 1 ? "item" : "items"})
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 mb-4">
          {items.map((item, idx) => (
            <div key={item.id} className="receipt-item-row">
              {/* Item Name */}
              <div>
                <label className="receipt-label">
                  Item {idx + 1} — Name
                </label>
                <input
                  type="text"
                  className="receipt-input"
                  placeholder="e.g. Gold Chain"
                  value={item.name}
                  onChange={(e) => updateItem(item.id, "name", e.target.value)}
                />
                {submitted && !item.name.trim() && (
                  <p className="text-red-400 text-[11px] mt-1 ml-1">Required</p>
                )}
              </div>

              {/* Weight */}
              <div>
                <label className="receipt-label">Weight (g)</label>
                <input
                  type="number"
                  className="receipt-input"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={item.weight}
                  onChange={(e) => updateItem(item.id, "weight", e.target.value)}
                />
                {submitted && (!parseFloat(item.weight) || parseFloat(item.weight) <= 0) && (
                  <p className="text-red-400 text-[11px] mt-1 ml-1">Required</p>
                )}
              </div>

              {/* Purity */}
              <div>
                <label className="receipt-label">Purity</label>
                <select
                  className="receipt-select"
                  value={item.purityIndex}
                  onChange={(e) =>
                    updateItem(item.id, "purityIndex", parseInt(e.target.value))
                  }
                >
                  {GOLD_PURITIES.map((p, pIdx) => (
                    <option key={p.label} value={pIdx}>
                      {p.label} ({p.description})
                    </option>
                  ))}
                </select>
              </div>

              {/* Remove */}
              <button
                type="button"
                className="receipt-remove-btn"
                onClick={() => removeItem(item.id)}
                title="Remove item"
                disabled={items.length <= 1}
                style={items.length <= 1 ? { opacity: 0.2, cursor: "not-allowed" } : {}}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Add item */}
        <button type="button" className="receipt-add-btn" onClick={addItem}>
          <span className="text-lg">+</span>
          <span>Add Item</span>
        </button>
      </div>

      {/* ─── SUMMARY ─── */}
      {computedItems.some((i) => i.weightNum > 0) && (
        <div
          className="receipt-section animate-slideUp"
          style={{
            borderColor: modeTheme.borderCol,
            boxShadow: `0 8px 40px ${modeTheme.glowCol}`,
          }}
        >
          <div className="flex items-center gap-2 mb-5">
            <span className="text-lg">📊</span>
            <h3 className="text-base font-bold text-white">Summary</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="receipt-summary-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>Weight</th>
                  <th>Purity</th>
                  {mode === "gold" && <th>Pure Wt</th>}
                  <th>{mode === "cash" ? "Price" : "Value"}</th>
                </tr>
              </thead>
              <tbody>
                {computedItems.map((item, idx) =>
                  item.weightNum > 0 ? (
                    <tr key={item.id}>
                      <td style={{ color: "#6b7280" }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600, color: "#f5f5f7" }}>
                        {item.name || "—"}
                      </td>
                      <td>{item.weightNum.toFixed(2)}g</td>
                      <td>{item.purityLabel}</td>
                      {mode === "gold" && (
                        <td style={{ color: modeTheme.accent, fontWeight: 700 }}>
                          {item.pureWeight.toFixed(3)}g
                        </td>
                      )}
                      <td style={{ color: modeTheme.accent }}>
                        {formatCurrency(item.price, currency)}
                      </td>
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          </div>

          {/* Price per gram reference */}
          <div
            className="mt-4 px-4 py-3 rounded-xl flex items-center justify-between text-xs"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}
          >
            <span className="text-gray-500">
              24K Price per gram ({currencyObj?.symbol})
            </span>
            <span className="font-bold text-gray-300">
              {formatCurrency(basePricePer10g / 10, currency)}
            </span>
          </div>

          {/* Total */}
          <div
            className="mt-4 rounded-2xl p-[1.5px]"
            style={{ background: modeTheme.gradient }}
          >
            <div className="receipt-total-box">
              <div>
                <div className="text-sm text-gray-400 font-semibold">
                  {mode === "cash" ? "Total Amount" : "Total Pure Gold"}
                </div>
                {mode === "gold" && (
                  <div className="text-xs text-gray-600 mt-0.5">
                    Equivalent cash value:{" "}
                    <span className="text-gray-400 font-semibold">
                      {formatCurrency(totalPrice, currency)}
                    </span>
                  </div>
                )}
              </div>
              <div
                className="text-3xl sm:text-4xl font-extrabold"
                style={{
                  background: modeTheme.gradient,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {mode === "cash"
                  ? formatCurrency(totalPrice, currency)
                  : `${totalPureWeight.toFixed(3)}g`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── VALIDATION ERROR ─── */}
      {validationError && (
        <div className="receipt-error">
          <span>⚠️</span>
          <span>{validationError}</span>
        </div>
      )}

      {/* ─── GENERATE PDF BUTTON ─── */}
      <button
        type="button"
        className="receipt-generate-btn"
        onClick={handleGenerate}
        disabled={!prices}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        Generate Receipt PDF
      </button>
    </div>
  );
}
