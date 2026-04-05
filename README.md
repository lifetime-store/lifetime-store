# Lifetime production-ready store package

This package is the clean replacement for your `lifetime-store` repo.

## What is included
- Hidden private admin at `/studio-lt.html`
- Full admin product management
- Product image upload through admin
- R2 image storage support
- Paystack checkout flow
- D1 products, variants, batches, codes, orders, and support records
- Cleaner customer-facing copy with no preview/demo wording

## Before deploy
Make sure these already exist in Cloudflare:
- D1 database: `lifetime_store_db`
- R2 bucket: `lifetime-products`
- Secret: `ADMIN_TOKEN`
- Secret: `PAYSTACK_SECRET_KEY`

## Upload to GitHub
Replace the contents of your `lifetime-store` repo root with:
- `public/`
- `functions/`
- `migrations/`
- `package.json`
- `wrangler.toml`
- `README.md`

Do not upload the zip itself. Upload the extracted files.

## Cloudflare settings
This package expects:
- D1 binding: `DB`
- R2 binding: `BUCKET`
- R2 public base URL:
  `https://pub-9e90e5f450064cbeb75d5403e2acd4ed.r2.dev`

If the dashboard Add button for Bindings does not work, the binding is already defined in `wrangler.toml`.

## Paystack
The checkout flow is ready for Paystack.
- Keep using `sk_test_...` until your account is approved.
- When you are ready for live payments, replace `PAYSTACK_SECRET_KEY` in Cloudflare with your live secret and redeploy.

## Admin link
Keep this private:
`https://lifetime-store.pages.dev/studio-lt.html`
