# Lifetime Store — Label-First Production Upgrade

This package keeps your working storefront and customer account system, then upgrades the admin side for a more realistic manufacturing workflow.

## What is new
- label-first production workflow inside `Studio LT`
- create product → add variants → create batch → generate inactive labels → print/attach → receive → activate
- printable batch label sheet at `/print-labels.html?batch_id=...`
- admin sign-in can now use **username + password** or your fallback admin token
- verification page now distinguishes between:
  - active authentic items
  - generated but not yet activated items
  - blocked / voided items

## Cloudflare settings required
Keep these bindings active:
- `DB`
- `BUCKET`

Keep these vars/secrets active:
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `ADMIN_TOKEN`
- `RESEND_API_KEY`
- `R2_PUBLIC_BASE_URL`
- `SUPPORT_EMAIL`
- `ORDERS_EMAIL`
- `MAIL_FROM_EMAIL`
- `BRAND_NAME`

Add these for easier admin access:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## D1 migrations to run
Run in this order:
1. `migrations/0001_init.sql`
2. `migrations/0002_admin_upgrade.sql`
3. `migrations/0003_accounts_cart.sql`
4. `migrations/0004_label_first_workflow.sql`

## How the label-first workflow works
1. Create or edit the product draft
2. Add variants
3. Create a batch
4. Generate inactive labels for that batch
5. Open the printable label sheet and print for manufacturing
6. Mark the batch as printed / attached / received
7. Activate the batch when goods are ready for sale

## Notes
- The batch label page uses QR + Code 128 rendering through CDN scripts, so keep the default security policy in this package.
- Admin APIs still support `ADMIN_TOKEN`, but you can now sign in with username/password and receive a secure admin session cookie.
- Customer account, cart sync, checkout, support, and verify flows remain in the package.
