import { memo } from "react";

/**
 * iPhone 17 UI Fixed Floating Liquid Glass Navbar
 * Positioned fixed at the top-right of the viewport.
 */
function Navbar({
  activeTab,
  onTabChange,
  activePage,
  onPageChange,
}) {
  return (
    <header className="fixed top-3 sm:top-4 right-3 sm:right-6 md:right-8 z-50 flex justify-end pointer-events-auto">
      <nav
        id="main-navbar"
        className="ios-navbar-capsule px-4 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-3 sm:gap-4 transition-all duration-300 shadow-2xl"
        style={{
          background: "rgba(10, 13, 22, 0.85)",
          backdropFilter: "blur(40px) saturate(190%)",
          WebkitBackdropFilter: "blur(40px) saturate(190%)",
        }}
      >
        {/* Left inside capsule: Brand Logo */}
        <div
          className="flex items-center gap-2 cursor-pointer group select-none shrink-0"
          onClick={() => onPageChange("calculator")}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-base shadow-lg transition-transform duration-300 group-hover:scale-105 group-active:scale-95"
            style={{
              background: "linear-gradient(145deg, #fbbf24 0%, #d97706 100%)",
              boxShadow: "0 4px 16px rgba(245, 158, 11, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.6)",
            }}
          >
            ⚖️
          </div>
          <div>
            <span className="text-sm sm:text-base font-black tracking-tight text-white">
              Bullion<span className="gradient-text-gold">Desk</span>
            </span>
          </div>
        </div>

        {/* Right inside capsule: iOS Segmented Metal Control & Receipt Button */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {activePage === "calculator" && (
            <div className="ios-segmented flex items-center p-0.5">
              <button
                type="button"
                id="tab-gold"
                onClick={() => onTabChange("gold")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                  activeTab === "gold"
                    ? "bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-md shadow-amber-500/30 scale-[1.02]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span>🥇</span>
                <span>Gold</span>
              </button>
              <button
                type="button"
                id="tab-silver"
                onClick={() => onTabChange("silver")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                  activeTab === "silver"
                    ? "bg-gradient-to-r from-slate-200 to-slate-300 text-black shadow-md shadow-slate-300/30 scale-[1.02]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span>🥈</span>
                <span>Silver</span>
              </button>
            </div>
          )}

          {/* Receipt Button */}
          <button
            type="button"
            id="nav-receipt-btn"
            onClick={() => onPageChange(activePage === "receipt" ? "calculator" : "receipt")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
              activePage === "receipt"
                ? "bg-gradient-to-r from-emerald-400 to-emerald-500 text-black shadow-lg shadow-emerald-500/30"
                : "ios-btn-glass text-gray-200 hover:text-white"
            }`}
          >
            <span>🧾</span>
            <span>Receipt</span>
          </button>
        </div>
      </nav>
    </header>
  );
}

export default memo(Navbar);
