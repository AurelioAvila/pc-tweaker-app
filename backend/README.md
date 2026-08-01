# pc-tweaker-backend

Minimal Node/Express API for PC Tweaker: email/password accounts (bcrypt + JWT)
and one-time Stripe Checkout for the Pro upgrade. Boots cleanly even without a
database or Stripe configured — routes that need them return a clear 503
instead of crashing, so you can deploy incrementally.

## Endpoints

| Method | Path                            | Auth   | Notes                                              |
|--------|----------------------------------|--------|-----------------------------------------------------|
| GET    | `/health`                        | —      | `{ ok, databaseConfigured }`                        |
| POST   | `/api/auth/register`             | —      | `{ email, password }` → `{ token }`, sends verification email |
| POST   | `/api/auth/login`                | —      | `{ email, password }` → `{ token }`                 |
| POST   | `/api/auth/logout-all`           | Bearer | Invalidates every token issued before now           |
| GET    | `/api/auth/verify-email`         | —      | `?token=...` from the verification email; HTML page |
| POST   | `/api/auth/resend-verification`  | Bearer | Resends the verification email                     |
| POST   | `/api/auth/forgot-password`      | —      | `{ email }`, always `200` (doesn't leak account existence) |
| GET    | `/api/auth/reset-password`       | —      | `?token=...` from the reset email; HTML form        |
| POST   | `/api/auth/reset-password`       | —      | `{ token, newPassword }`, invalidates old sessions  |
| GET    | `/api/account`                   | Bearer | `{ email, isPro, emailVerified }`                   |
| POST   | `/api/checkout`                  | Bearer | `{ }` → `{ url }` (Stripe Checkout URL)             |
| POST   | `/api/stripe-webhook`            | Stripe signature | called by Stripe, not by the app         |

Sessions use a `token_version` column: bumping it (on password reset or
`logout-all`) invalidates every previously issued JWT immediately, even
though JWTs are otherwise stateless and normally can't be revoked before
they expire.

## Local development

```bash
cd backend
npm install
cp .env.example .env   # fill in at least JWT_SECRET to test auth locally
npm run dev
```

Without `DATABASE_URL` set, auth/account endpoints correctly respond `503`
instead of crashing — useful for checking the server boots and routes are
wired before you provision a database.

Without `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` set, verification and
password-reset emails aren't sent — the email content (including the link)
is logged to the server console instead, so you can still test the whole
flow locally without real SMTP credentials.

### Testing against a real (in-memory) database without installing Postgres

`DATABASE_URL=pgmem` runs the server against [pg-mem](https://github.com/oguimbal/pg-mem),
an in-memory Postgres-compatible engine — useful for exercising the actual
SQL (not just the "no database" error paths) without installing a real
database:

```bash
DATABASE_URL=pgmem JWT_SECRET=test-secret npm start
```

Never use `pgmem` outside of local testing — data doesn't persist across restarts.

## Deploying to Railway

1. **Create a new Railway project**, then "Deploy from GitHub repo" pointing
   at this `backend/` folder (Railway lets you set a custom root directory).
2. **Add the Postgres plugin** (Railway → New → Database → PostgreSQL). It
   automatically injects `DATABASE_URL` into your service — you don't need to
   set it by hand.
3. **Set the remaining environment variables** on the service (Railway →
   Variables): `JWT_SECRET` (generate with `openssl rand -hex 32`),
   `APP_URL` (your Railway URL, needed for email links), `CORS_ORIGINS`,
   `RESEND_API_KEY`/`MAIL_FROM` (for real verification/reset emails — without
   this, the server logs the email content instead of sending it; use Resend
   rather than `SMTP_*` on Railway, since it blocks outbound SMTP ports),
   `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, `CHECKOUT_SUCCESS_URL`,
   `CHECKOUT_CANCEL_URL`. See `.env.example` for what each one is.
4. Railway detects `npm start` automatically from `package.json`. On first
   boot the server creates the `users` table itself (`initSchema()` in
   `src/db.js`) — no separate migration step needed.
5. Once deployed, rebuild the desktop app pointing at the new URL:
   ```bash
   VITE_API_BASE_URL=https://your-service.up.railway.app npm run build
   ```
   (set in `pc-tweaker-app/` root, not here in `backend/`).

## Setting up Stripe

1. Dashboard → Product catalog → create a product with a **one-time** price
   (not recurring) — e.g. "PC Tweaker Pro — €9.99". Copy its `price_...` ID
   into `STRIPE_PRICE_ID`.
2. Dashboard → Developers → API keys → copy the **secret** key (`sk_...`)
   into `STRIPE_SECRET_KEY`. Never put this in the desktop app — it only
   belongs on this server.
3. Dashboard → Developers → Webhooks → add endpoint
   `https://your-service.up.railway.app/api/stripe-webhook`, subscribe to
   `checkout.session.completed`, copy the signing secret (`whsec_...`) into
   `STRIPE_WEBHOOK_SECRET`.
4. Test with card `4242 4242 4242 4242`, any future date, any CVC, while
   using the `sk_test_...`/`whsec_test...` (test mode) keys. Switch to live
   keys only once you've verified the whole flow end to end.
5. `CHECKOUT_SUCCESS_URL`/`CHECKOUT_CANCEL_URL` just need to be pages you
   control (can be a single static "thanks, go back to the app" page) —
   Stripe Checkout opens in the user's system browser, not inside the
   desktop app, so these don't need to be inside PC Tweaker itself.

## What's intentionally not here

- Registration doesn't require email verification before logging in (it's
  tracked and nudged via the account menu, not enforced) — flip that to
  blocking in `routes/auth.js` if you want it mandatory.
- Rate limiting is per-IP (`express-rate-limit` default `req.ip` keying) —
  fine behind Railway's single proxy (`trust proxy` is set for that), but
  reconsider if you ever put another proxy/CDN in front of this one.
- `is_pro` is a single boolean, not tied to a specific purchase/subscription
  record — sufficient for a one-time lifetime unlock, not for anything more
  complex (seats, renewals, refund tracking).
