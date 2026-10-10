// Halloween offer, read live from the Tweaky Driver account service. The service
// decides the discount at checkout; this page only shows it while the service
// confirms it, and keeps the regular prices on any failure.
(async () => {
  const box = document.getElementById("halloween");
  const prices = document.getElementById("halloween-prices");
  if (!box || !prices) return;
  let promo, received, wall;
  try {
    const response = await fetch(
      "https://tweaky-driver-account-production.up.railway.app/v1/billing/promo",
      { credentials: "omit", signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) return;
    promo = await response.json();
    received = performance.now();
    wall = Date.now();
  } catch {
    return;
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
  if (!monthly || !annual || !(end > 0)) return;

  const euro = (cents) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
  const off = (o) => Math.floor(((o.reference - o.price) * 100) / o.reference); // never rounded up
  const fill = (plan, o) => {
    prices.querySelector(`[data-ref="${plan}"]`).textContent = euro(o.reference);
    prices.querySelector(`[data-price="${plan}"]`).textContent = euro(o.price);
    prices.querySelector(`[data-then="${plan}"]`).textContent = euro(o.regular);
    prices.querySelector(`[data-off="${plan}"]`).textContent = `${off(o)}% off`;
  };
  fill("monthly", monthly);
  fill("annual", annual);
  box.querySelector("[data-until]").textContent = new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome",
  }).format(Date.parse(promo.endsAt) - 60000); // the last minute on sale
  const units = box.querySelectorAll("[data-unit]");
  const label = document.getElementById("halloween-timer");
  let timer = 0;
  const tick = () => {
    // Whichever clock advanced more: sleep or a changed PC clock can only shorten the offer.
    const left = end - Math.max(performance.now() - received, Date.now() - wall);
    if (left <= 0) {
      clearInterval(timer);
      box.hidden = prices.hidden = true;
      return;
    }
    const s = Math.floor(left / 1000);
    const parts = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
    parts.forEach((v, i) => {
      units[i].textContent = String(v).padStart(2, "0");
    });
    label.setAttribute("aria-label", `Ends in ${parts[0]} days, ${parts[1]} hours, ${parts[2]} minutes`);
  };
  tick();
  box.hidden = prices.hidden = false;
  timer = setInterval(tick, 1000);
})();
