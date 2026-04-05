import { memo } from "react";

const TABS = [
  { key: "gold",   label: "Gold",   emoji: "🥇" },
  { key: "silver", label: "Silver", emoji: "🥈" },
];

/**
 * Top navigation bar with logo, Gold/Silver tab switcher, and Receipt Generator link.
 */
function Navbar({ activeTab, onTabChange, activePage, onPageChange }) {
  return (
    <nav
      id="main-navbar"
      className="w-full sticky top-0 z-50"
      style={{
        background: "rgba(6, 6, 11, 0.75)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        {/* Logo */}
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => onPageChange("calculator")}
        >
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg"
            style={{
              background: "linear-gradient(135deg, #f59e0b, #f97316)",
              boxShadow: "0 4px 20px rgba(245, 158, 11, 0.25)",
            }}
          >
            💰
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
            Price<span className="gradient-text-gold">Cal</span>
          </h1>
        </div>

        {/* Navigation area */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Gold/Silver Tab Switcher — only visible on calculator page */}
          {activePage === "calculator" && (
            <div
              id="tab-switcher"
              className="relative flex items-center gap-1 p-1 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    id={`tab-${tab.key}`}
                    onClick={() => onTabChange(tab.key)}
                    className={`relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
                      isActive ? "text-gray-950" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {isActive && (
                      <span
                        className={`absolute inset-0 rounded-xl ${
                          tab.key === "gold" ? "tab-indicator-gold" : "tab-indicator-silver"
                        } transition-all duration-300`}
                        style={{ zIndex: -1 }}
                      />
                    )}
                    <span className="text-base">{tab.emoji}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Receipt Generator Button */}
          <button
            id="nav-receipt-btn"
            onClick={() =>
              onPageChange(activePage === "receipt" ? "calculator" : "receipt")
            }
            className={`relative flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
              activePage === "receipt"
                ? "text-gray-950"
                : "text-gray-400 hover:text-white"
            }`}
            style={
              activePage === "receipt"
                ? {
                    background: "linear-gradient(135deg, #10b981, #34d399)",
                    boxShadow: "0 4px 15px rgba(16, 185, 129, 0.3)",
                  }
                : {
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }
            }
          >
            <span className="text-base">🧾</span>
            <span className="hidden sm:inline">Receipt</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

export default memo(Navbar);
