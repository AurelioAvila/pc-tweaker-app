import test from "node:test";
import assert from "node:assert/strict";
process.env.DATABASE_URL = "pgmem";
delete process.env.STRIPE_SECRET_KEY;
const { initSchema, getPool } = await import("../dist/db.js");
const { createCheckoutHandler, createGuardedCheckout, retireCompletedCheckout } = await import("../dist/routes/stripe.js");
const { guardedCheckout } = await import("../dist/guarded-checkout.js");
const { unreservedPayableSessions, expireUnreservedSession } = await import("../dist/unreserved-checkout-sessions.js");
await initSchema();
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const list = sessions => p => (async function* () { yield* sessions.filter(s => !p || s.status === p.status); })();
const open = (id, extra = {}) => ({ id, status: "open", payment_status: "unpaid", client_reference_id: "7", metadata: { userId: "7", product: "pctweaker" }, ...extra });

test("open-session search finds only this account's unreserved sessions, and fails rather than under-reporting", async () => {
  const sessions = [
    open("cs_legacy"),
    open("cs_guarded", { metadata: { userId: "7", product: "pctweaker", reservation_id: "r1" } }),
    open("cs_other_user", { client_reference_id: "8", metadata: { userId: "8", product: "pctweaker" } }),
    open("cs_other_product", { metadata: { userId: "7", product: "uninstaller" } }),
    open("cs_unlabelled", { metadata: {} }),
    { id: "cs_tip", status: "open", payment_status: "unpaid", client_reference_id: null, metadata: {} },
  ];
  const found = await unreservedPayableSessions(list(sessions), 7, "pctweaker");
  assert.deepEqual(found.map(s => s.id), ["cs_legacy", "cs_unlabelled"]);
  const windows = [];
  await unreservedPayableSessions(p => { windows.push(p); return list([])(p); }, 7, "pctweaker", Date.parse("2026-10-27T12:00:00Z"));
  const at = Date.parse("2026-10-27T12:00:00Z") / 1000;
  assert.deepEqual(windows.map(w => [w.status, w.created.gte]), [["open", at - 25 * 3600], ["complete", at - 20 * 86400]],
    "open: Stripe's 24-hour maximum; complete: a delayed payment's settlement time");
  const pending = await unreservedPayableSessions(list([
    open("cs_async", { status: "complete", payment_status: "unpaid" }),
    open("cs_paid", { status: "complete", payment_status: "paid" }),
    open("cs_trial", { status: "complete", payment_status: "no_payment_required" }),
  ]), 7, "pctweaker");
  assert.deepEqual(pending.map(s => s.id), ["cs_async"], "only a completed checkout still waiting for its payment can charge again");
  await assert.rejects(unreservedPayableSessions(list([open("a"), open("b"), open("c")]), 7, "pctweaker", Date.now(), 2), /open_session_search_incomplete/);
});

test("an unreserved session is closed only while Stripe reports it open, unpaid and owned", async () => {
  const fake = (current) => { const calls = { expire: 0, expired: [] }; return { calls, sessions: {
    async retrieve() { return { ...current }; },
    async expire() { calls.expire++; return { ...current, status: "expired" }; } } }; };
  let f = fake(open("cs_1"));
  assert.equal(await expireUnreservedSession(f.sessions, 7, "cs_1", async s => f.calls.expired.push(s.id)), true);
  assert.equal(f.calls.expire, 1); assert.deepEqual(f.calls.expired, ["cs_1"]);
  f = fake(open("cs_1", { status: "complete", payment_status: "unpaid" }));
  assert.equal(await expireUnreservedSession(f.sessions, 7, "cs_1", async () => {}), false, "async payment in progress is left alone");
  assert.equal(f.calls.expire, 0);
  f = fake(open("cs_1", { client_reference_id: "8", metadata: { userId: "8" } }));
  assert.equal(await expireUnreservedSession(f.sessions, 7, "cs_1", async () => {}), false, "another account's session is never closed");
  assert.equal(f.calls.expire, 0);
  f = fake(open("cs_1", { status: "expired" }));
  assert.equal(await expireUnreservedSession(f.sessions, 7, "cs_1", async s => f.calls.expired.push(s.id)), true);
  assert.deepEqual(f.calls.expired, ["cs_1"], "a referral quote of an already expired session is still closed");
});

function guardFixture() {
  let row = null; let current = null; let creates = 0; const expired = [];
  const repo = {
    async find(userId, product) { return row && row.user_id === userId && row.product === product ? { ...row } : null; },
    async reserve(user_id, product, plan) { if (row) return { created: false, reservation: { ...row } }; row = { user_id, product, plan, reservation_id: `r${creates + 1}`, state: "creating", session_id: null, created_at: new Date(0) }; return { created: true, reservation: { ...row } }; },
    async attach(id, session) { if (row?.reservation_id !== id || row.state !== "creating") return false; row.state = "open"; row.session_id = session; return true; },
    async complete() { return true; },
    async releaseVerifiedExpired(id, session) { if (row?.reservation_id !== id || row.session_id !== session) return false; row = null; return true; },
  };
  const provider = {
    async create(id) { creates++; current = { id: `cs_${creates}`, url: "https://checkout.stripe.com/c/pay/x", status: "open", payment_status: "unpaid", metadata: { reservation_id: id } }; return { ...current }; },
    async retrieve() { return { ...current }; },
    async expire(id) { expired.push(id); current = { ...current, status: "expired" }; return { ...current }; },
    async findByReservation() { return []; },
    async onExpired() {},
  };
  return { repo, provider, row: () => row, setRow: r => { row = r; }, creates: () => creates, expired };
}

test("a legacy session that appears during creation makes the new one withdraw: never both payable", async () => {
  const x = guardFixture();
  await assert.rejects(guardedCheckout(x.repo, x.provider, 7, "pctweaker", "annual", false, { unreservedSessionOpen: async () => true }),
    e => e.code === "other_checkout_pending");
  assert.deepEqual(x.expired, ["cs_1"], "the guarded session just created is expired");
  assert.equal(x.row(), null, "its reservation is released once Stripe confirms the expiry");
});

test("a stale 'creating' reservation with no Stripe session is released instead of blocking forever", async () => {
  const x = guardFixture();
  x.setRow({ user_id: 7, product: "pctweaker", plan: "annual", reservation_id: "stale", state: "creating", session_id: null, created_at: new Date(0) });
  await assert.rejects(guardedCheckout(x.repo, x.provider, 7, "pctweaker", "annual"), e => e.code === "checkout_recovery_required",
    "without the release capability the old behaviour is kept");
  let released = 0;
  x.repo.releaseStaleCreating = async id => { released++; if (id !== "stale") return false; x.setRow(null); return true; };
  const result = await guardedCheckout(x.repo, x.provider, 7, "pctweaker", "annual");
  assert.equal(released, 1); assert.equal(x.creates(), 1); assert.match(result.url, /^https:\/\/checkout\.stripe\.com\//);
  x.setRow({ user_id: 7, product: "pctweaker", plan: "annual", reservation_id: "young", state: "creating", session_id: null, created_at: new Date() });
  x.repo.releaseStaleCreating = async () => false;
  await assert.rejects(guardedCheckout(x.repo, x.provider, 7, "pctweaker", "annual"), e => e.code === "checkout_recovery_required",
    "a recent reservation may still have a creation in flight");
});

function wired(openSessions, expireResult = true) {
  const x = guardFixture(); const closed = [];
  const guard = createGuardedCheckout({
    reservations: x.repo, sessions: {
      async create(params) { return { id: "cs_new", url: "https://checkout.stripe.com/c/pay/new", status: "open", payment_status: "unpaid", metadata: params.metadata }; },
      async retrieve(id) { return { id, url: "https://checkout.stripe.com/c/pay/new", status: "open", payment_status: "unpaid", metadata: { reservation_id: x.row()?.reservation_id } }; },
      async expire(id) { return { id, status: "expired", payment_status: "unpaid", metadata: { reservation_id: x.row()?.reservation_id } }; },
    },
    getEntitlement: async () => ({ active: false }), referral: async () => null, closeReferral: async () => {}, checkSubscriptions: async () => {},
    openUnreserved: async () => openSessions.splice(0).map(s => typeof s === "string" ? { id: s } : s),
    expireUnreserved: async (_user, id) => { closed.push(id); return expireResult; },
  });
  return { guard, closed, x };
}
const request = (replaceDifferentTerms) => ({ userId: 7, product: "pctweaker", plan: "annual", trial: false, params: { metadata: {} }, replaceDifferentTerms });

test("website asks the customer while the app closes its own legacy session before creating a guarded one", async () => {
  let w = wired(["cs_legacy"]);
  await assert.rejects(w.guard(request(false)), e => e.code === "other_checkout_pending");
  assert.deepEqual(w.closed, []); assert.equal(w.x.row(), null, "nothing reserved, nothing created");
  w = wired(["cs_legacy"]);
  const result = await w.guard(request(true));
  assert.deepEqual(w.closed, ["cs_legacy"]); assert.equal(result.url, "https://checkout.stripe.com/c/pay/new");
  w = wired(["cs_legacy"], false);
  await assert.rejects(w.guard(request(true)), e => e.code === "checkout_recovery_required", "an unconfirmed close never allows a second session");
  assert.equal(w.x.row(), null);
  for (const replace of [false, true]) {
    w = wired([{ id: "cs_legacy_async", status: "complete" }]);
    await assert.rejects(w.guard(request(replace)), e => e.code === "payment_processing", "a legacy delayed payment still settling blocks a second purchase");
    assert.deepEqual(w.closed, []); assert.equal(w.x.row(), null);
  }
});

test("unguarded checkout (cutover bridge) never leaves a session payable next to a guarded reservation", async () => {
  const { rows: [{ id }] } = await getPool().query("INSERT INTO users (email,password_hash,email_verified) VALUES ('bridge@example.test','x',TRUE) RETURNING id");
  let creates = 0; const closed = [];
  const effects = (before, after, closeResult = true) => {
    let checks = 0;
    return { environment: { STRIPE_PRICE_MONTHLY: "fixture" }, now: Date.now,
      async createSession() { creates++; return { url: "https://checkout.stripe.com/c/pay/legacy", id: `cs_legacy_${creates}` }; },
      async guardedReservationOpen() { return ++checks === 1 ? before : after; },
      async expireOwnSession(_user, sessionId) { closed.push(sessionId); return closeResult; } };
  };
  let res = response();
  await createCheckoutHandler(effects(true, true))({ userId: id, body: { plan: "monthly" } }, res);
  assert.equal(res.statusCode, 409); assert.equal(res.body.code, "other_checkout_pending"); assert.equal(creates, 0);
  res = response();
  await createCheckoutHandler(effects(false, true))({ userId: id, body: { plan: "monthly" } }, res);
  assert.equal(res.statusCode, 409); assert.equal(res.body.code, "other_checkout_pending"); assert.deepEqual(closed, ["cs_legacy_1"]);
  res = response();
  await createCheckoutHandler(effects(false, true, false))({ userId: id, body: { plan: "monthly" } }, res);
  assert.equal(res.statusCode, 409); assert.equal(res.body.code, "checkout_recovery_required");
  res = response();
  await createCheckoutHandler(effects(false, false))({ userId: id, body: { plan: "monthly" } }, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.url, "https://checkout.stripe.com/c/pay/legacy", "no guarded reservation: unchanged behaviour");
});

function retireFixture(session, payment) {
  let row = { user_id: 7, product: "pctweaker", plan: "lifetime", reservation_id: "res", state: "complete", session_id: session.id };
  const cancelled = [];
  const reservations = {
    async find() { return row ? { ...row } : null; },
    async complete(id, s) { return Boolean(row && row.reservation_id === id && row.session_id === s); },
    async releaseReconciledCompleted(id, s) { if (!row || row.reservation_id !== id || row.session_id !== s) return false; row = null; return true; },
  };
  const stripe = {
    checkout: { sessions: { async retrieve() { return { ...session }; } } },
    subscriptions: { list: () => (async function* () {})(), async retrieve() { throw Error("no subscription expected"); } },
    paymentIntents: { async retrieve() { return { ...payment }; }, async cancel(id) { cancelled.push(id); payment = { ...payment, status: "canceled" }; return { ...payment }; } },
  };
  return { reservations, stripe, cancelled, row: () => row };
}
const lifetimeSession = extra => ({ id: "cs_life", status: "complete", payment_status: "paid", mode: "payment", customer: "cus_7", client_reference_id: "7",
  payment_intent: "pi_life", metadata: { userId: "7", product: "pctweaker", reservation_id: "res" }, ...extra });

test("a refunded Lifetime purchase stops holding the account, an unrefunded one keeps it", async () => {
  for (const reversed of [true, false]) {
    const f = retireFixture(lifetimeSession(), { id: "pi_life", status: "succeeded", customer: "cus_7", amount_received: 4999 });
    await retireCompletedCheckout({ stripe: f.stripe, reservations: f.reservations, lifetimeReversed: async id => reversed && id === "cs_life" }, 7, "pctweaker", "cus_7", false);
    assert.equal(f.row() === null, reversed);
  }
});

test("a failed delayed payment is cancelled and released; one still processing is left alone", async () => {
  const unpaid = lifetimeSession({ payment_status: "unpaid" });
  let f = retireFixture(unpaid, { id: "pi_life", status: "requires_payment_method", customer: "cus_7", amount_received: 0 });
  await retireCompletedCheckout({ stripe: f.stripe, reservations: f.reservations, lifetimeReversed: async () => false }, 7, "pctweaker", "cus_7", false);
  assert.deepEqual(f.cancelled, ["pi_life"]); assert.equal(f.row(), null);
  f = retireFixture(unpaid, { id: "pi_life", status: "processing", customer: "cus_7", amount_received: 0 });
  await retireCompletedCheckout({ stripe: f.stripe, reservations: f.reservations, lifetimeReversed: async () => false }, 7, "pctweaker", "cus_7", false);
  assert.deepEqual(f.cancelled, []); assert.notEqual(f.row(), null, "the bank may still confirm it");
  f = retireFixture(lifetimeSession({ payment_status: "unpaid", metadata: { userId: "7", product: "pctweaker", reservation_id: "res", referral_quote: "q" } }),
    { id: "pi_life", status: "requires_payment_method", customer: "cus_7", amount_received: 0 });
  await retireCompletedCheckout({ stripe: f.stripe, reservations: f.reservations, lifetimeReversed: async () => false }, 7, "pctweaker", "cus_7", false);
  assert.deepEqual(f.cancelled, [], "referral sessions are reconciled through their quote, never cancelled here");
});

test("a definite Stripe refusal frees the account at once; an uncertain failure keeps it reserved", async () => {
  const { stripeGuardedProvider } = await import("../dist/stripe-guarded-provider.js");
  const refused = stripeGuardedProvider({}, {}).refused;
  for (const [error, definite] of [
    [{ type: "StripeInvalidRequestError", statusCode: 400 }, true],
    [{ type: "StripeInvalidRequestError", statusCode: 404 }, true],
    [{ type: "StripeInvalidRequestError", statusCode: 409 }, false],
    [{ type: "StripeRateLimitError", statusCode: 429 }, false],
    [{ type: "StripeConnectionError" }, false],
    [{ type: "StripeAPIError", statusCode: 500 }, false],
    [{ type: "StripeIdempotencyError", statusCode: 400 }, false],
    [new Error("timeout"), false],
  ]) assert.equal(refused(error), definite, JSON.stringify(error));
  for (const [error, definite] of [[Object.assign(new Error("tax code missing"), { type: "StripeInvalidRequestError", statusCode: 400 }), true], [new Error("socket hang up"), false]]) {
    const x = guardFixture(); let released = 0;
    x.repo.releaseRefusedCreating = async id => { released++; if (x.row()?.reservation_id === id && x.row().state === "creating") { x.setRow(null); return true; } return false; };
    x.provider.create = async () => { throw error; };
    x.provider.refused = refused;
    await assert.rejects(guardedCheckout(x.repo, x.provider, 7, "pctweaker", "annual"), e => e === error);
    assert.equal(released, definite ? 1 : 0);
    assert.equal(x.row() === null, definite, definite ? "refusal: free to try again" : "uncertain: stays reserved");
  }
});
