
import { apiGet, escapeHtml, qs, getStorefrontMeta } from "./api.js";

let scannerStream = null;
let scannerFrame = null;
let detector = null;
let html5Scanner = null;

function statusMarkup(authenticity) {
  if (authenticity === "verified") return `<span class="status status-verified">Authentic</span>`;
  if (authenticity === "pending_activation") return `<span class="status status-pending">Pending Activation</span>`;
  if (authenticity === "blocked") return `<span class="status status-void">Blocked</span>`;
  return `<span class="status status-void">Unavailable</span>`;
}

function setScannerNote(message, variant = "") {
  const note = document.querySelector("[data-scanner-note]");
  if (!note) return;
  note.className = `scanner-note muted ${variant ? `notice notice-${variant}` : ''}`.trim();
  note.textContent = message;
}

async function verifyCode(code) {
  const mount = document.querySelector("[data-verify-result]");
  const formInput = document.querySelector("[name='code']");
  if (!mount || !code) return;

  formInput.value = code;
  mount.innerHTML = `<div class="notice">Checking code…</div>`;

  const result = await apiGet(`/api/verify/${encodeURIComponent(code)}`);

  if (!result.ok) {
    mount.innerHTML = `<div class="notice notice-danger">${escapeHtml(result.message || "Verification failed.")}</div>`;
    return;
  }

  if (!result.item) {
    mount.innerHTML = `
      <div class="result-card">
        ${statusMarkup(result.authenticity)}
        <h3 style="margin-top:0.9rem;">Code not found</h3>
        <p class="muted">${escapeHtml(result.message)}</p>
      </div>
    `;
    return;
  }

  const item = result.item;
  mount.innerHTML = `
    <div class="result-card">
      ${statusMarkup(result.authenticity)}
      <h2 style="margin-top:0.9rem;">${escapeHtml(item.product_name)}</h2>
      <p class="muted">${escapeHtml(result.message)}</p>
      <div class="verify-meta">
        <span class="pill">${escapeHtml(item.serial_code)}</span>
        <span class="pill">${escapeHtml(item.color || "Standard")}</span>
        <span class="pill">${escapeHtml(item.size || "One Size")}</span>
      </div>
      <div class="details-list" style="margin-top:1rem;">
        <article><strong>Batch</strong><p class="muted">${escapeHtml(item.batch_code)}</p></article>
        <article><strong>Source</strong><p class="muted">${escapeHtml(item.factory_name || "Lifetime")}</p></article>
        <article><strong>Manufactured</strong><p class="muted">${escapeHtml(item.manufactured_at || "Not supplied")}</p></article>
        <article><strong>Scan Count</strong><p class="muted">${item.scan_count || 0}</p></article>
      </div>
      <div class="inline-actions" style="margin-top:1rem;">
        <a class="btn btn-soft" href="/support.html?serial=${encodeURIComponent(item.serial_code)}">Report an Issue</a>
      </div>
    </div>
  `;
}

async function handleSubmit(event) {
  event.preventDefault();
  const code = event.currentTarget.code.value.trim();
  if (!code) return;
  await verifyCode(code);
}

async function stopScanner() {
  if (scannerFrame) cancelAnimationFrame(scannerFrame);
  scannerFrame = null;
  if (scannerStream) {
    scannerStream.getTracks().forEach((track) => track.stop());
    scannerStream = null;
  }
  if (html5Scanner) {
    try { await html5Scanner.stop(); } catch {}
    try { await html5Scanner.clear(); } catch {}
    html5Scanner = null;
  }
  detector = null;
  document.querySelector('[data-scanner-shell]')?.classList.add('hide');
  document.querySelector('[data-stop-scanner]')?.classList.add('hide');
}

async function handleCodeDetected(value) {
  await stopScanner();
  setScannerNote('Code captured. Running authenticity check…', 'success');
  await verifyCode(value.trim());
}

async function scanLoop() {
  const video = document.querySelector('[data-scanner-video]');
  const canvas = document.querySelector('[data-scanner-canvas]');
  if (!video || !canvas || !detector) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const tick = async () => {
    if (!scannerStream) return;
    if (video.readyState >= 2) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        const barcodes = await detector.detect(canvas);
        const value = barcodes?.[0]?.rawValue?.trim();
        if (value) {
          await handleCodeDetected(value);
          return;
        }
      } catch {}
    }
    scannerFrame = requestAnimationFrame(tick);
  };
  scannerFrame = requestAnimationFrame(tick);
}

async function startHtml5Scanner() {
  if (!window.Html5Qrcode) throw new Error('html5-qrcode unavailable');
  const reader = document.querySelector('[data-scanner-reader]');
  if (!reader) throw new Error('Scanner mount unavailable');
  document.querySelector('[data-scanner-shell]')?.classList.remove('hide');
  document.querySelector('[data-stop-scanner]')?.classList.remove('hide');
  html5Scanner = new window.Html5Qrcode(reader.id);
  const config = { fps: 10, qrbox: { width: 220, height: 220 }, rememberLastUsedCamera: true };
  try {
    await html5Scanner.start({ facingMode: { exact: 'environment' } }, config, handleCodeDetected, () => {});
  } catch {
    await html5Scanner.start({ facingMode: 'environment' }, config, handleCodeDetected, () => {});
  }
  setScannerNote('Camera is live. Point it at the Lifetime QR or barcode label.');
}

async function startDetectorScanner() {
  detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'upc_a'] });
  scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  const video = document.querySelector('[data-scanner-video]');
  video.classList.remove('hide');
  document.querySelector('[data-scanner-shell]')?.classList.remove('hide');
  document.querySelector('[data-stop-scanner]')?.classList.remove('hide');
  video.srcObject = scannerStream;
  await video.play();
  setScannerNote('Camera is live. Point it at the Lifetime QR or barcode label.');
  await scanLoop();
}

async function startScanner() {
  try {
    if (window.Html5Qrcode) {
      await startHtml5Scanner();
      return;
    }
    if ('BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia) {
      await startDetectorScanner();
      return;
    }
    setScannerNote('Live scan is not available in this browser view. Open this page in Safari or Chrome, or upload a label photo.', 'warning');
  } catch {
    setScannerNote('Camera access is unavailable here. Open this page in Safari or Chrome, or upload a label photo.', 'warning');
  }
}

async function handleScanFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!window.Html5Qrcode) {
    setScannerNote('Image scan is not available here yet. Open the page in Safari or enter the code manually.', 'warning');
    return;
  }
  try {
    const scanner = new window.Html5Qrcode('lt-verify-reader');
    const decoded = await scanner.scanFile(file, true);
    setScannerNote('Label image scanned. Running authenticity check…', 'success');
    await verifyCode(decoded.trim());
  } catch {
    setScannerNote('We could not read the label from that image. Try a clearer photo or enter the code manually.', 'danger');
  } finally {
    event.target.value = '';
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.querySelector("[data-verify-form]");
  form?.addEventListener("submit", handleSubmit);
  document.querySelector('[data-start-scanner]')?.addEventListener('click', () => { startScanner(); });
  document.querySelector('[data-stop-scanner]')?.addEventListener('click', () => { stopScanner(); setScannerNote('Scanner stopped. You can start it again or enter the code manually.'); });
  document.querySelector('[data-scan-file]')?.addEventListener('change', handleScanFile);

  const meta = await getStorefrontMeta();
  if (meta.verifyScannerHint) setScannerNote(meta.verifyScannerHint);

  const code = qs("code");
  if (code) verifyCode(code);
});
