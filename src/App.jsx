import { useState, useEffect, useCallback } from "react";
import Navbar from "./components/Navbar";
import PriceCalculator from "./components/PriceCalculator";
import { fetchLivePrices } from "./gemini";
import "./App.css";

/** Auto-refresh interval (5 minutes) */
const REFRESH_INTERVAL = 5 * 60 * 1000;

/**
 * Root application component.
 * Manages global state: active metal tab, live prices, loading/error states, last-updated time.
 */
function App() {
  const [activeTab, setActiveTab] = useState("gold");
  const [prices, setPrices]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ── Fetch prices ──────────────────────────────────
  const loadPrices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLivePrices();
      setPrices(data);
      setLastUpdated(data.fetchedAt);
    } catch (err) {
      setError(err.message || "Failed to fetch prices. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => { loadPrices(); }, [loadPrices]);

  // Auto-refresh every 5 min
  useEffect(() => {
    const id = setInterval(loadPrices, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [loadPrices]);

  // ── Background glow colour based on active tab ────
  const glowColor = activeTab === "gold"
    ? "rgba(245, 158, 11, 0.04)"
    : "rgba(148, 163, 184, 0.03)";

  return (
    <div className="min-h-screen relative" style={{ background: "#06060b", color: "#f5f5f7" }}>
      {/* Ambient background glow */}
      <div className="fixed inset-0 z-0 pointer-events-none transition-colors duration-700">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 50% 0%, ${glowColor}, transparent 70%)`,
          }}
        />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full blur-[140px] animate-pulse-glow transition-colors duration-700"
          style={{ background: glowColor }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
        <PriceCalculator
          activeTab={activeTab}
          prices={prices}
          loading={loading}
          error={error}
          lastUpdated={lastUpdated}
          onRefresh={loadPrices}
        />

        {/* Footer */}
        <footer className="text-center py-8 pb-10 text-gray-600 text-xs max-w-md mx-auto leading-relaxed px-4">
          Prices are approximate and sourced via AI.
          For trading, always verify with official exchange rates.
        </footer>
      </div>
    </div>
  );
}

export default App;
