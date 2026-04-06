import { apiGet, escapeHtml, qs } from "./api.js";

function labelCard(batch, code) {
  const verifyUrl = `${window.location.origin}/verify.html?code=${encodeURIComponent(code.serial_code)}`;
  return `
    <article class="label-card">
      <div class="label-brand">LIFETIME</div>
      <div class="label-product">${escapeHtml(batch.product_name)}</div>
      <div class="label-meta">${escapeHtml(batch.color || "Standard")} / ${escapeHtml(batch.size || "OS")}</div>
      <div class="label-grid">
        <div>
          <div class="qr-slot" data-qr="${escapeHtml(verifyUrl)}"></div>
          <div class="label-small">Scan to verify after activation</div>
        </div>
        <div class="label-copy">
          <div class="label-copy-row"><strong>Batch</strong><span>${escapeHtml(batch.batch_code)}</span></div>
          <div class="label-copy-row"><strong>Auth code</strong><span>${escapeHtml(code.serial_code)}</span></div>
          <div class="label-copy-row"><strong>Status</strong><span>${escapeHtml(code.status)}</span></div>
          <div class="label-copy-row"><strong>Factory</strong><span>${escapeHtml(batch.factory_name || "Lifetime production partner")}</span></div>
        </div>
      </div>
      <svg class="barcode-slot" jsbarcode-format="CODE128" data-barcode="${escapeHtml(code.serial_code)}"></svg>
      <div class="label-small">Internal scan / manual fallback: ${escapeHtml(code.serial_code)}</div>
    </article>
  `;
}

async function load() {
  const batchId = qs("batch_id");
  const mount = document.querySelector("[data-label-sheet]");
  if (!batchId) {
    mount.innerHTML = `<div class="notice notice-danger">No batch selected.</div>`;
    return;
  }

  const [batchRes, codesRes] = await Promise.all([
    apiGet(`/api/admin/batches?batch_id=${encodeURIComponent(batchId)}`, true),
    apiGet(`/api/admin/codes?batch_id=${encodeURIComponent(batchId)}`, true)
  ]);

  if (!batchRes.ok || !batchRes.batch) {
    mount.innerHTML = `<div class="notice notice-danger">${escapeHtml(batchRes.message || "Could not load the batch.")}</div>`;
    return;
  }

  if (!codesRes.ok) {
    mount.innerHTML = `<div class="notice notice-danger">${escapeHtml(codesRes.message || "Could not load labels.")}</div>`;
    return;
  }

  const batch = batchRes.batch;
  const codes = codesRes.codes || [];

  if (!codes.length) {
    mount.innerHTML = `<div class="notice">No labels generated for this batch yet.</div>`;
    return;
  }

  mount.innerHTML = codes.map((code) => labelCard(batch, code)).join("");

  if (window.QRCode) {
    document.querySelectorAll("[data-qr]").forEach((el) => {
      const text = el.dataset.qr;
      el.innerHTML = "";
      new window.QRCode(el, {
        text,
        width: 96,
        height: 96,
        correctLevel: window.QRCode.CorrectLevel.M
      });
    });
  }

  if (window.JsBarcode) {
    document.querySelectorAll("[data-barcode]").forEach((svg) => {
      try {
        window.JsBarcode(svg, svg.dataset.barcode, {
          format: "CODE128",
          displayValue: false,
          margin: 0,
          height: 42
        });
      } catch {
        svg.outerHTML = `<div class="label-small">${escapeHtml(svg.dataset.barcode || "")}</div>`;
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", load);
