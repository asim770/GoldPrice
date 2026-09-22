import { useState, useEffect, useMemo, useRef } from "react";
import {
  GOLD_PURITIES,
  SILVER_PURITIES,
  CURRENCIES,
  BULLION_CITIES,
  searchBullionCities,
  calculateFullBreakdown,
  formatCurrency,
  formatLastUpdated,
} from "../utils/priceUtils";

export default function PriceCalculator({
  activeTab = "gold",
  setActiveTab,
  prices,
  loading,
  lastUpdated,
  location = "Mumbai, India",
  date = new Date().toISOString().split("T")[0],
  onRefresh,
  onNavigateToReceipt,
}) {
  const isGold = activeTab === "gold";

  // ── Calculator State ──────────────────────────────────
  const [selectedPurity, setSelectedPurity] = useState(0);
  const [weight, setWeight]                 = useState("10"); // Default 10g / 1 Tola
  const [currency, setCurrency]             = useState("INR");

  // Optional GST and Making Charges
  const [includeGst, setIncludeGst]               = useState(true);
  const [includeMaking, setIncludeMaking]         = useState(false);
  const [makingChargeValue, setMakingChargeValue] = useState("10"); // 10% default

  // ── Place Search State ────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef(null);
  const dropdownRef    = useRef(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Quick popular cities
  const popularCities = ["Mumbai", "Delhi", "Kolkata", "Chennai", "Jaipur", "Dubai"];

  // Suggestions for autocomplete
  const citySuggestions = useMemo(() => {
    if (!searchQuery.trim()) return BULLION_CITIES.slice(0, 6);
    return searchBullionCities(searchQuery).slice(0, 8);
  }, [searchQuery]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target)
      ) {
        setIsSearching(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectPlace = (placeName) => {
    setIsSearching(false);
    setSearchQuery("");
    if (onRefresh) onRefresh(placeName, date);
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    const matched = BULLION_CITIES.find(
      (c) => c.name.toLowerCase() === q.toLowerCase()
    );
    const finalLocation = matched
      ? `${matched.name}, ${matched.country}`
      : q.includes(",")
      ? q
      : `${q}, India`;

    handleSelectPlace(finalLocation);
  };

  const purities = isGold ? GOLD_PURITIES : SILVER_PURITIES;

  // Reset purity index when switching metal
  useEffect(() => {
    setSelectedPurity(0);
  }, [activeTab]);

  // ── Derived Market Values ──────────────────────────────
  const gold24k = prices?.gold?.INR || 154750;
  const gold22k = prices?.gold?.INR_22k || Math.round(gold24k * (22 / 24));
  const gold18k = prices?.gold?.INR_18k || Math.round(gold24k * (18 / 24));
  const goldPerGram = Math.round(gold24k / 10);

  const silver10g = prices?.silver?.INR || 2500;
  const silverKg = prices?.silver?.INR_kg || Math.round(silver10g * 100);
  const silver925 = prices?.silver?.INR_925 || Math.round(silver10g * 0.925);
  const silverPerGram = Math.round((silver10g / 10) * 10) / 10;

  const basePricePer10g = isGold ? gold24k : silver10g;
  const activePurityMultiplier = purities[selectedPurity]?.value || 1.0;
  const activePurityLabel = purities[selectedPurity]?.label || "";

  // Breakdown calculations
  const breakdown = useMemo(() => {
    const w = parseFloat(weight);
    return calculateFullBreakdown({
      pricePer10g: basePricePer10g,
      purityMultiplier: activePurityMultiplier,
      weightInGrams: isNaN(w) || w <= 0 ? 0 : w,
      makingChargeType: "percentage",
      makingChargeValue: includeMaking ? makingChargeValue : 0,
      includeGst,
      gstRate: 3.0,
    });
  }, [basePricePer10g, activePurityMultiplier, weight, includeMaking, makingChargeValue, includeGst]);

  const handleCopyQuote = () => {
    const text = `Bullion Quote: ${isGold ? "Gold" : "Silver"} (${activePurityLabel})
Location: ${location}
Rate: ${formatCurrency(breakdown.ratePerGram * 10, currency)}/10g (${formatCurrency(breakdown.ratePerGram, currency)}/g)
Weight: ${weight}g
Base Metal Cost: ${formatCurrency(breakdown.baseMetal, currency)}
${includeGst ? `GST (3%): ${formatCurrency(breakdown.gstAmount, currency)}\n` : ""}Total: ${formatCurrency(breakdown.grandTotal, currency)}`;

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const theme = isGold
    ? {
        accent: "#f59e0b",
        gradient: "linear-gradient(135deg, #fbbf24, #d97706)",
        textClass: "gradient-text-gold",
        emoji: "🥇",
        metalName: "Gold",
      }
    : {
        accent: "#94a3b8",
        gradient: "linear-gradient(135deg, #f1f5f9, #64748b)",
        textClass: "gradient-text-silver",
        emoji: "🥈",
        metalName: "Silver",
      };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ─────────────────────────────────────────────────────────────────
          1. CLEAN PLACE SEARCH BAR & CITY CHIPS
      ─────────────────────────────────────────────────────────────────── */}
      <div className="ios-glass p-5 sm:p-6 relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse-live" />
            <span className="text-sm font-bold text-white tracking-tight">
              {location}
            </span>
            <span className="text-xs text-gray-500">&bull;</span>
            <span className="text-xs text-gray-400 font-medium">
              Updated {formatLastUpdated(lastUpdated)}
            </span>
          </div>

          {onRefresh && (
            <button
              onClick={() => onRefresh(location, date)}
              disabled={loading}
              className="ios-btn-glass px-3 py-1 rounded-full text-xs font-semibold text-gray-300 hover:text-white flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin text-amber-400" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{loading ? "Updating…" : "Refresh Rates"}</span>
            </button>
          )}
        </div>

        {/* Clean Search Input */}
        <div className="relative">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <span className="absolute left-4 text-gray-400 pointer-events-none">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>

            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearching(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearching(true);
              }}
              placeholder="Search place (e.g. Kolkata, Jaipur, Delhi, Surat, Dubai)..."
              className="ios-input w-full rounded-full pl-11 pr-24 py-3 text-sm text-white placeholder-gray-500 outline-none transition-all"
            />

            <button
              type="submit"
              disabled={loading}
              className="absolute right-1.5 ios-btn-primary px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              {loading ? "…" : "Search"}
            </button>
          </form>

          {/* Autocomplete Dropdown */}
          {isSearching && (
            <div
              ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl bg-[#0b0e17]/95 border border-white/[0.14] shadow-2xl backdrop-blur-2xl overflow-hidden"
            >
              {citySuggestions.map((c) => (
                <div
                  key={c.name}
                  onClick={() => handleSelectPlace(`${c.name}, ${c.country}`)}
                  className="px-4 py-2.5 hover:bg-white/[0.08] flex items-center justify-between cursor-pointer text-xs border-b border-white/[0.03] last:border-0"
                >
                  <div className="font-semibold text-white">
                    {c.name}, <span className="text-gray-400 font-normal">{c.state || c.country}</span>
                  </div>
                  <div className="text-[11px] text-amber-400/80">{c.hub}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Minimal City Chips */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap text-xs">
          <span className="text-[11px] text-gray-500 font-medium mr-1">Popular:</span>
          {popularCities.map((city) => {
            const isSelected = location.toLowerCase().includes(city.toLowerCase());
            return (
              <button
                key={city}
                type="button"
                onClick={() => handleSelectPlace(`${city}, ${city === "Dubai" ? "UAE" : "India"}`)}
                className={`px-3 py-1 rounded-full font-medium transition-all cursor-pointer ${
                  isSelected
                    ? "bg-amber-400 text-black font-bold shadow-md shadow-amber-400/20"
                    : "ios-btn-glass text-gray-300 hover:text-white"
                }`}
              >
                {city}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          2. CLEAN SIDE-BY-SIDE GOLD & SILVER CARDS
      ─────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ─── GOLD CARD ─── */}
        <div
          onClick={() => setActiveTab && setActiveTab("gold")}
          className={`ios-glass p-6 sm:p-7 cursor-pointer relative overflow-hidden transition-all duration-300 ${
            isGold ? "ios-gold-card scale-[1.01]" : "hover:border-white/[0.2]"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🥇</span>
              <div>
                <h3 className="text-base font-extrabold text-white">Gold 24K</h3>
                <span className="text-xs text-gray-400 font-medium">99.9% Pure Hallmark</span>
              </div>
            </div>
            {isGold && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400 text-black">
                Active
              </span>
            )}
          </div>

          <div className="mb-4">
            <div className="text-3xl sm:text-4xl font-black gradient-text-gold tracking-tight">
              {formatCurrency(gold24k, "INR")}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {formatCurrency(goldPerGram, "INR")} per gram
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.08] text-xs">
            <div className="bg-black/25 p-2.5 rounded-xl border border-white/[0.06]">
              <div className="text-gray-400 text-[10px] uppercase font-bold">22K Hallmark</div>
              <div className="text-sm font-bold text-white mt-0.5">{formatCurrency(gold22k, "INR")}</div>
            </div>
            <div className="bg-black/25 p-2.5 rounded-xl border border-white/[0.06]">
              <div className="text-gray-400 text-[10px] uppercase font-bold">18K Jewelry</div>
              <div className="text-sm font-bold text-white mt-0.5">{formatCurrency(gold18k, "INR")}</div>
            </div>
          </div>
        </div>

        {/* ─── SILVER CARD ─── */}
        <div
          onClick={() => setActiveTab && setActiveTab("silver")}
          className={`ios-glass p-6 sm:p-7 cursor-pointer relative overflow-hidden transition-all duration-300 ${
            !isGold ? "ios-silver-card scale-[1.01]" : "hover:border-white/[0.2]"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🥈</span>
              <div>
                <h3 className="text-base font-extrabold text-white">Silver 999</h3>
                <span className="text-xs text-gray-400 font-medium">Fine Silver Bullion</span>
              </div>
            </div>
            {!isGold && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-black">
                Active
              </span>
            )}
          </div>

          <div className="mb-4">
            <div className="text-3xl sm:text-4xl font-black gradient-text-silver tracking-tight">
              {formatCurrency(silver10g, "INR")}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {formatCurrency(silverPerGram, "INR")} per gram
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.08] text-xs">
            <div className="bg-black/25 p-2.5 rounded-xl border border-white/[0.06]">
              <div className="text-gray-400 text-[10px] uppercase font-bold">1kg Bullion Bar</div>
              <div className="text-sm font-bold text-white mt-0.5">{formatCurrency(silverKg, "INR")}</div>
            </div>
            <div className="bg-black/25 p-2.5 rounded-xl border border-white/[0.06]">
              <div className="text-gray-400 text-[10px] uppercase font-bold">925 Sterling</div>
              <div className="text-sm font-bold text-white mt-0.5">{formatCurrency(silver925, "INR")}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          3. CLEAN PRECISION CALCULATOR
      ─────────────────────────────────────────────────────────────────── */}
      <div className="ios-glass p-6 sm:p-8">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <span className="text-xl">{theme.emoji}</span>
            <h2 className="text-lg font-bold text-white">
              {theme.metalName} Calculator
            </h2>
          </div>

          <div className="ios-segmented flex p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab && setActiveTab("gold")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                isGold ? "bg-amber-400 text-black shadow" : "text-gray-400 hover:text-white"
              }`}
            >
              Gold
            </button>
            <button
              type="button"
              onClick={() => setActiveTab && setActiveTab("silver")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                !isGold ? "bg-slate-200 text-black shadow" : "text-gray-400 hover:text-white"
              }`}
            >
              Silver
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Inputs */}
          <div className="lg:col-span-7 space-y-6">
            {/* Purity Selection */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2.5">
                Select Purity
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {purities.map((p, idx) => {
                  const isSelected = selectedPurity === idx;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setSelectedPurity(idx)}
                      className={`p-3 rounded-xl text-center transition-all cursor-pointer ${
                        isSelected
                          ? "bg-white/[0.12] border border-amber-400/50 shadow-md text-white font-bold"
                          : "ios-btn-glass text-gray-300"
                      }`}
                    >
                      <div className="text-base font-extrabold" style={{ color: isSelected ? theme.accent : "#fff" }}>
                        {p.label}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{p.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Weight Input */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
                Weight (Grams)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter weight in grams…"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="ios-input w-full rounded-xl px-4 py-3 text-lg font-black text-white outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">
                  Grams
                </span>
              </div>

              {/* Weight Chips */}
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                {[1, 8, 10, 50, 100].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setWeight(g.toString())}
                    className="ios-btn-glass px-3 py-1 rounded-full text-xs font-semibold text-gray-300 hover:text-white cursor-pointer"
                  >
                    {g}g
                  </button>
                ))}
              </div>
            </div>

            {/* Clean Checkbox Options */}
            <div className="flex items-center gap-6 pt-2 text-xs font-medium text-gray-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeGst}
                  onChange={(e) => setIncludeGst(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                />
                <span>Include 3% GST</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMaking}
                  onChange={(e) => setIncludeMaking(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                />
                <span>Making Charges ({makingChargeValue}%)</span>
              </label>
            </div>
          </div>

          {/* Right Column: Total & Receipt */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div className="p-6 rounded-2xl bg-black/40 border border-white/[0.1] shadow-inner space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Purity:</span>
                <span className="font-bold text-white">{activePurityLabel} {theme.metalName}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Metal Value ({weight || 0}g):</span>
                <span className="font-bold text-white">{formatCurrency(breakdown.baseMetal, currency)}</span>
              </div>
              {includeMaking && (
                <div className="flex items-center justify-between text-xs text-amber-300">
                  <span>Making ({makingChargeValue}%):</span>
                  <span className="font-bold">+{formatCurrency(breakdown.makingCharges, currency)}</span>
                </div>
              )}
              {includeGst && (
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span>GST (3%):</span>
                  <span className="font-bold">+{formatCurrency(breakdown.gstAmount, currency)}</span>
                </div>
              )}

              <div className="pt-3 border-t border-white/[0.08]">
                <div className="text-[11px] uppercase font-bold tracking-wider text-gray-400">Total Payable</div>
                <div className={`text-3xl sm:text-4xl font-black ${theme.textClass} tracking-tight mt-0.5`}>
                  {formatCurrency(breakdown.grandTotal, currency)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {onNavigateToReceipt && (
                <button
                  type="button"
                  onClick={onNavigateToReceipt}
                  className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-400 to-emerald-500 text-black hover:opacity-95 shadow-md shadow-emerald-500/20 active:scale-[0.98] cursor-pointer"
                >
                  Generate Invoice / Receipt
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyQuote}
                className="ios-btn-glass w-full py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white cursor-pointer"
              >
                {copySuccess ? "✓ Copied!" : "Copy Summary Quote"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
