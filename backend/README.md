# pc-tweaker-backend

Node/Express API for PC Tweaker, written in TypeScript: email/password
accounts (bcrypt + JWT) and Stripe Checkout for the Pro subscription. Boots
cleanly even without a database or Stripe configured — routes that need them
return a clear 503 instead of crashing, so you can deploy incrementally.

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
| GET    | `/api/reviews`                   | —      | `{ average, count }` — no user text is ever returned |
| POST   | `/api/reviews`                   | —      | `{ rating }` required; `name`/`email`/`body` optional and private |
| PATCH  | `/api/reviews/:id`               | `x-admin-token` | `{ published }` — include/exclude a score from the average |
| GET    | `/api/reviews/pending`           | `x-admin-token` | Scores currently excluded from the average |
| POST   | `/api/support`                   | —      | Relays the website's support form to `SUPPORT_EMAIL` |

Sessions use a `token_version` column: bumping it (on password reset or
`logout-all`) invalidates every previously issued JWT immediately, even
though JWTs are otherwise stateless and normally can't be revoked before
they expire.

## Local development

```bash
cd backend
npm install
cp .env.example .env   # fill in at least JWT_SECRET to test auth locally
npm run dev             # runs src/index.ts directly via tsx, no build step needed
```

Written in TypeScript (`src/*.ts`). `npm run build` compiles to `dist/`, which
is what `npm start` runs — `npm run dev` skips that and runs the source
directly for a faster local loop.

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
DATABASE_URL=pgmem JWT_SECRET=test-secret npm run dev
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

   For the website's support form and reviews section, also set:
   `SUPPORT_EMAIL` (where support requests are delivered — defaults to the
   maintainer's inbox; it is never exposed to any client) and `ADMIN_TOKEN`
   (a long random string; without it the rating moderation endpoints stay
   closed and answer 404). Only the star rating is public — written feedback
   is emailed to `SUPPORT_EMAIL` and never rendered on the site, which is why
   a rating can count immediately without risking defacement. To exclude a
   bad-faith score from the average, `PATCH /api/reviews/:id` with
   `{"published": false}` and the `x-admin-token` header;
   `GET /api/reviews/pending` lists what you have already excluded.

   `RESEND_API_KEY` is required for the support form to work at all — with no
   mail provider configured it refuses submissions with a 503 rather than
   accepting a message it cannot deliver.
4. Railway detects the `build`/`start` scripts automatically from
   `package.json`: it runs `npm run build` (compiles TypeScript to `dist/`)
   and then `npm start` (`node dist/index.js`). On first boot the server
   creates the `users` table itself (`initSchema()` in `src/db.ts`) — no
   separate migration step needed.
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
  blocking in `routes/auth.ts` if you want it mandatory.
- Rate limiting is per-IP (`express-rate-limit` default `req.ip` keying) —
  fine behind Railway's single proxy (`trust proxy` is set for that), but
  reconsider if you ever put another proxy/CDN in front of this one. Note
  that per-IP limits are bypassable here: Railway doesn't strip an inbound
  `X-Forwarded-For`, so a rotating header defeats them. The anonymous public
  forms are additionally capped by a global hourly budget
  (`src/public-form-guard.ts`) that has no key to rotate.
- Ratings count on submission; there is no email round-trip to confirm one,
  because that is friction no product asks for a star rating. When an address
  is supplied it identifies the vote (one row per address, case-insensitive),
  so re-submitting replaces that person's score instead of adding another —
  but the address is optional and unverified, so it deters casual repeat
  voting rather than a determined one. The global hourly budget in
  `src/public-form-guard.ts` bounds how far the average can be moved in an
  hour, and any score can be excluded afterwards with `PATCH /api/reviews/:id`.
- `is_pro` is a single boolean, not tied to a specific purchase/subscription
  record — sufficient for a one-time lifetime unlock, not for anything more
  complex (seats, renewals, refund tracking).
