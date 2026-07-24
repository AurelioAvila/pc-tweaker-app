# pc-tweaker-backend

Minimal Node/Express API for PC Tweaker: email/password accounts (bcrypt + JWT)
and one-time Stripe Checkout for the Pro upgrade. Boots cleanly even without a
database or Stripe configured — routes that need them return a clear 503
instead of crashing, so you can deploy incrementally.

## Endpoints

| Method | Path                  | Auth | Notes                                      |
|--------|-----------------------|------|---------------------------------------------|
| GET    | `/health`             | —    | `{ ok, databaseConfigured }`                |
| POST   | `/api/auth/register`  | —    | `{ email, password }` → `{ token }`         |
| POST   | `/api/auth/login`     | —    | `{ email, password }` → `{ token }`         |
| GET    | `/api/account`        | Bearer | `{ email, isPro }`                        |
| POST   | `/api/checkout`       | Bearer | `{ }` → `{ url }` (Stripe Checkout URL)   |
| POST   | `/api/stripe-webhook` | Stripe signature | called by Stripe, not by the app |

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

## Deploying to Railway

1. **Create a new Railway project**, then "Deploy from GitHub repo" pointing
   at this `backend/` folder (Railway lets you set a custom root directory).
2. **Add the Postgres plugin** (Railway → New → Database → PostgreSQL). It
   automatically injects `DATABASE_URL` into your service — you don't need to
   set it by hand.
3. **Set the remaining environment variables** on the service (Railway →
   Variables): `JWT_SECRET` (generate with `openssl rand -hex 32`),
   `CORS_ORIGINS`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_PRICE_ID`, `CHECKOUT_SUCCESS_URL`, `CHECKOUT_CANCEL_URL`. See
   `.env.example` for what each one is.
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

- No email verification / password reset flow yet — add before shipping to
  real users.
- No refresh tokens — the JWT is long-lived (30 days) and there's no
  revocation list. Fine for a v1, worth hardening later.
- `is_pro` is a single boolean, not tied to a specific purchase/subscription
  record — sufficient for a one-time lifetime unlock, not for anything more
  complex (seats, renewals, refund tracking).
