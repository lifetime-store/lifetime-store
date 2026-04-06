import { apiGet, apiPost, escapeHtml, qs } from "./api.js";

let scannerStream = null;
let scannerFrame = null;
let detector = null;

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
        <article><strong>Factory</strong><p class="muted">${escapeHtml(item.factory_name || "Lifetime production partner")}</p></article>
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

function stopScanner() {
  if (scannerFrame) cancelAnimationFrame(scannerFrame);
  scannerFrame = null;
  if (scannerStream) {
    scannerStream.getTracks().forEach((track) => track.stop());
    scannerStream = null;
  }
  document.querySelector('[data-scanner-shell]')?.classList.add('hide');
  document.querySelector('[data-stop-scanner]')?.classList.add('hide');
  setScannerNote('Scanner stopped. You can start it again or enter the code manually.');
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
          stopScanner();
          setScannerNote('Code captured. Running authenticity check…', 'success');
          await verifyCode(value);
          return;
        }
      } catch {}
    }
    scannerFrame = requestAnimationFrame(tick);
  };
  scannerFrame = requestAnimationFrame(tick);
}

async function startScanner() {
  if (!('BarcodeDetector' in window) || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
    setScannerNote('Live scanning is not supported on this browser yet. Please enter the code manually or open the page in a modern mobile browser.', 'warning');
    return;
  }
  try {
    detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'upc_a'] });
    scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    const video = document.querySelector('[data-scanner-video]');
    video.srcObject = scannerStream;
    await video.play();
    document.querySelector('[data-scanner-shell]')?.classList.remove('hide');
    document.querySelector('[data-stop-scanner]')?.classList.remove('hide');
    setScannerNote('Camera is live. Point it at the Lifetime label QR or barcode.');
    await scanLoop();
  } catch (error) {
    setScannerNote('Camera access was denied or unavailable. You can still verify with the printed code manually.', 'danger');
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("[data-verify-form]");
  form?.addEventListener("submit", handleSubmit);
  document.querySelector('[data-start-scanner]')?.addEventListener('click', startScanner);
  document.querySelector('[data-stop-scanner]')?.addEventListener('click', stopScanner);

  const code = qs("code");
  if (code) verifyCode(code);
});

document.addEventListener("DOMContentLoaded", () => {
  const supportForm = document.querySelector("[data-support-form]");
  if (!supportForm) return;

  const serial = qs("serial");
  if (serial) {
    const serialField = supportForm.querySelector("[name='serial_code']");
    if (serialField) serialField.value = serial;
  }

  supportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(supportForm).entries());
    const result = await apiPost("/api/support", payload);
    const notice = document.querySelector("[data-support-notice]");
    notice.innerHTML = result.ok
      ? `<div class="notice notice-success">Your message has been submitted.</div>`
      : `<div class="notice notice-danger">${escapeHtml(result.message || "Submission failed.")}</div>`;
    if (result.ok) supportForm.reset();
  });
});
