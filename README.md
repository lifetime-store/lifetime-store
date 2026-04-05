# Lifetime advanced production package

This package upgrades the current Lifetime store with production-focused improvements:
- Hidden private admin at `/studio-lt.html`
- R2 product image uploads from admin
- Paystack checkout flow
- Paystack webhook endpoint for server-side confirmation
- Email alerts for paid orders and support issues
- Customer confirmation emails for paid orders and support requests
- Security headers middleware for every response
- Cleaner customer-facing copy with no preview/demo wording

## What this package expects in Cloudflare
### Bindings
- D1 database: `DB`
- R2 bucket: `BUCKET`

### Secrets
- `ADMIN_TOKEN`
- `PAYSTACK_SECRET_KEY`
- `RESEND_API_KEY` (for order/issue emails)

### Variables
- `BRAND_NAME`
- `BRAND_EMAIL`
- `R2_PUBLIC_BASE_URL`
- `PAYSTACK_PUBLIC_KEY`
- `ALERT_TO_EMAIL` (where internal order/issue alerts should go)
- `MAIL_FROM_EMAIL` (verified sender for Resend, e.g. `Lifetime <orders@yourdomain.com>`)

## Upload to GitHub
Replace the contents of your `lifetime-store` repo root with:
- `public/`
- `functions/`
- `migrations/`
- `package.json`
- `wrangler.toml`
- `README.md`

Do not upload the zip itself. Upload the extracted files.

## After deploy
1. Redeploy Cloudflare Pages.
2. Confirm the admin page loads at `/studio-lt.html`.
3. Confirm product uploads still work.
4. Add this Paystack webhook URL in Paystack after deploy:
   `https://lifetime-store.pages.dev/api/paystack/webhook`
5. Set up Resend (or another supported sender) and add:
   - `RESEND_API_KEY`
   - `MAIL_FROM_EMAIL`
   - `ALERT_TO_EMAIL`

## Recommended dashboard security steps (manual)
These are not bundled in code and must be configured in Cloudflare/Paystack:
- Protect `/studio-lt.html` with **Cloudflare Access**
- Add **Cloudflare Turnstile** to admin, support, and checkout forms
- Add **Rate Limiting Rules** for `/api/admin/*`, `/api/paystack/*`, `/api/support`, and `/api/verify/*`
- Add a **custom domain** and redirect `pages.dev` traffic to it
- Rotate all exposed secrets immediately if they were ever shown on screen
