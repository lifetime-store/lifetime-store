# Lifetime Store — Upgraded Production Package

This upgraded package includes:
- premium storefront refresh
- Paystack checkout initialization and verification
- D1 product, variants, orders, and verification code support
- private admin APIs with R2 image upload support
- customer account system (register, login, logout, account page)
- saved cart sync across devices for signed-in customers
- support and orders email wiring

## Required Cloudflare secrets
Set these in Workers & Pages → lifetime-store → Settings → Variables and Secrets:
- ADMIN_TOKEN
- PAYSTACK_SECRET_KEY
- RESEND_API_KEY

## Required bindings
Already expected by this package:
- D1 database binding: `DB`
- R2 bucket binding: `BUCKET`

## Migrations to run
Run these against `lifetime_store_db`:
1. `migrations/0001_init.sql`
2. `migrations/0002_admin_upgrade.sql`
3. `migrations/0003_accounts_cart.sql`

## Important notes
- Public logo file is included at `public/assets/logo.png`
- Customer session uses a secure HTTP-only cookie
- Signed-in carts sync through `/api/cart`
- After deploy, test: register, login, add to cart, checkout, paystack callback, verify page, support form

## Paystack webhook
Use:
- `https://lifetime-store.shop/api/paystack/webhook`

## Git / Pages setup
- Build command: leave empty if already using static Pages deployment
- Build output directory: `public`
- Root directory: repo root


## Account setup required
To make register and login work, run the D1 migration file `migrations/0003_accounts_cart.sql` after upload.

## Cloudflare bindings and secrets
Required bindings:
- `DB` → your D1 database
- `BUCKET` → your R2 bucket

Required secrets/plaintext values:
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_PUBLIC_KEY`
- `ADMIN_TOKEN`
- `RESEND_API_KEY`
- `R2_PUBLIC_BASE_URL`
- `SUPPORT_EMAIL`
- `ORDERS_EMAIL`
- `MAIL_FROM_EMAIL`
- `BRAND_NAME`

## Quick auth test
After deploy:
1. Open `/register.html`
2. Create a new account
3. Open `/account.html`
4. Log out
5. Open `/login.html` and sign back in
