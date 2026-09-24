import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  GOLD_PURITIES,
  CURRENCIES,
  calculatePrice,
  formatCurrency,
} from "../utils/priceUtils";
import { generateReceiptPDF, saveReceiptPDF } from "../utils/receiptPdf";
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
 * ReceiptGenerator — Luxury Jewellery Tax Invoice & Valuation Suite.
 */
export default function ReceiptGenerator({ prices, isFallback }) {
  // ── Mode ─────────────────────────────────────────────
  const [mode, setMode] = useState("cash"); // "cash" | "gold"

  // ── Preview Theme ────────────────────────────────────
  const [previewTheme, setPreviewTheme] = useState("ivory"); // "ivory" | "obsidian"

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

  // ── Validation & Feedback ────────────────────────────
  const [validationError, setValidationError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [lastBlobUrl, setLastBlobUrl] = useState(null);
  const [lastPdfResult, setLastPdfResult] = useState(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // ── Receipt Number ───────────────────────────────────
  const receiptNumberRef = useRef(generateReceiptNumber());

  const currencyObj = CURRENCIES.find((c) => c.code === currency);

  // ── Quick Load Realistic Sample ──────────────────────
  const handleLoadSample = () => {
    setStoreName("Tanishq Heritage Fine Jewellery");
    setStoreAddress("42 Cathedral Road, Fort, Mumbai, Maharashtra 400001");
    setStorePhone("+91 22 2847 9900");
    setStoreGSTIN("27AAACT2849P1ZZ");
    setCustomerName("Ananya Deshmukh");
    setMakingChargesType("percentage");
    setMakingChargesValue("8.5");
    setItems([
      { id: crypto.randomUUID(), name: "22K Royal Temple Choker Necklace", weight: "34.50", purityIndex: 1 },
      { id: crypto.randomUUID(), name: "22K Antique Filigree Bangles (Pair)", weight: "26.20", purityIndex: 1 },
      { id: crypto.randomUUID(), name: "18K Solitaire Floral Ring", weight: "5.80", purityIndex: 2 },
    ]);
    setValidationError(null);
  };

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

  const totalGrossWeight = useMemo(
    () => computedItems.reduce((sum, i) => sum + i.weightNum, 0),
    [computedItems]
  );

  // ── Validation ───────────────────────────────────────
  const validate = useCallback(() => {
    if (!storeName.trim()) return "Please enter your Store / Jeweller Name.";
    if (!storeAddress.trim()) return "Please enter the Store Address.";
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.name.trim()) return `Item ${i + 1}: Please enter the item description.`;
      const w = parseFloat(item.weight);
      if (!w || w <= 0) return `Item ${i + 1}: Please enter a valid weight in grams.`;
    }
    if (basePricePer10g <= 0) return "Gold price is loading. Please wait a moment or enter a custom rate.";
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

    // Refresh receipt number on each generation
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

    if (pdfResult) {
      setLastPdfResult(pdfResult);
      if (pdfResult.pdfBlobUrl) {
        setLastBlobUrl(pdfResult.pdfBlobUrl);
      }
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);

      // Save/share file (handles native Android/iOS APK and web browser)
      try {
        await saveReceiptPDF(pdfResult);
      } catch (saveErr) {
        console.warn("saveReceiptPDF failed:", saveErr);
      }
    }

    // 2. Upload to Backend for 1-Day Storage
    if (pdfResult && pdfResult.pdfBase64) {
      setIsUploading(true);
      try {
        const res = await fetch("/api/receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            receiptNumber: receiptNumberRef.current,
            customerName: customerName.trim() || "Valued Client",
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

  // ── Copy invoice text summary ─────────────────────────
  const handleCopySummary = () => {
    const text = `TAX INVOICE & APPRAISAL REPORT
Store: ${storeName || "Bullion Jewellery"}
Invoice #: ${receiptNumberRef.current}
Client: ${customerName || "Valued Client"}
Total Amount: ${formatCurrency(totalPrice, currency)}
Pure Gold Content: ${totalPureWeight.toFixed(3)}g
Items:
${computedItems.map((i, idx) => `${idx + 1}. ${i.name || "Item"} — ${i.weightNum}g (${i.purityLabel}) = ${formatCurrency(i.price, currency)}`).join("\n")}`;

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 animate-fadeIn">
      {/* ─── LUXURY SUITE HEADER ─── */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-bold uppercase tracking-widest mb-3 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Executive Tax Invoice & Appraisal Suite
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
          Professional Jewellery Billing Report
        </h1>
        <p className="text-sm sm:text-base text-gray-400 max-w-2xl mt-2 font-normal">
          Generate authenticated luxury valuation reports, tax invoices & certificates with instant 1-Day temporary cloud storage and PDF download.
        </p>

        {/* Quick Sample Button */}
        <button
          type="button"
          onClick={handleLoadSample}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 transition-all cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.1)] hover:scale-105 active:scale-95"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          Load Luxury Sample Invoice (1-Click Fill)
        </button>
      </div>

      {/* ─── BACKEND 1-DAY LINK NOTIFICATION BANNER ─── */}
      {serverReceipt && (
        <div className="receipt-card mb-6 border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.15)] animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-emerald-400">
                    Invoice {serverReceipt.receiptNumber} Saved to Cloud
                  </h3>
                  <span className="bg-emerald-500/25 text-emerald-300 text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/40">
                    Live for 24h
                  </span>
                </div>
                <p className="text-xs text-gray-300 mt-0.5">
                  Shareable temporary report link active until tomorrow.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <input
                type="text"
                readOnly
                value={serverReceipt.viewUrl}
                className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-emerald-300 w-full sm:w-64 font-mono select-all"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(serverReceipt.viewUrl);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs transition-colors cursor-pointer shrink-0"
              >
                {copiedLink ? "✓ Copied" : "Copy Link"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (lastPdfResult) {
                    await saveReceiptPDF(lastPdfResult);
                  } else {
                    window.open(`${serverReceipt.pdfUrl}?download=1`, "_blank");
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <span>⬇️</span> Download PDF
              </button>
              {lastBlobUrl && (
                <button
                  type="button"
                  onClick={() => window.open(lastBlobUrl, "_blank")}
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors shrink-0"
                >
                  👁️ Open Tab
                </button>
              )}
              <a
                href={serverReceipt.viewUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors shrink-0"
              >
                Open View ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ─── ACTIVE SERVER RECEIPTS DRAWER ─── */}
      {recentReceipts.length > 0 && (
        <div className="receipt-card mb-6 py-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Active Server Invoices ({recentReceipts.length})
            </span>
            <span className="text-[11px] text-gray-500">Auto-expires in 24 hours</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
            {recentReceipts.map((rcp) => {
              const hoursLeft = Math.floor(rcp.remainingMs / (1000 * 60 * 60));
              const minsLeft = Math.floor((rcp.remainingMs % (1000 * 60 * 60)) / (1000 * 60));
              return (
                <div
                  key={rcp.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-amber-500/30 text-xs transition-all"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-white truncate">{rcp.receiptNumber}</div>
                    <div className="text-[11px] text-gray-400 truncate">{rcp.customerName} • {rcp.currency} {rcp.totalAmount?.toLocaleString("en-IN")}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded">
                      {hoursLeft}h {minsLeft}m
                    </span>
                    <a
                      href={rcp.viewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-[11px]"
                    >
                      View
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TWO COLUMN MAIN LAYOUT ─── */}
      <div className="receipt-layout">
        {/* ─── LEFT: FORM CONFIGURATION ─── */}
        <div className="receipt-form-col">
          {/* MODE TOGGLE */}
          <div className="receipt-card">
            <div className="receipt-card-header">
              <div className="receipt-card-title">
                <span className="receipt-icon-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v12M17 10l-5-4-5 4" />
                  </svg>
                </span>
                Valuation Mode
              </div>
              <span className="text-xs text-gray-400 font-medium">Select output style</span>
            </div>

            <div className="receipt-mode-toggle">
              <button
                type="button"
                className={`receipt-mode-btn ${mode === "cash" ? "active-cash" : ""}`}
                onClick={() => setMode("cash")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <circle cx="12" cy="12" r="2" />
                  <path d="M6 12h.01M18 12h.01" />
                </svg>
                Cash Billing Mode
              </button>
              <button
                type="button"
                className={`receipt-mode-btn ${mode === "gold" ? "active-gold" : ""}`}
                onClick={() => setMode("gold")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                Pure Gold Mode
              </button>
            </div>

            <div className="mt-3 px-3.5 py-2 rounded-xl text-xs text-gray-400 bg-white/[0.02] border border-white/5 flex items-center gap-2">
              <span className="text-amber-400 font-bold">ℹ</span>
              {mode === "cash"
                ? "Computes total invoice price in selected currency based on weight, purity, and making charges."
                : "Calculates total pure 24K equivalent weight alongside estimated currency valuation."}
            </div>
          </div>

          {/* STORE & JEWELLER DETAILS */}
          <div className="receipt-card">
            <div className="receipt-card-header">
              <div className="receipt-card-title">
                <span className="receipt-icon-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </span>
                Jeweller / Store Details
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="receipt-field">
                <label className="receipt-label" htmlFor="receipt-store-name">
                  Store Name <span className="text-amber-400">*</span>
                </label>
                <input
                  id="receipt-store-name"
                  type="text"
                  className="receipt-input"
                  placeholder="e.g. Tanishq Heritage Jewellers"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                />
                {submitted && !storeName.trim() && (
                  <p className="text-red-400 text-[11px] mt-1">Store Name is required</p>
                )}
              </div>

              <div className="receipt-field">
                <label className="receipt-label" htmlFor="receipt-store-address">
                  Store Address <span className="text-amber-400">*</span>
                </label>
                <input
                  id="receipt-store-address"
                  type="text"
                  className="receipt-input"
                  placeholder="e.g. Cathedral Road, Mumbai"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                />
                {submitted && !storeAddress.trim() && (
                  <p className="text-red-400 text-[11px] mt-1">Store Address is required</p>
                )}
              </div>

              <div className="receipt-field">
                <label className="receipt-label" htmlFor="receipt-store-phone">
                  Contact / Phone <span className="receipt-label-optional">(optional)</span>
                </label>
                <input
                  id="receipt-store-phone"
                  type="text"
                  className="receipt-input"
                  placeholder="e.g. +91 22 2847 9900"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                />
              </div>

              <div className="receipt-field">
                <label className="receipt-label" htmlFor="receipt-store-gstin">
                  GSTIN / Tax ID <span className="receipt-label-optional">(optional)</span>
                </label>
                <input
                  id="receipt-store-gstin"
                  type="text"
                  className="receipt-input"
                  placeholder="e.g. 27AAACT2849P1ZZ"
                  value={storeGSTIN}
                  onChange={(e) => setStoreGSTIN(e.target.value)}
                />
              </div>

              <div className="receipt-field sm:col-span-2">
                <label className="receipt-label" htmlFor="receipt-customer-name">
                  Customer / Client Name <span className="receipt-label-optional">(optional)</span>
                </label>
                <input
                  id="receipt-customer-name"
                  type="text"
                  className="receipt-input"
                  placeholder="e.g. Ananya Deshmukh"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* CURRENCY & BENCHMARK RATE */}
          <div className="receipt-card">
            <div className="receipt-card-header">
              <div className="receipt-card-title">
                <span className="receipt-icon-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="8" />
                    <line x1="12" y1="2" x2="12" y2="4" />
                    <line x1="12" y1="20" x2="12" y2="22" />
                    <line x1="2" y1="12" x2="4" y2="12" />
                    <line x1="20" y1="12" x2="22" y2="12" />
                  </svg>
                </span>
                Gold Benchmark Rate
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="receipt-field">
                <label className="receipt-label" htmlFor="receipt-currency">
                  Billing Currency
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

              <div className="receipt-field">
                <label className="receipt-label">
                  Effective Base Price (per 10g)
                </label>
                <div className="receipt-input flex items-center justify-between bg-black/40 border-amber-500/30">
                  <span className="text-sm font-bold text-amber-400">
                    {basePricePer10g > 0
                      ? formatCurrency(basePricePer10g, currency)
                      : "Loading rates…"}
                  </span>
                  {priceSource === "manual" && (
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Custom Override
                    </span>
                  )}
                  {priceSource === "fallback" && (
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Benchmark
                    </span>
                  )}
                  {priceSource === "api" && (
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Live Market
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Custom rate override button */}
            <div className="mt-4 pt-3 border-t border-white/5">
              <button
                type="button"
                id="receipt-manual-price-toggle"
                onClick={handleToggleManual}
                className="inline-flex items-center gap-2.5 text-xs font-semibold text-gray-300 hover:text-white cursor-pointer transition-colors"
              >
                <span
                  className="relative inline-block w-8 h-[18px] rounded-full transition-colors duration-300"
                  style={{ background: isManual ? "#f59e0b" : "rgba(255,255,255,0.15)" }}
                >
                  <span
                    className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform duration-300"
                    style={{ left: isManual ? "15px" : "2px" }}
                  />
                </span>
                Custom Gold Price Override
              </button>

              {isManual && (
                <div className="mt-3 animate-fadeIn">
                  <div className="relative">
                    <input
                      id="receipt-manual-price-input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Enter custom rate per 10g (e.g. 74500)…"
                      value={manualPrice}
                      onChange={handleManualPriceChange}
                      className="receipt-input pr-16 border-amber-500/40"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold font-mono">
                      {currencyObj?.symbol || "₹"}/10g
                    </span>
                  </div>
                  {manualError && (
                    <p className="text-red-400 text-xs mt-1.5 ml-1">{manualError}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* JEWELLERY ITEMS */}
          <div className="receipt-card">
            <div className="receipt-card-header">
              <div className="receipt-card-title">
                <span className="receipt-icon-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                </span>
                Appraisal & Jewellery Items ({items.length})
              </div>
              <span className="text-xs text-gray-400 font-mono">
                Total Wt: {totalGrossWeight.toFixed(2)}g
              </span>
            </div>

            <div className="space-y-3 mb-4">
              {items.map((item, idx) => (
                <div key={item.id} className="receipt-item-card">
                  <div className="receipt-item-grid">
                    <div className="receipt-field">
                      <label className="receipt-label">
                        Item {idx + 1} Description
                      </label>
                      <input
                        type="text"
                        className="receipt-input"
                        placeholder="e.g. 22K Gold Bridal Choker"
                        value={item.name}
                        onChange={(e) => updateItem(item.id, "name", e.target.value)}
                      />
                    </div>

                    <div className="receipt-field">
                      <label className="receipt-label">Gross Wt (g)</label>
                      <input
                        type="number"
                        className="receipt-input"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        value={item.weight}
                        onChange={(e) => updateItem(item.id, "weight", e.target.value)}
                      />
                    </div>

                    <div className="receipt-field">
                      <label className="receipt-label">Hallmark / Purity</label>
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
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>

                  {submitted && (!item.name.trim() || !(parseFloat(item.weight) > 0)) && (
                    <p className="text-red-400 text-xs mt-2 ml-1">
                      Please enter both a valid description and positive weight for this item.
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button type="button" className="receipt-add-btn" onClick={addItem}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Additional Jewellery Item
            </button>
          </div>

          {/* MAKING & CRAFTING CHARGES */}
          <div className="receipt-card">
            <div className="receipt-card-header">
              <div className="receipt-card-title">
                <span className="receipt-icon-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </span>
                Making Charges / Wastage
              </div>
              <span className="text-xs text-gray-500">(Optional)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="receipt-field">
                <label className="receipt-label">Charge Type</label>
                <div className="flex bg-black/40 rounded-xl p-1 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setMakingChargesType("percentage")}
                    className={`flex-1 px-3 py-2 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${
                      makingChargesType === "percentage"
                        ? "bg-amber-500/20 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)] border border-amber-500/30"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Percentage (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMakingChargesType("flat")}
                    className={`flex-1 px-3 py-2 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${
                      makingChargesType === "flat"
                        ? "bg-amber-500/20 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)] border border-amber-500/30"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Flat ({currencyObj?.symbol || "₹"})
                  </button>
                </div>
              </div>

              <div className="receipt-field">
                <label className="receipt-label">
                  {makingChargesType === "percentage" ? "Percentage Rate" : "Lump Sum Amount"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="receipt-input pr-12"
                    placeholder={makingChargesType === "percentage" ? "e.g. 8.5" : "e.g. 3500"}
                    value={makingChargesValue}
                    onChange={(e) => setMakingChargesValue(e.target.value)}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">
                    {makingChargesType === "percentage" ? "%" : currencyObj?.symbol || "₹"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── RIGHT: LIVE LUXURY REPORT PREVIEW ─── */}
        <div className="receipt-preview-col">
          <div className="receipt-preview-sticky">
            <div className="report-preview-toolbar">
              <div className="report-preview-tag">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4l3 3" />
                </svg>
                Live Document Preview
              </div>

              {/* Theme selector */}
              <div className="report-theme-pills">
                <button
                  type="button"
                  onClick={() => setPreviewTheme("ivory")}
                  className={`report-theme-btn ${previewTheme === "ivory" ? "active" : ""}`}
                >
                  📜 Ivory Parchment
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTheme("obsidian")}
                  className={`report-theme-btn ${previewTheme === "obsidian" ? "active" : ""}`}
                >
                  ✨ Obsidian Dark
                </button>
              </div>
            </div>

            {/* ── MASTERPIECE INVOICE SHEET ── */}
            <div className={`report-sheet theme-${previewTheme}`}>
              <div className="report-gold-bar" />

              <div className="report-sheet-inner-border">
                {/* Watermark Seal */}
                <div className="report-watermark-seal">BULLION</div>

                {/* Header */}
                <div className="report-header">
                  <div className="report-crest">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                  <h2 className="report-store-title">
                    {storeName || "ROYAL HERITAGE JEWELLERS"}
                  </h2>
                  <div className="report-store-subtitle">
                    {storeAddress || "Official Bullion & Certified Jewellery Valuation Centre"}
                  </div>
                  {(storePhone || storeGSTIN) && (
                    <div className="report-store-contacts">
                      {storePhone && <span>Tel: {storePhone}</span>}
                      {storePhone && storeGSTIN && <span> • </span>}
                      {storeGSTIN && <span>GSTIN: {storeGSTIN}</span>}
                    </div>
                  )}
                </div>

                {/* Official Ribbon */}
                <div className="report-document-ribbon">
                  <span className="report-ribbon-title">
                    TAX INVOICE & APPRAISAL CERTIFICATE
                  </span>
                  <span className="report-hallmark-badge">
                    ✓ BIS HALLMARK
                  </span>
                </div>

                {/* Metadata Grid */}
                <div className="report-meta-grid">
                  <div className="report-meta-item">
                    <span className="report-meta-label">Invoice Ref</span>
                    <span className="report-meta-val font-mono">{receiptNumberRef.current}</span>
                  </div>
                  <div className="report-meta-item">
                    <span className="report-meta-label">Date Issued</span>
                    <span className="report-meta-val">
                      {new Date().toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="report-meta-item">
                    <span className="report-meta-label">Valuation Mode</span>
                    <span className="report-meta-val">
                      {mode === "cash" ? "Cash Settlement" : "Pure Gold Valuation"}
                    </span>
                  </div>
                  <div className="report-meta-item">
                    <span className="report-meta-label">Valued Client</span>
                    <span className="report-meta-val truncate max-w-[130px]">
                      {customerName || "Valued Client"}
                    </span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="report-table-wrapper overflow-x-auto">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th style={{ width: "24px" }}>#</th>
                        <th>Item Description</th>
                        <th className="col-center">Wt (g)</th>
                        <th className="col-center">Purity</th>
                        <th className="col-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computedItems.map((item, idx) => (
                        <tr key={item.id}>
                          <td>{idx + 1}</td>
                          <td>
                            <div className="font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[140px]">
                              {item.name || `Jewellery Item ${idx + 1}`}
                            </div>
                            <div className="text-[9px] text-gray-500 font-mono">
                              Pure: {item.pureWeight.toFixed(2)}g
                            </div>
                          </td>
                          <td className="col-center font-mono font-medium">
                            {item.weightNum > 0 ? `${item.weightNum.toFixed(2)}g` : "—"}
                          </td>
                          <td className="col-center">
                            <span className="report-purity-pill">
                              {item.purityLabel}
                            </span>
                          </td>
                          <td className="col-right font-mono">
                            {item.price > 0
                              ? `${currencyObj?.symbol || "₹"}${Math.round(item.price).toLocaleString("en-IN")}`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary */}
                <div className="report-summary-box">
                  <div className="report-summary-row">
                    <span>Subtotal:</span>
                    <span className="font-mono font-bold">
                      {formatCurrency(subtotal, currency)}
                    </span>
                  </div>

                  {makingChargesAmount > 0 && (
                    <div className="report-summary-row">
                      <span>Making & Crafting:</span>
                      <span className="font-mono font-semibold">
                        +{formatCurrency(makingChargesAmount, currency)}
                      </span>
                    </div>
                  )}

                  <div className="report-summary-row total-row">
                    <span>{mode === "cash" ? "Grand Total:" : "Pure Gold Equiv:"}</span>
                    <span className="report-total-amount">
                      {mode === "cash"
                        ? formatCurrency(totalPrice, currency)
                        : `${totalPureWeight.toFixed(3)}g`}
                    </span>
                  </div>

                  {mode === "gold" && totalPrice > 0 && (
                    <div className="report-summary-row text-[9.5px] mt-1 text-gray-400">
                      <span>Equivalent Value:</span>
                      <span className="font-mono">{formatCurrency(totalPrice, currency)}</span>
                    </div>
                  )}
                </div>

                {/* Declaration & Authorized Stamp */}
                <div className="report-footer-section">
                  <div className="report-declaration">
                    Certified authentic precious metal appraisal under statutory BIS standards. Computer generated document valid without physical seal.
                  </div>

                  <div className="report-signature-block">
                    <div className="report-signature-seal">
                      <span>AUTHORIZED<br />VERIFIED</span>
                    </div>
                    <div className="report-signature-line">
                      Authorised Signatory
                    </div>
                  </div>
                </div>
              </div>

              <div className="report-gold-bar" />
            </div>

            {/* Quick Actions Bar */}
            <div className="report-action-bar">
              <button
                type="button"
                onClick={async () => {
                  if (lastPdfResult) {
                    await saveReceiptPDF(lastPdfResult);
                  } else {
                    handleGenerate();
                  }
                }}
                disabled={isUploading}
                className="report-btn-secondary"
                title="Download PDF"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </button>

              {lastBlobUrl && (
                <button
                  type="button"
                  onClick={() => window.open(lastBlobUrl, "_blank")}
                  className="report-btn-secondary"
                  title="Open PDF in new tab"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  View Tab
                </button>
              )}

              <button
                type="button"
                onClick={() => window.print()}
                className="report-btn-secondary"
                title="Print Invoice"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print
              </button>

              <button
                type="button"
                onClick={handleCopySummary}
                className="report-btn-secondary"
                title="Copy textual summary to clipboard"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                {copiedSummary ? "✓ Copied" : "Copy"}
              </button>
            </div>

            {/* Error Message */}
            {validationError && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2 animate-fadeIn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{validationError}</span>
              </div>
            )}

            {/* Generate PDF CTA */}
            <button
              type="button"
              className="report-generate-cta"
              onClick={handleGenerate}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Generating & Saving Cloud Report…</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  Generate Official PDF & 1-Day Cloud Link
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
