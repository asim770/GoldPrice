import { useState, useMemo, useCallback, useRef } from "react";
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
  purityIndex: 0,
});

/**
 * Generate a receipt number like "RCP-20260414-A7X3"
 */
function generateReceiptNumber() {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RCP-${dateStr}-${rand}`;
}

/**
 * ReceiptGenerator — generates professional gold shop receipts.
 */
export default function ReceiptGenerator({ prices, isFallback }) {
  // ── Mode ─────────────────────────────────────────────
  const [mode, setMode] = useState("cash");

  // ── Shop details ─────────────────────────────────────
  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeGSTIN, setStoreGSTIN] = useState("");

  // ── Customer details ─────────────────────────────────
  const [customerName, setCustomerName] = useState("");

  // ── Currency ─────────────────────────────────────────
  const [currency, setCurrency] = useState("INR");

  // ── Manual price entry ───────────────────────────────
  const [isManual, setIsManual] = useState(false);
  const [manualPrice, setManualPrice] = useState("");
  const [manualError, setManualError] = useState(null);

  // ── Making charges ───────────────────────────────────
  const [makingChargesType, setMakingChargesType] = useState("percentage"); // "percentage" | "flat"
  const [makingChargesValue, setMakingChargesValue] = useState("");

  // ── Items ────────────────────────────────────────────
  const [items, setItems] = useState([createEmptyItem()]);

  // ── Validation ───────────────────────────────────────
  const [validationError, setValidationError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  // ── Receipt Number ───────────────────────────────────
  const receiptNumberRef = useRef(generateReceiptNumber());

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
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const updateItem = useCallback((id, field, value) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }, []);

  // ── Making charges calculation ───────────────────────
  const makingChargesNum = useMemo(() => {
    const v = parseFloat(makingChargesValue);
    if (makingChargesValue === "" || isNaN(v) || v < 0) return 0;
    return v;
  }, [makingChargesValue]);

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

  const subtotal = useMemo(
    () => computedItems.reduce((sum, i) => sum + i.price, 0),
    [computedItems]
  );

  const makingChargesAmount = useMemo(() => {
    if (makingChargesType === "percentage") {
      return subtotal * (makingChargesNum / 100);
    }
    return makingChargesNum;
  }, [subtotal, makingChargesType, makingChargesNum]);

  const totalPrice = useMemo(
    () => subtotal + makingChargesAmount,
    [subtotal, makingChargesAmount]
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

  // ── Backend PDF Storage & Share State ─────────────────
  const [serverReceipt, setServerReceipt] = useState(null);
  const [recentReceipts, setRecentReceipts] = useState([]);
  const [isUploading, setIsUploading]     = useState(false);
  const [copiedLink, setCopiedLink]       = useState(false);

  const fetchRecentReceipts = useCallback(async () => {
    try {
      const res = await fetch("/api/receipts");
      if (res.ok) {
        const data = await res.json();
        setRecentReceipts(data.receipts || []);
      }
    } catch (e) {
      console.warn("Backend server offline or unreachable:", e);
    }
  }, []);

  useEffect(() => {
    fetchRecentReceipts();
  }, [fetchRecentReceipts]);

  // ── Generate & Save PDF to Backend (1-Day Access) ─────
  const handleGenerate = useCallback(async () => {
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

    // Regenerate receipt number on each generation
    receiptNumberRef.current = generateReceiptNumber();

    // 1. Generate local PDF & get base64
    const pdfResult = generateReceiptPDF({
      storeName: storeName.trim(),
      storeAddress: storeAddress.trim(),
      storePhone: storePhone.trim(),
      storeGSTIN: storeGSTIN.trim(),
      customerName: customerName.trim(),
      receiptNumber: receiptNumberRef.current,
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
      subtotal,
      makingCharges: makingChargesAmount,
      makingChargesLabel:
        makingChargesType === "percentage"
          ? `Making Charges (${makingChargesNum}%)`
          : "Making Charges (Flat)",
      totalPrice,
      totalPureWeight,
      dateTime,
    });

    // 2. Upload to Backend for 1-Day Storage
    if (pdfResult && pdfResult.pdfBase64) {
      setIsUploading(true);
      try {
        const res = await fetch("/api/receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiptNumber: receiptNumberRef.current,
            customerName: customerName.trim() || "Customer",
            storeName: storeName.trim(),
            totalAmount: totalPrice,
            currency: currency,
            pdfBase64: pdfResult.pdfBase64,
            items: computedItems,
          }),
        });

        if (res.ok) {
          const serverData = await res.json();
          setServerReceipt(serverData);
          fetchRecentReceipts();
        }
      } catch (uploadErr) {
        console.warn("Backend upload failed:", uploadErr);
      } finally {
        setIsUploading(false);
      }
    }
  }, [
    validate,
    storeName,
    storeAddress,
    storePhone,
    storeGSTIN,
    customerName,
    mode,
    currency,
    currencyObj,
    basePricePer10g,
    computedItems,
    subtotal,
    makingChargesAmount,
    makingChargesType,
    makingChargesNum,
    totalPrice,
    totalPureWeight,
    fetchRecentReceipts,
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

  const hasValidItems = computedItems.some((i) => i.weightNum > 0);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 animate-fadeIn">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="text-4xl mb-3 block">🧾</span>
        <h2 className="text-2xl font-extrabold text-white mb-1">
          Receipt Generator
        </h2>
        <p className="text-sm text-gray-500">
          Generate professional receipts with 1-Day temporary server storage
        </p>
      </div>

      {/* ─── BACKEND 1-DAY LINK NOTIFICATION CARD ─── */}
      {serverReceipt && (
        <div className="glass-card p-5 mb-6 rounded-2xl animate-fadeIn border border-emerald-500/30 bg-emerald-500/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="text-2xl mt-0.5">🚀</span>
              <div>
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  PDF Generated & Saved to Backend Server!
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Valid for 1 Day Only
                  </span>
                </h3>
                <p className="text-xs text-gray-300 mt-1">
                  Receipt <strong>{serverReceipt.receiptNumber}</strong> is hosted on the backend server and will auto-expire in 24 hours.
                </p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <input
                    type="text"
                    readOnly
                    value={serverReceipt.viewUrl}
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-emerald-300 w-64 sm:w-80 select-all font-mono"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(serverReceipt.viewUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition-colors cursor-pointer"
                  >
                    {copiedLink ? "✓ Copied!" : "📋 Copy 1-Day Link"}
                  </button>
                  <a
                    href={serverReceipt.viewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-white/10 text-white font-medium text-xs hover:bg-white/20 transition-colors"
                  >
                    🔗 Open View Page
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ACTIVE BACKEND SERVER RECEIPTS (VALID 24H) ─── */}
      {recentReceipts.length > 0 && (
        <div className="glass-card p-4 mb-6 rounded-2xl border border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <span>⏱️ Active Server Receipts (1-Day Temporary Storage)</span>
              <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                {recentReceipts.length} Active
              </span>
            </span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {recentReceipts.map((rcp) => {
              const hoursLeft = Math.floor(rcp.remainingMs / (1000 * 60 * 60));
              const minsLeft = Math.floor((rcp.remainingMs % (1000 * 60 * 60)) / (1000 * 60));
              return (
                <div
                  key={rcp.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 text-xs hover:border-amber-500/30 transition-all"
                >
                  <div>
                    <span className="font-bold text-white">{rcp.receiptNumber}</span>
                    <span className="text-gray-400 ml-2">({rcp.customerName})</span>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Total: {rcp.currency} {rcp.totalAmount?.toLocaleString("en-IN")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-amber-400 text-[11px] font-mono font-semibold">
                      ⏳ {hoursLeft}h {minsLeft}m left
                    </span>
                    <a
                      href={rcp.viewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-medium hover:bg-amber-500/30 text-[11px]"
                    >
                      View Receipt
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="receipt-two-columns">
        {/* ─── LEFT: FORM ─── */}
        <div className="receipt-form-col">
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
                  Store Name *
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
                  Store Address *
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
              <div>
                <label className="receipt-label" htmlFor="receipt-store-phone">
                  Phone (optional)
                </label>
                <input
                  id="receipt-store-phone"
                  type="text"
                  className="receipt-input"
                  placeholder="e.g. +91 98765 43210"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                />
              </div>
              <div>
                <label className="receipt-label" htmlFor="receipt-store-gstin">
                  GSTIN (optional)
                </label>
                <input
                  id="receipt-store-gstin"
                  type="text"
                  className="receipt-input"
                  placeholder="e.g. 29ABCDE1234F1Z5"
                  value={storeGSTIN}
                  onChange={(e) => setStoreGSTIN(e.target.value)}
                />
              </div>
            </div>

            {/* Customer name */}
            <div className="mt-4">
              <label className="receipt-label" htmlFor="receipt-customer-name">
                Customer Name (optional)
              </label>
              <input
                id="receipt-customer-name"
                type="text"
                className="receipt-input"
                placeholder="e.g. Priya Sharma"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
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

            <button type="button" className="receipt-add-btn" onClick={addItem}>
              <span className="text-lg">+</span>
              <span>Add Item</span>
            </button>
          </div>

          {/* ─── MAKING CHARGES ─── */}
          <div className="receipt-section" style={{ borderColor: modeTheme.borderCol }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🛠️</span>
              <h3 className="text-base font-bold text-white">Making Charges</h3>
              <span className="text-xs text-gray-500 ml-1">(optional)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="receipt-label">Type</label>
                <div className="flex bg-gray-900/40 rounded-lg p-1 border border-gray-700/50">
                  <button
                    type="button"
                    onClick={() => setMakingChargesType("percentage")}
                    className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                      makingChargesType === "percentage"
                        ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Percentage (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMakingChargesType("flat")}
                    className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                      makingChargesType === "flat"
                        ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    Flat ({currencyObj?.symbol || "₹"})
                  </button>
                </div>
              </div>
              <div>
                <label className="receipt-label">
                  {makingChargesType === "percentage" ? "Percentage" : "Amount"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="receipt-input"
                    placeholder={makingChargesType === "percentage" ? "e.g. 8" : "e.g. 2500"}
                    value={makingChargesValue}
                    onChange={(e) => setMakingChargesValue(e.target.value)}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">
                    {makingChargesType === "percentage" ? "%" : currencyObj?.symbol || "₹"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── RIGHT: LIVE PREVIEW ─── */}
        <div className="receipt-preview-col">
          <div className="receipt-preview-sticky">
            <label className="receipt-label" style={{ marginBottom: "12px", fontSize: "11px" }}>
              📄 Receipt Preview
            </label>

            <div className="receipt-preview-card">
              {/* Decorative top border */}
              <div className="receipt-preview-gold-bar" />

              {/* Header */}
              <div className="receipt-preview-header">
                <div className="receipt-preview-store-name">
                  {storeName || "Your Store Name"}
                </div>
                <div className="receipt-preview-store-address">
                  {storeAddress || "Store Address"}
                </div>
                {storePhone && (
                  <div className="receipt-preview-meta">📞 {storePhone}</div>
                )}
              </div>

              <div className="receipt-preview-divider" />

              {/* Receipt Info */}
              <div className="receipt-preview-info-row">
                <span>Receipt #</span>
                <span className="receipt-preview-info-value">{receiptNumberRef.current}</span>
              </div>
              <div className="receipt-preview-info-row">
                <span>Date</span>
                <span className="receipt-preview-info-value">
                  {new Date().toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="receipt-preview-info-row">
                <span>Mode</span>
                <span className="receipt-preview-info-value">
                  {mode === "cash" ? "Cash" : "Gold"}
                </span>
              </div>
              {customerName && (
                <div className="receipt-preview-info-row">
                  <span>Customer</span>
                  <span className="receipt-preview-info-value">{customerName}</span>
                </div>
              )}

              <div className="receipt-preview-divider receipt-preview-divider-dashed" />

              {/* Items */}
              <div className="receipt-preview-items-header">
                <span className="receipt-preview-items-col-name">Item</span>
                <span className="receipt-preview-items-col-wt">Wt</span>
                <span className="receipt-preview-items-col-purity">Purity</span>
                <span className="receipt-preview-items-col-amt">Amt</span>
              </div>

              {computedItems.map((item, idx) => (
                <div key={item.id} className="receipt-preview-item-row">
                  <span className="receipt-preview-items-col-name receipt-preview-item-name">
                    {item.name || `Item ${idx + 1}`}
                  </span>
                  <span className="receipt-preview-items-col-wt">
                    {item.weightNum > 0 ? `${item.weightNum.toFixed(1)}g` : "—"}
                  </span>
                  <span className="receipt-preview-items-col-purity">{item.purityLabel}</span>
                  <span className="receipt-preview-items-col-amt">
                    {item.price > 0
                      ? `${currencyObj?.symbol || "₹"}${item.price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                      : "—"}
                  </span>
                </div>
              ))}

              <div className="receipt-preview-divider" />

              {/* Subtotal */}
              {makingChargesAmount > 0 && (
                <>
                  <div className="receipt-preview-info-row">
                    <span>Subtotal</span>
                    <span className="receipt-preview-info-value">
                      {formatCurrency(subtotal, currency)}
                    </span>
                  </div>
                  <div className="receipt-preview-info-row">
                    <span>Making Charges</span>
                    <span className="receipt-preview-info-value">
                      {formatCurrency(makingChargesAmount, currency)}
                    </span>
                  </div>
                  <div className="receipt-preview-divider receipt-preview-divider-dashed" />
                </>
              )}

              {/* Total */}
              <div className="receipt-preview-total-row">
                <span>{mode === "cash" ? "Total" : "Pure Gold"}</span>
                <span className="receipt-preview-total-value">
                  {mode === "cash"
                    ? formatCurrency(totalPrice, currency)
                    : `${totalPureWeight.toFixed(3)}g`}
                </span>
              </div>

              {mode === "gold" && totalPrice > 0 && (
                <div className="receipt-preview-info-row" style={{ marginTop: "4px" }}>
                  <span>Cash Value</span>
                  <span className="receipt-preview-info-value">
                    {formatCurrency(totalPrice, currency)}
                  </span>
                </div>
              )}

              <div className="receipt-preview-divider" />

              {/* Footer */}
              <div className="receipt-preview-footer">
                Thank you for your purchase!
              </div>

              {/* Bottom gold bar */}
              <div className="receipt-preview-gold-bar receipt-preview-gold-bar-bottom" />
            </div>
          </div>
        </div>
      </div>

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
