# Lifetime Store — Super Website Upgrade

This package upgrades Lifetime into a stronger production-ready storefront and admin workflow.

## Added in this build
- stronger Studio LT admin flow with easier stock editing and quick stock buttons
- label-first manufacturing workflow kept intact
- country-aware price preview using Cloudflare country detection
- event discounts and storewide promo engine
- buyer premium levels with automatic discount support
- customer insights in admin
- promotion and promo-code management in admin
- improved checkout summary with promo validation and buyer-tier preview
- more realistic storefront presentation with regional pricing banner and richer product cards

## Run these D1 migrations in order
- `migrations/0001_init.sql`
- `migrations/0002_admin_upgrade.sql`
- `migrations/0003_accounts_cart.sql`
- `migrations/0004_label_first_workflow.sql`
- `migrations/0005_super_website_upgrade.sql`

If your database already had the first migrations, only run the new one once:
- `0005_super_website_upgrade.sql`

## Required Cloudflare bindings/secrets
Keep these active:
- `DB`
- `BUCKET`
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `ADMIN_TOKEN`
- `RESEND_API_KEY`
- `R2_PUBLIC_BASE_URL`
- `SUPPORT_EMAIL`
- `ORDERS_EMAIL`
- `MAIL_FROM_EMAIL`
- `BRAND_NAME`

For username/password admin login add:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## New admin pages/features
- Studio LT shows products, variants, batches, authenticity codes, orders
- promotions and promo codes can now be created from Studio LT
- customer/buyer premium levels appear in Studio LT
- quick stock buttons are available directly on variant cards

## Notes about currency preview
The storefront now uses Cloudflare country detection to choose a local preview currency.
Checkout still settles in NGN for safety and consistency.
You can adjust conversion rates later from the `site_settings` table.
