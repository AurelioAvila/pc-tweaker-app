// Halloween offer, read live from the Tweaky Driver account service. The service
// decides the discount at checkout; this page only shows it while the service
// confirms it, and keeps the regular prices on any failure.
(async () => {
  const prices = document.getElementById("halloween-prices");
  // The strip and the card keep their room, invisible, until the answer: the page does not jump.
  const strip = document.getElementById("halloween-strip");
  const card = document.getElementById("halloween-card");
  const drop = () => [strip, card].forEach((el) => el && (el.hidden = true));
  let dismissed = false;
  try {
    dismissed = Object.keys(localStorage).some((k) => k.startsWith("tweaky-hw-strip:") && localStorage.getItem(k) === "1");
  } catch {} // storage blocked: the strip simply shows
  if (dismissed && strip) strip.hidden = true;
  if (!prices || Date.now() >= Date.parse("2026-11-06T23:00:00Z")) return drop();
  let promo, received, wall;
  try {
    const response = await fetch(
      "https://tweaky-driver-account-production.up.railway.app/v1/billing/promo",
      { credentials: "omit", signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) return drop();
    promo = await response.json();
    received = performance.now();
    wall = Date.now();
  } catch {
    return drop();
  }
  const regular = { monthly: 399, annual: 1599 };
  const offers = promo && promo.status === "active" && Array.isArray(promo.offers) ? promo.offers : [];
  const offer = (plan) =>
    offers.find(
      (o) =>
        o && o.plan === plan && o.currency === "eur" && o.regular === regular[plan] &&
        Number.isInteger(o.reference) && o.reference <= o.regular &&
        Number.isInteger(o.price) && o.price > 0 && o.price < o.reference && o.firstPeriodOnly === true,
    );
  const monthly = offer("monthly"), annual = offer("annual");
  const end = Date.parse(promo && promo.endsAt) - Date.parse(promo && promo.serverTime);
  if (!monthly || !annual || !(end > 0)) return drop();

  const euro = (cents) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
  const off = (o) => Math.floor(((o.reference - o.price) * 100) / o.reference); // never rounded up
  const fill = (plan, o) => {
    prices.querySelector(`[data-ref="${plan}"]`).textContent = euro(o.reference);
    prices.querySelector(`[data-price="${plan}"]`).textContent = euro(o.price);
    prices.querySelector(`[data-then="${plan}"]`).textContent = euro(o.regular);
    prices.querySelector(`[data-off="${plan}"]`).textContent = `−${off(o)}%`;
    prices.querySelector(`[data-off-sr="${plan}"]`).textContent = `${off(o)}% off`;
  };
  fill("monthly", monthly);
  fill("annual", annual);
  const until = new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome",
  }).format(Date.parse(promo.endsAt) - 60000); // the last minute on sale
  prices.querySelector("[data-until]").textContent = `Ends ${until}, Rome time`;

  // Top strip and headline card: the same real numbers, shown where visitors land.
  const pct = Math.min(off(monthly), off(annual));
  const stripKey = `tweaky-hw-strip:${promo.id}`;
  let stripClosed = false;
  try {
    stripClosed = localStorage.getItem(stripKey) === "1";
  } catch {} // storage blocked: the strip simply shows
  if (card) {
    card.querySelector("[data-card-now]").textContent = euro(annual.price);
    card.querySelector("[data-card-was]").textContent = euro(annual.reference);
    card.querySelector("[data-card-pct]").textContent = `−${off(annual)}%`;
    card.querySelector("[data-card-plan]").textContent = `Pro · first year, then ${euro(annual.regular)} / year`;
    card.querySelector("[data-card-note]").textContent = `Ends ${until}, Rome time`;
  }
  if (strip) {
    strip.querySelectorAll("[data-pct]").forEach((n) => {
      n.textContent = String(pct);
    });
    strip.querySelector(".hw-strip-close").addEventListener("click", () => {
      stripClosed = true;
      strip.hidden = true;
      try {
        localStorage.setItem(stripKey, "1");
      } catch {}
    });
  }

  let timer = 0;
  const tick = () => {
    // Whichever clock advanced more: sleep or a changed PC clock can only shorten the offer.
    const left = end - Math.max(performance.now() - received, Date.now() - wall);
    if (left <= 0) {
      clearInterval(timer);
      prices.hidden = true;
      if (strip) strip.hidden = true;
      if (card) card.hidden = true;
      return;
    }
    const s = Math.floor(left / 1000);
    const parts = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
    const text = `Ends in ${parts[0]} days, ${parts[1]} hours, ${parts[2]} minutes`;
    if (strip) {
      strip.querySelector("[data-strip-prefix]").textContent = "Ends in ";
      strip.querySelector("[data-strip-clock]").textContent =
        `${parts[0]}d ${String(parts[1]).padStart(2, "0")}h ${String(parts[2]).padStart(2, "0")}m ${String(parts[3]).padStart(2, "0")}s`;
      strip.querySelector("#halloween-strip-timer").setAttribute("aria-label", text);
    }
  };
  tick();
  prices.hidden = false;
  for (const el of [card, stripClosed ? null : strip]) {
    if (el) {
      el.classList.remove("hw-reserved");
      el.removeAttribute("aria-hidden");
    }
  }
  if (strip && stripClosed) strip.hidden = true;
  timer = setInterval(tick, 1000);
})();
