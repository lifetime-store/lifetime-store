
import { apiGet, apiPost, escapeHtml, qs } from "./api.js";

function statusMarkup(authenticity) {
  if (authenticity === "verified") return `<span class="status status-verified">Authentic</span>`;
  if (authenticity === "pending_activation") return `<span class="status status-pending">Pending Activation</span>`;
  if (authenticity === "blocked") return `<span class="status status-void">Blocked</span>`;
  return `<span class="status status-void">Unavailable</span>`;
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

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("[data-verify-form]");
  form?.addEventListener("submit", handleSubmit);

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
