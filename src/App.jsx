import { useState, useEffect, useCallback } from "react";
import Navbar from "./components/Navbar";
import PriceCalculator from "./components/PriceCalculator";
import ReceiptGenerator from "./components/ReceiptGenerator";
import { fetchPricesWithFallback } from "./utils/priceFallback";
import "./App.css";

/** Auto-refresh interval (5 minutes) */
const REFRESH_INTERVAL = 5 * 60 * 1000;

/**
 * Root application component.
 * Manages global state with Apple iPhone 17 UI / Liquid Glass design architecture.
 */
function App() {
  const todayStr = new Date().toISOString().split("T")[0];
  const [activePage, setActivePage]         = useState("calculator"); // "calculator" | "receipt"
  const [activeTab, setActiveTab]           = useState("gold"); // "gold" | "silver"
  const [location, setLocation]             = useState("Mumbai, India");
  const [date, setDate]                     = useState(todayStr);
  const [prices, setPrices]                 = useState(null);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState(null);
  const [lastUpdated, setLastUpdated]       = useState(null);
  const [isFallback, setIsFallback]         = useState(false);
  const [fallbackReason, setFallbackReason] = useState(null);

  // ── Fetch prices (Gemini search-grounded pipeline with city fallback) ──
  const loadPrices = useCallback(async (targetLoc = location, targetDate = date) => {
    setLoading(true);
    setError(null);
    if (targetLoc !== undefined) setLocation(targetLoc);
    if (targetDate !== undefined) setDate(targetDate);

    try {
      const data = await fetchPricesWithFallback(targetLoc, targetDate);
      setPrices(data);
      setLastUpdated(data.fetchedAt);
      setIsFallback(data.isFallback);
      setFallbackReason(data.fallbackReason || null);

      if (data.isFallback) {
        setError(data.fallbackReason || "Using city benchmark market rates.");
      }
    } catch (e) {
      setError(e.message || "Failed to load market rates.");
    } finally {
      setLoading(false);
    }
  }, [location, date]);

  // Fetch on mount
  useEffect(() => {
    loadPrices(location, date);
  }, []);

  // Auto-refresh every 5 min
  useEffect(() => {
    const id = setInterval(() => loadPrices(location, date), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [loadPrices, location, date]);

  return (
    <div className="min-h-screen relative overflow-x-hidden text-[#f5f5f7] selection:bg-amber-500/30 selection:text-amber-200" style={{ background: "#030509" }}>
      {/* ─────────────────────────────────────────────────────────────
          LIQUID AURORA BACKDROP (REFRACTED BY FROSTED GLASS PANELS)
      ─────────────────────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Amber / Gold Glowing Liquid Orb */}
        <div
          className="absolute -top-32 -left-20 w-[620px] h-[620px] rounded-full blur-[140px] opacity-30 animate-aurora-1"
          style={{
            background: "radial-gradient(circle, #f59e0b 0%, #d97706 45%, transparent 70%)",
          }}
        />

        {/* Deep Cosmic Indigo / Violet Orb */}
        <div
          className="absolute top-1/4 -right-32 w-[720px] h-[720px] rounded-full blur-[160px] opacity-25 animate-aurora-2"
          style={{
            background: "radial-gradient(circle, #6366f1 0%, #4338ca 50%, transparent 70%)",
          }}
        />

        {/* Platinum Silver / Cyan Luminous Orb */}
        <div
          className="absolute bottom-10 left-1/3 w-[560px] h-[560px] rounded-full blur-[150px] opacity-20 animate-aurora-3"
          style={{
            background: "radial-gradient(circle, #38bdf8 0%, #0284c7 40%, transparent 70%)",
          }}
        />

        {/* Top ambient radial spotlight */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[550px]"
          style={{
            background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(245, 158, 11, 0.08) 0%, transparent 70%)",
          }}
        />

        {/* Subtle Apple-style nano-texture grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.8) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MAIN FOREGROUND CONTENT
      ─────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Pinned Fixed Floating Navbar */}
        <Navbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activePage={activePage}
          onPageChange={setActivePage}
          prices={prices}
          loading={loading}
          onRefresh={() => loadPrices(location, date)}
        />

        {/* Content with top padding so fixed navbar never obstructs cards */}
        <main className="flex-1 pt-20 sm:pt-24 pb-10">
          {activePage === "calculator" ? (
            <PriceCalculator
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              prices={prices}
              loading={loading}
              error={error}
              lastUpdated={lastUpdated}
              location={location}
              date={date}
              onRefresh={(loc, d) => loadPrices(loc, d)}
              isFallback={isFallback}
              fallbackReason={fallbackReason}
              onNavigateToReceipt={() => setActivePage("receipt")}
            />
          ) : (
            <ReceiptGenerator
              prices={prices}
              location={location}
              date={date}
              isFallback={isFallback}
            />
          )}
        </main>

        {/* Apple-style Minimal Glass Footer */}
        <footer className="mt-auto border-t border-white/[0.07] py-6 px-4 backdrop-blur-xl bg-black/20 text-center text-xs text-gray-400">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-live" />
              <span className="font-medium text-gray-300">
                BullionDesk Pro &bull; Real-time Gemini 2.5 Flash Grounding
              </span>
            </div>
            <div className="text-gray-500 text-[11px]">
              Designed with Liquid Glass UI &bull; Indicative market quotes for {location}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
