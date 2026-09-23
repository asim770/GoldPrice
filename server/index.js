import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Directories
const UPLOADS_DIR = path.join(__dirname, "uploads");
const DATA_FILE = path.join(UPLOADS_DIR, "receipts.json");

// 24 Hours in milliseconds
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "20mb" }));

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Ensure receipts index exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// Utility: Read receipts index
function getReceipts() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Utility: Save receipts index
function saveReceipts(receipts) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(receipts, null, 2));
}

// Utility: Cleanup expired receipts (older than 24h)
function cleanupExpired() {
  const now = Date.now();
  const receipts = getReceipts();
  const activeReceipts = [];

  for (const item of receipts) {
    if (item.expiresAt > now) {
      activeReceipts.push(item);
    } else {
      // Delete PDF file if exists
      if (item.filename) {
        const filePath = path.join(UPLOADS_DIR, item.filename);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Expired receipt PDF deleted: ${item.filename}`);
          } catch (e) {
            console.error("Error deleting file:", e);
          }
        }
      }
    }
  }

  if (activeReceipts.length !== receipts.length) {
    saveReceipts(activeReceipts);
  }
}

// Run cleanup on server start & every 10 minutes
cleanupExpired();
setInterval(cleanupExpired, 10 * 60 * 1000);

// ── API ROUTES ──────────────────────────────────────────────────────────

/**
 * GET /api/health
 */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * POST /api/receipts - Upload/Save generated PDF & metadata
 */
app.post("/api/receipts", (req, res) => {
  try {
    cleanupExpired();
    const { receiptNumber, customerName, totalAmount, currency, pdfBase64, items, storeName } = req.body;

    if (!receiptNumber || !pdfBase64) {
      return res.status(400).json({ error: "Missing receiptNumber or pdfBase64 payload" });
    }

    const id = "rcp_" + Math.random().toString(36).substring(2, 10);
    const filename = `${id}.pdf`;
    const filePath = path.join(UPLOADS_DIR, filename);

    // Save PDF file — extract pure base64 payload irrespective of data-uri prefix
    const base64Data = pdfBase64.includes(",")
      ? pdfBase64.substring(pdfBase64.indexOf(",") + 1)
      : pdfBase64;
    const pdfBuffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(filePath, pdfBuffer);

    const now = Date.now();
    const expiresAt = now + ONE_DAY_MS;

    const receiptEntry = {
      id,
      receiptNumber: receiptNumber || "RCP-GENERAL",
      customerName: customerName || "Customer",
      storeName: storeName || "Gold Shop",
      totalAmount: totalAmount || 0,
      currency: currency || "INR",
      itemCount: items ? items.length : 1,
      createdAt: now,
      expiresAt: expiresAt,
      filename: filename,
    };

    const receipts = getReceipts();
    receipts.unshift(receiptEntry);
    saveReceipts(receipts);

    const baseUrl = `${req.protocol}://${req.get("host")}`;

    console.log(`✅ Saved PDF receipt ${receiptNumber} (ID: ${id}) — Valid for 24h until ${new Date(expiresAt).toLocaleString()}`);

    res.json({
      success: true,
      id,
      receiptNumber: receiptEntry.receiptNumber,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
      expiresInMs: ONE_DAY_MS,
      pdfUrl: `${baseUrl}/api/receipts/${id}/pdf`,
      viewUrl: `${baseUrl}/api/receipts/${id}/view`,
    });
  } catch (err) {
    console.error("Error saving receipt:", err);
    res.status(500).json({ error: "Failed to save receipt on server" });
  }
});

/**
 * GET /api/receipts - List all active non-expired receipts
 */
app.get("/api/receipts", (req, res) => {
  cleanupExpired();
  const receipts = getReceipts();
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  const mapped = receipts.map((r) => ({
    id: r.id,
    receiptNumber: r.receiptNumber,
    customerName: r.customerName,
    storeName: r.storeName,
    totalAmount: r.totalAmount,
    currency: r.currency,
    createdAt: new Date(r.createdAt).toISOString(),
    expiresAt: new Date(r.expiresAt).toISOString(),
    remainingMs: Math.max(0, r.expiresAt - Date.now()),
    pdfUrl: `${baseUrl}/api/receipts/${r.id}/pdf`,
    viewUrl: `${baseUrl}/api/receipts/${r.id}/view`,
  }));

  res.json({ count: mapped.length, receipts: mapped });
});

/**
 * GET /api/receipts/:id - Metadata details
 */
app.get("/api/receipts/:id", (req, res) => {
  cleanupExpired();
  const receipts = getReceipts();
  const receipt = receipts.find((r) => r.id === req.params.id);

  if (!receipt) {
    return res.status(404).json({ error: "Receipt not found or has expired (Available for 24 hours only)." });
  }

  if (Date.now() > receipt.expiresAt) {
    return res.status(410).json({ error: "This receipt link has expired (24-hour limit)." });
  }

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  res.json({
    ...receipt,
    remainingMs: Math.max(0, receipt.expiresAt - Date.now()),
    pdfUrl: `${baseUrl}/api/receipts/${receipt.id}/pdf`,
    viewUrl: `${baseUrl}/api/receipts/${receipt.id}/view`,
  });
});

/**
 * GET /api/receipts/:id/pdf - Stream PDF File
 */
app.get("/api/receipts/:id/pdf", (req, res) => {
  cleanupExpired();
  const receipts = getReceipts();
  const receipt = receipts.find((r) => r.id === req.params.id);

  if (!receipt || Date.now() > receipt.expiresAt) {
    return res.status(410).send(`
      <html>
        <body style="background:#09090e; color:#fff; font-family:sans-serif; text-align:center; padding:50px;">
          <h2 style="color:#f87171;">⚠️ Receipt Expired</h2>
          <p style="color:#9ca3af;">This receipt was only available for 1 day (24 hours) after generation.</p>
        </body>
      </html>
    `);
  }

  const filePath = path.join(UPLOADS_DIR, receipt.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("PDF file not found");
  }

  // If download query param is present, force attachment download
  if (req.query.download === "1" || req.query.download === "true") {
    return res.download(filePath, `${receipt.receiptNumber}.pdf`);
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${receipt.receiptNumber}.pdf"`);
  fs.createReadStream(filePath).pipe(res);
});

/**
 * GET /api/receipts/:id/view - Interactive HTML View Page with Expiry Countdown
 */
app.get("/api/receipts/:id/view", (req, res) => {
  cleanupExpired();
  const receipts = getReceipts();
  const receipt = receipts.find((r) => r.id === req.params.id);

  if (!receipt || Date.now() > receipt.expiresAt) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt Expired</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { background: #06060b; color: #f5f5f7; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #12121a; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 20px; padding: 40px; text-align: center; max-width: 450px; }
          h1 { color: #f87171; font-size: 24px; margin-bottom: 10px; }
          p { color: #9ca3af; font-size: 14px; line-height: 1.6; }
          .badge { background: rgba(239, 68, 68, 0.15); color: #fca5a5; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: bold; display: inline-block; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>⏰ Receipt Link Expired</h1>
          <p>This receipt was available for <strong>24 hours (1 day)</strong> from the time of generation and has now automatically expired.</p>
          <div class="badge">Available for 1 Day Only</div>
        </div>
      </body>
      </html>
    `);
  }

  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Tax Invoice ${receipt.receiptNumber} — ${receipt.storeName}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #04060a;
          color: #f3f4f6;
          font-family: 'Inter', -apple-system, sans-serif;
          min-height: 100vh;
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .container {
          width: 100%;
          max-width: 920px;
        }
        .header-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 100%);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border: 1px solid rgba(212, 175, 55, 0.25);
          border-radius: 20px;
          padding: 24px 28px;
          margin-bottom: 20px;
          box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.6), inset 0 1px 1px 0 rgba(255, 255, 255, 0.15);
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 18px;
        }
        .crest-title-wrap {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .crest {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(184, 134, 11, 0.3));
          border: 1.5px solid #d4af37;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: #fbbf24;
          box-shadow: 0 4px 15px rgba(212, 175, 55, 0.25);
        }
        .title {
          font-family: 'Cinzel', serif;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: #ffffff;
        }
        .meta {
          color: #9ca3af;
          font-size: 13px;
          margin-top: 3px;
          font-family: 'Outfit', sans-serif;
        }
        .meta strong {
          color: #e5e7eb;
        }
        .timer-box {
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.25);
          padding: 10px 18px;
          border-radius: 14px;
          text-align: right;
          box-shadow: 0 4px 16px rgba(245, 158, 11, 0.08);
        }
        .timer-label {
          font-size: 10px;
          text-transform: uppercase;
          color: #fbbf24;
          font-weight: 800;
          letter-spacing: 0.08em;
          font-family: 'Outfit', sans-serif;
        }
        .timer-value {
          font-size: 19px;
          font-weight: 800;
          color: #fef08a;
          font-family: monospace;
          margin-top: 2px;
          letter-spacing: 0.05em;
        }
        .actions-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          gap: 12px;
          flex-wrap: wrap;
        }
        .badge-verified {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #34d399;
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          font-family: 'Outfit', sans-serif;
        }
        .btn-download {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: #000;
          font-weight: 800;
          padding: 10px 22px;
          border-radius: 12px;
          text-decoration: none;
          font-size: 13.5px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.25s ease;
          box-shadow: 0 4px 18px rgba(245, 158, 11, 0.35);
          font-family: 'Outfit', sans-serif;
        }
        .btn-download:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(245, 158, 11, 0.5);
          opacity: 0.95;
        }
        .pdf-frame {
          width: 100%;
          height: 80vh;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 18px;
          background: #111420;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
        }
        .footer-note {
          text-align: center;
          color: #6b7280;
          font-size: 11px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header-card">
          <div class="crest-title-wrap">
            <div class="crest">✦</div>
            <div>
              <div class="title">${receipt.receiptNumber}</div>
              <div class="meta">Client: <strong>${receipt.customerName}</strong> &bull; ${receipt.storeName}</div>
            </div>
          </div>
          <div class="timer-box">
            <div class="timer-label">⏱️ Cloud Link Expiry</div>
            <div class="timer-value" id="countdown">Calculating…</div>
          </div>
        </div>

        <div class="actions-bar">
          <div class="badge-verified">
            ✓ Official Bullion Tax Invoice & Appraisal
          </div>
          <a href="${baseUrl}/api/receipts/${receipt.id}/pdf?download=1" class="btn-download">
            ⬇️ Download Official PDF
          </a>
        </div>

        <iframe src="${baseUrl}/api/receipts/${receipt.id}/pdf" class="pdf-frame"></iframe>

        <div class="footer-note">
          BullionDesk Pro &bull; Generated & Encrypted Document with 24-Hour Temporary Cloud Hosting
        </div>
      </div>

      <script>
        const expiresAt = ${receipt.expiresAt};
        function updateTimer() {
          const diff = expiresAt - Date.now();
          if (diff <= 0) {
            document.getElementById("countdown").innerText = "EXPIRED";
            window.location.reload();
            return;
          }
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((diff % (1000 * 60)) / 1000);
          document.getElementById("countdown").innerText = 
            String(hours).padStart(2, '0') + ":" + 
            String(mins).padStart(2, '0') + ":" + 
            String(secs).padStart(2, '0');
        }
        updateTimer();
        setInterval(updateTimer, 1000);
      </script>
    </body>
    </html>
  `);
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Gold Price Backend Server running at http://localhost:${PORT}`);
  console.log(`📂 Saved PDF receipts stored in ${UPLOADS_DIR} (Auto-expires in 24h)`);
});
