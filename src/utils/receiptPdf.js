/**
 * Receipt PDF Generator
 * ---------------------
 * Uses jsPDF to produce a clean, professional receipt PDF.
 * Supports Cash Mode (currency totals) and Gold Mode (weight totals + cash equivalent).
 */

import { jsPDF } from "jspdf";

/**
 * @typedef {Object} ReceiptItem
 * @property {string}  name
 * @property {number}  weight       – grams
 * @property {string}  purityLabel  – e.g. "24K"
 * @property {number}  purityValue  – 0–1 multiplier
 * @property {number}  price        – calculated price (₹ / $)
 * @property {number}  pureWeight   – weight × purityValue
 */

/**
 * @typedef {Object} ReceiptData
 * @property {string}        storeName
 * @property {string}        storeAddress
 * @property {"cash"|"gold"} mode
 * @property {string}        currencyCode    – "INR" | "USD"
 * @property {string}        currencySymbol  – "₹" | "$"
 * @property {number}        pricePer10g     – base gold price per 10g used
 * @property {ReceiptItem[]} items
 * @property {number}        totalPrice      – sum of all item prices
 * @property {number}        totalPureWeight – sum of all pureWeights (gold mode)
 * @property {string}        dateTime        – formatted date/time string
 */

// ── Colour palette ─────────────────────────────────────────────
const COLORS = {
  black:     [15, 15, 20],
  dark:      [40, 40, 50],
  gray:      [120, 120, 135],
  lightGray: [200, 200, 210],
  white:     [255, 255, 255],
  gold:      [212, 160, 23],
  goldLight: [245, 190, 50],
  accent:    [16, 185, 129],  // emerald
};

/**
 * Draw a horizontal line across the page.
 */
function drawLine(doc, y, color = COLORS.lightGray, width = 0.3) {
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  doc.line(20, y, 190, y);
}

/**
 * Format a number as currency string.
 */
function fmtCurrency(amount, symbol = "₹") {
  return `${symbol}${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generate and download a receipt PDF.
 * @param {ReceiptData} data
 */
export function generateReceiptPDF(data) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  let y = 20;

  // ── Header Background ─────────────────────────────────────────
  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, pageWidth, 55, "F");

  // Gold accent line at top
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 0, pageWidth, 2, "F");

  // ── Store Name ────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.white);
  doc.text(data.storeName || "Gold Shop", pageWidth / 2, y + 8, { align: "center" });

  // ── Store Address ─────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.lightGray);
  doc.text(data.storeAddress || "", pageWidth / 2, y + 17, { align: "center" });

  // ── "RECEIPT" label ───────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.gold);
  doc.text("RECEIPT", pageWidth / 2, y + 28, { align: "center" });

  // Gold accent line below header
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 53, pageWidth, 1.5, "F");

  y = 64;

  // ── Date / Mode / Price Info ──────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray);

  doc.text(`Date & Time:`, 20, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text(data.dateTime, 55, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.gray);
  doc.text(`Mode:`, 20, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text(data.mode === "cash" ? "Cash Mode" : "Gold Mode", 55, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.gray);
  doc.text(`Gold Price (10g):`, 20, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text(fmtCurrency(data.pricePer10g, data.currencySymbol), 55, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.gray);
  doc.text(`Price per gram:`, 20, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text(fmtCurrency(data.pricePer10g / 10, data.currencySymbol), 55, y);

  y += 4;
  drawLine(doc, y, COLORS.lightGray, 0.2);
  y += 8;

  // ── Items Table Header ────────────────────────────────────────
  const colX = {
    num:    20,
    name:   28,
    weight: 80,
    purity: 105,
    price:  130,
  };

  doc.setFillColor(245, 245, 248);
  doc.roundedRect(18, y - 4, 174, 9, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);

  doc.text("#",          colX.num,    y + 2);
  doc.text("Item",       colX.name,   y + 2);
  doc.text("Weight (g)", colX.weight, y + 2);
  doc.text("Purity",     colX.purity, y + 2);
  if (data.mode === "cash") {
    doc.text("Price",    colX.price,  y + 2);
  } else {
    doc.text("Pure Wt (g)", colX.price, y + 2);
    doc.text("Value", 165, y + 2);
  }

  y += 10;

  // ── Items Rows ────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  data.items.forEach((item, idx) => {
    // Alternate row background
    if (idx % 2 === 0) {
      doc.setFillColor(252, 252, 254);
      doc.rect(18, y - 3.5, 174, 8, "F");
    }

    doc.setTextColor(...COLORS.dark);
    doc.text(`${idx + 1}`, colX.num, y + 1);
    doc.text(item.name || "-", colX.name, y + 1);

    doc.setFont("helvetica", "bold");
    doc.text(`${item.weight.toFixed(2)}`, colX.weight, y + 1);
    doc.setFont("helvetica", "normal");

    doc.text(item.purityLabel, colX.purity, y + 1);

    if (data.mode === "cash") {
      doc.setFont("helvetica", "bold");
      doc.text(fmtCurrency(item.price, data.currencySymbol), colX.price, y + 1);
      doc.setFont("helvetica", "normal");
    } else {
      doc.text(`${item.pureWeight.toFixed(3)}`, colX.price, y + 1);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.gray);
      doc.text(fmtCurrency(item.price, data.currencySymbol), 165, y + 1);
      doc.setFont("helvetica", "normal");
    }

    y += 8;

    // Page break check
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
  });

  y += 2;
  drawLine(doc, y, COLORS.gold, 0.5);
  y += 8;

  // ── Totals Section ────────────────────────────────────────────
  // Background box for totals
  doc.setFillColor(250, 248, 240);
  doc.roundedRect(18, y - 4, 174, data.mode === "gold" ? 30 : 18, 2, 2, "F");
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.4);
  doc.roundedRect(18, y - 4, 174, data.mode === "gold" ? 30 : 18, 2, 2, "S");

  if (data.mode === "cash") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.dark);
    doc.text("Total Amount:", 24, y + 5);

    doc.setFontSize(14);
    doc.setTextColor(...COLORS.gold);
    doc.text(fmtCurrency(data.totalPrice, data.currencySymbol), 186, y + 5, { align: "right" });
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.dark);
    doc.text("Total Pure Gold:", 24, y + 4);

    doc.setFontSize(13);
    doc.setTextColor(...COLORS.gold);
    doc.text(`${data.totalPureWeight.toFixed(3)} g`, 186, y + 4, { align: "right" });

    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.gray);
    doc.text("Equivalent Cash Value:", 24, y + 4);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.dark);
    doc.text(fmtCurrency(data.totalPrice, data.currencySymbol), 186, y + 4, { align: "right" });
  }

  y += (data.mode === "gold" ? 22 : 20);

  // ── Footer ────────────────────────────────────────────────────
  drawLine(doc, y, COLORS.lightGray, 0.15);
  y += 8;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.text("Thank you for your purchase!", pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.text("This is a computer-generated receipt.", pageWidth / 2, y, { align: "center" });

  // ── Gold accent line at bottom ────────────────────────────────
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 295, pageWidth, 2, "F");

  // ── Download ──────────────────────────────────────────────────
  const timestamp = new Date().toISOString().slice(0, 10);
  doc.save(`Receipt_${data.storeName?.replace(/\s+/g, "_") || "Shop"}_${timestamp}.pdf`);
}
