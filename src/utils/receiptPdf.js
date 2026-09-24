/**
 * Receipt PDF Generator — Professional Gold Shop Receipt
 * -------------------------------------------------------
 * Uses jsPDF to produce a premium, professionally designed receipt PDF
 * with decorative borders, proper table formatting, and clear layout.
 */

import { jsPDF } from "jspdf";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

// ── Colour palette ─────────────────────────────────────────────
const C = {
  black: [20, 20, 25],
  dark: [45, 45, 55],
  body: [60, 60, 70],
  gray: [130, 130, 140],
  lightGray: [200, 200, 210],
  ultraLight: [240, 238, 230],
  cream: [252, 250, 244],
  white: [255, 255, 255],
  gold: [180, 140, 20],
  goldDark: [140, 105, 18],
  goldLight: [220, 185, 70],
  goldAccent: [245, 200, 80],
  emerald: [16, 150, 100],
  red: [200, 50, 50],
};

/**
 * Format a number as a currency string safe for standard PDF fonts.
 */
function fmt(amount, symbol = "Rs. ") {
  let displaySymbol = symbol;
  if (!displaySymbol || displaySymbol === "₹") {
    displaySymbol = "Rs. ";
  } else {
    displaySymbol = `${displaySymbol} `;
  }
  const formatted = Math.abs(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${displaySymbol}${formatted}`;
}

/**
 * Draw a horizontal line.
 */
function hLine(doc, y, x1 = 20, x2 = 190, color = C.lightGray, width = 0.3) {
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  doc.line(x1, y, x2, y);
}

/**
 * Draw decorative page border with double line.
 */
function drawPageBorder(doc) {
  const w = 210, h = 297;
  // Outer border
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.8);
  doc.rect(8, 8, w - 16, h - 16);
  // Inner border
  doc.setDrawColor(...C.goldLight);
  doc.setLineWidth(0.3);
  doc.rect(11, 11, w - 22, h - 22);
}

/**
 * Draw a decorative diamond separator.
 */
function drawDiamondSeparator(doc, y, centerX = 105) {
  doc.setFillColor(...C.gold);
  // Center diamond
  doc.setLineWidth(0);
  const size = 2;
  doc.lines(
    [
      [size, size],
      [size, -size],
      [-size, -size],
      [-size, size],
    ],
    centerX - size,
    y,
    [1, 1],
    "F"
  );
  // Side lines
  hLine(doc, y, 30, centerX - 8, C.goldLight, 0.3);
  hLine(doc, y, centerX + 8, 180, C.goldLight, 0.3);
}

/**
 * @typedef {Object} ReceiptData
 * @property {string}        storeName
 * @property {string}        storeAddress
 * @property {string}        storePhone
 * @property {string}        storeGSTIN
 * @property {string}        customerName
 * @property {string}        receiptNumber
 * @property {"cash"|"gold"} mode
 * @property {string}        currencyCode
 * @property {string}        currencySymbol
 * @property {number}        pricePer10g
 * @property {Array}         items
 * @property {number}        subtotal
 * @property {number}        makingCharges
 * @property {string}        makingChargesLabel
 * @property {number}        totalPrice
 * @property {number}        totalPureWeight
 * @property {string}        dateTime
 */

/**
 * Generate and download a professional receipt PDF.
 * @param {ReceiptData} data
 */
export function generateReceiptPDF(data) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pw = 210; // page width
  const contentLeft = 20;
  const contentRight = 190;
  const contentWidth = contentRight - contentLeft;

  // ── Page border ──────────────────────────────────────────────
  drawPageBorder(doc);

  let y = 18;

  // ── GOLD TOP BAND ────────────────────────────────────────────
  doc.setFillColor(...C.gold);
  doc.rect(11, 11, pw - 22, 3, "F");
  // Lighter inner gradient effect
  doc.setFillColor(...C.goldAccent);
  doc.rect(11, 12, pw - 22, 1, "F");

  y = 24;

  // ── STORE NAME ───────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...C.black);
  doc.text(data.storeName || "JEWELLERY SHOP", pw / 2, y, { align: "center" });

  y += 7;

  // ── STORE ADDRESS ────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.gray);
  if (data.storeAddress) {
    doc.text(data.storeAddress, pw / 2, y, { align: "center" });
    y += 5;
  }

  // Phone & GSTIN line
  const contactParts = [];
  if (data.storePhone) contactParts.push(`Ph: ${data.storePhone}`);
  if (data.storeGSTIN) contactParts.push(`GSTIN: ${data.storeGSTIN}`);
  if (contactParts.length > 0) {
    doc.setFontSize(8);
    doc.setTextColor(...C.gray);
    doc.text(contactParts.join("  |  "), pw / 2, y, { align: "center" });
    y += 5;
  }

  y += 2;

  // ── RECEIPT TITLE ────────────────────────────────────────────
  // Background band
  doc.setFillColor(...C.cream);
  doc.rect(contentLeft, y - 4, contentWidth, 12, "F");
  hLine(doc, y - 4, contentLeft, contentRight, C.gold, 0.5);
  hLine(doc, y + 8, contentLeft, contentRight, C.gold, 0.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C.gold);
  doc.text("TAX INVOICE / RECEIPT", pw / 2, y + 4, { align: "center" });

  y += 14;

  // ── RECEIPT META SECTION ─────────────────────────────────────
  const metaStartY = y;

  // Left column
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.gray);

  const leftMeta = [
    ["Receipt No:", data.receiptNumber || "-"],
    ["Date & Time:", data.dateTime || "-"],
    ["Mode:", data.mode === "cash" ? "Cash Mode" : "Gold Mode"],
  ];

  leftMeta.forEach(([label, value], i) => {
    const rowY = metaStartY + i * 5.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.gray);
    doc.text(label, contentLeft, rowY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.dark);
    doc.text(value, contentLeft + 28, rowY);
  });

  // Right column
  const rightMeta = [
    ["Gold Price (10g):", fmt(data.pricePer10g, data.currencySymbol)],
    ["Price per gram:", fmt(data.pricePer10g / 10, data.currencySymbol)],
  ];

  if (data.customerName) {
    rightMeta.push(["Customer:", data.customerName]);
  }

  rightMeta.forEach(([label, value], i) => {
    const rowY = metaStartY + i * 5.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.gray);
    doc.text(label, 115, rowY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.dark);
    doc.text(value, 148, rowY);
  });

  y = metaStartY + Math.max(leftMeta.length, rightMeta.length) * 5.5 + 4;

  // Diamond separator
  drawDiamondSeparator(doc, y);
  y += 8;

  // ── ITEMS TABLE ──────────────────────────────────────────────

  // Column definitions
  const cols = data.mode === "cash"
    ? [
      { label: "Sr.", x: contentLeft, w: 12, align: "left" },
      { label: "Item", x: contentLeft + 12, w: 58, align: "left" },
      { label: "Wt (g)", x: contentLeft + 70, w: 22, align: "right" },
      { label: "Purity", x: contentLeft + 92, w: 22, align: "center" },
      { label: "Rate/g", x: contentLeft + 114, w: 28, align: "right" },
      { label: "Amount", x: contentLeft + 142, w: 28, align: "right" },
    ]
    : [
      { label: "Sr.", x: contentLeft, w: 12, align: "left" },
      { label: "Item", x: contentLeft + 12, w: 48, align: "left" },
      { label: "Wt (g)", x: contentLeft + 60, w: 20, align: "right" },
      { label: "Purity", x: contentLeft + 80, w: 20, align: "center" },
      { label: "Pure Wt", x: contentLeft + 100, w: 22, align: "right" },
      { label: "Rate/g", x: contentLeft + 122, w: 24, align: "right" },
      { label: "Value", x: contentLeft + 146, w: 24, align: "right" },
    ];

  // Table header background
  doc.setFillColor(...C.gold);
  doc.roundedRect(contentLeft, y - 3.5, contentWidth, 9, 1, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.white);

  cols.forEach((col) => {
    const textX =
      col.align === "right"
        ? col.x + col.w - 1
        : col.align === "center"
          ? col.x + col.w / 2
          : col.x + 1;
    doc.text(col.label, textX, y + 2, { align: col.align });
  });

  y += 9;

  // Table rows
  doc.setFontSize(9);

  data.items.forEach((item, idx) => {
    // Alternate row shading
    if (idx % 2 === 0) {
      doc.setFillColor(...C.cream);
      doc.rect(contentLeft, y - 3.5, contentWidth, 9, "F");
    }

    // Row border
    doc.setDrawColor(...C.ultraLight);
    doc.setLineWidth(0.15);
    doc.line(contentLeft, y + 5.5, contentRight, y + 5.5);

    doc.setTextColor(...C.dark);

    // Serial number
    doc.setFont("helvetica", "normal");
    doc.text(`${idx + 1}`, cols[0].x + 1, y + 2);

    // Item name
    doc.setFont("helvetica", "bold");
    const itemName = item.name || "-";
    const maxNameWidth = cols[1].w - 2;
    const truncatedName = doc.getTextWidth(itemName) > maxNameWidth
      ? itemName.substring(0, Math.floor(itemName.length * maxNameWidth / doc.getTextWidth(itemName))) + "..."
      : itemName;
    doc.text(truncatedName, cols[1].x + 1, y + 2);

    // Weight
    doc.setFont("helvetica", "normal");
    doc.text(`${item.weight.toFixed(2)}`, cols[2].x + cols[2].w - 1, y + 2, { align: "right" });

    // Purity
    doc.text(item.purityLabel, cols[3].x + cols[3].w / 2, y + 2, { align: "center" });

    if (data.mode === "cash") {
      // Rate per gram (adjusted for purity)
      const ratePerGram = (data.pricePer10g / 10) * item.purityValue;
      doc.text(fmt(ratePerGram, data.currencySymbol), cols[4].x + cols[4].w - 1, y + 2, { align: "right" });

      // Amount
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.goldDark);
      doc.text(fmt(item.price, data.currencySymbol), cols[5].x + cols[5].w - 1, y + 2, { align: "right" });
    } else {
      // Pure weight
      doc.text(`${item.pureWeight.toFixed(3)}`, cols[4].x + cols[4].w - 1, y + 2, { align: "right" });

      // Rate per gram
      const ratePerGram = (data.pricePer10g / 10) * item.purityValue;
      doc.text(fmt(ratePerGram, data.currencySymbol), cols[5].x + cols[5].w - 1, y + 2, { align: "right" });

      // Value
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...C.goldDark);
      doc.text(fmt(item.price, data.currencySymbol), cols[6].x + cols[6].w - 1, y + 2, { align: "right" });
    }

    y += 9;

    // Page break check
    if (y > 250) {
      doc.addPage();
      drawPageBorder(doc);
      y = 24;
    }
  });

  y += 3;

  // ── TOTALS BOX ───────────────────────────────────────────────
  const totalsStartY = y;
  const totalsX = contentRight - 80;
  const totalsWidth = 80;

  // Border around totals
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.5);

  // Calculate totals box height
  let totalsHeight = 10; // subtotal
  if (data.makingCharges > 0) totalsHeight += 7;
  totalsHeight += 3; // spacing before grand total
  totalsHeight += 12; // grand total
  if (data.mode === "gold") totalsHeight += 14; // pure gold line

  doc.setFillColor(255, 252, 240);
  doc.roundedRect(totalsX - 4, totalsStartY - 2, totalsWidth + 8, totalsHeight + 4, 2, 2, "F");
  doc.setDrawColor(...C.gold);
  doc.setLineWidth(0.5);
  doc.roundedRect(totalsX - 4, totalsStartY - 2, totalsWidth + 8, totalsHeight + 4, 2, 2, "S");

  let ty = totalsStartY + 5;

  // Subtotal
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.body);
  doc.text("Subtotal:", totalsX, ty);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...C.dark);
  doc.text(fmt(data.subtotal, data.currencySymbol), totalsX + totalsWidth, ty, { align: "right" });

  // Making charges
  if (data.makingCharges > 0) {
    ty += 7;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.body);
    doc.setFontSize(8);
    doc.text(data.makingChargesLabel || "Making Charges:", totalsX, ty);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.dark);
    doc.setFontSize(9);
    doc.text(fmt(data.makingCharges, data.currencySymbol), totalsX + totalsWidth, ty, { align: "right" });
  }

  ty += 5;
  hLine(doc, ty, totalsX - 2, totalsX + totalsWidth + 2, C.gold, 0.4);
  ty += 7;

  // Grand total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C.black);
  doc.text("Grand Total:", totalsX, ty);
  doc.setTextColor(...C.gold);
  doc.setFontSize(14);
  doc.text(fmt(data.totalPrice, data.currencySymbol), totalsX + totalsWidth, ty, { align: "right" });

  // Gold mode: show pure weight
  if (data.mode === "gold") {
    ty += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.body);
    doc.text("Total Pure Gold:", totalsX, ty);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...C.goldDark);
    doc.text(`${data.totalPureWeight.toFixed(3)} g`, totalsX + totalsWidth, ty, { align: "right" });
  }

  // Update y to after totals
  y = totalsStartY + totalsHeight + 12;

  // ── AMOUNT IN WORDS (for INR) ────────────────────────────────
  if (data.currencyCode === "INR" && data.totalPrice > 0) {
    doc.setFillColor(...C.cream);
    doc.roundedRect(contentLeft, y - 3, contentWidth, 10, 1, 1, "F");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...C.body);
    doc.text("Amount in words:", contentLeft + 3, y + 2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.dark);
    doc.text(numberToWords(Math.round(data.totalPrice)) + " Rupees Only", contentLeft + 35, y + 2);
    y += 14;
  }

  // ── TERMS & NOTES ────────────────────────────────────────────
  if (y < 245) {
    hLine(doc, y, contentLeft, contentRight, C.lightGray, 0.2);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    doc.text("Terms & Conditions:", contentLeft, y);
    y += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.gray);
    const terms = [
      "1. Goods once sold will not be returned.",
      "2. Gold rates are subject to market fluctuation.",
      "3. Please retain this receipt for any future reference.",
      "4. Making charges are non-refundable.",
    ];
    terms.forEach((t) => {
      doc.text(t, contentLeft, y);
      y += 3.5;
    });
  }

  // ── FOOTER ───────────────────────────────────────────────────
  y = 270;
  drawDiamondSeparator(doc, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.dark);
  doc.text("Thank you for your purchase!", pw / 2, y, { align: "center" });
  y += 5;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...C.gray);
  doc.text("This is a computer-generated receipt and does not require a signature.", pw / 2, y, { align: "center" });

  // ── GOLD BOTTOM BAND ─────────────────────────────────────────
  doc.setFillColor(...C.gold);
  doc.rect(11, 297 - 14, pw - 22, 3, "F");
  doc.setFillColor(...C.goldAccent);
  doc.rect(11, 297 - 13, pw - 22, 1, "F");

  // ── DOWNLOAD & BASE64 ─────────────────────────────────────────
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeName = (data.storeName || "Shop").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Receipt_${safeName}_${data.receiptNumber || timestamp}.pdf`;

  const pdfBase64 = doc.output("datauristring");
  let pdfBlobUrl = null;
  try {
    const blob = doc.output("blob");
    pdfBlobUrl = URL.createObjectURL(blob);
  } catch (e) {
    console.warn("Blob URL generation failed:", e);
  }

  return { doc, filename, pdfBase64, pdfBlobUrl };
}

/**
 * Save or Share PDF across native mobile (Capacitor Android/iOS) and web browser.
 */
export async function saveReceiptPDF({ doc, filename, pdfBase64, pdfBlobUrl }) {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = pdfBase64 && pdfBase64.includes(",")
        ? pdfBase64.substring(pdfBase64.indexOf(",") + 1)
        : pdfBase64;

      if (!base64Data) {
        throw new Error("Missing PDF base64 data");
      }

      // 1. Write file to Cache directory (accessible to FileProvider)
      const cacheResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });

      // 2. Also write to Documents directory so it persists in device storage
      try {
        await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents,
        });
      } catch (docErr) {
        console.warn("Documents write fallback:", docErr);
      }

      // 3. Open Android Native Share / Save sheet
      // Allows user to Save to Downloads, Drive, WhatsApp, PDF Viewer, etc.
      await Share.share({
        title: filename,
        text: `BullionDesk Tax Invoice: ${filename}`,
        url: cacheResult.uri,
        dialogTitle: "Save or Share Invoice PDF",
      });

      return { success: true, native: true, uri: cacheResult.uri };
    } catch (nativeErr) {
      console.error("Native save/share error:", nativeErr);
    }
  }

  // Web Browser fallback
  try {
    if (doc) {
      doc.save(filename);
    } else if (pdfBlobUrl) {
      const link = document.createElement("a");
      link.href = pdfBlobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    return { success: true, native: false };
  } catch (webErr) {
    console.warn("Web save fallback failed:", webErr);
    return { success: false, error: webErr };
  }
}

// ── Number to Words (Indian system) ────────────────────────────

function numberToWords(num) {
  if (num === 0) return "Zero";

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
  ];

  function twoDigits(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  }

  function threeDigits(n) {
    if (n >= 100) {
      return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + twoDigits(n % 100) : "");
    }
    return twoDigits(n);
  }

  let result = "";
  let remaining = Math.abs(Math.floor(num));

  if (remaining >= 10000000) {
    result += threeDigits(Math.floor(remaining / 10000000)) + " Crore ";
    remaining %= 10000000;
  }
  if (remaining >= 100000) {
    result += twoDigits(Math.floor(remaining / 100000)) + " Lakh ";
    remaining %= 100000;
  }
  if (remaining >= 1000) {
    result += twoDigits(Math.floor(remaining / 1000)) + " Thousand ";
    remaining %= 1000;
  }
  if (remaining > 0) {
    result += threeDigits(remaining);
  }

  return result.trim();
}
