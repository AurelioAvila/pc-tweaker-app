// "Buy me a coffee", the same shared tip as PC Tweaker. The link works without
// JavaScript (one coffee, straight to Stripe Checkout via the plain launcher);
// this adds the 1..10 stepper and the thank-you note on the way back.
(() => {
  const root = document.getElementById("tip");
  if (!root) return;
  const link = root.querySelector("[data-coffee-link]");
  const count = root.querySelector("[data-coffee-count]");
  const less = root.querySelector('[data-coffee="-1"]');
  const more = root.querySelector('[data-coffee="1"]');
  const max = 10; // the launcher clamps to this too
  // Paying in USDC: shown only while the API offers it (crypto.available), at
  // one coffee's price in US cents for the visitor's country.
  const cryptoLink = root.querySelector("[data-coffee-crypto]");
  let cryptoCents = 0;
  const usd = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  const showCrypto = () => {
    if (!cryptoCents) return;
    cryptoLink.textContent = `or pay ≈ ${usd(n * cryptoCents)} in crypto (USDC)`;
    cryptoLink.href = `https://api.pctweaker.app/api/tip/start?product=tweaky&quantity=${n}&method=crypto`;
    cryptoLink.hidden = false;
  };
  let n = 1;
  const set = (value) => {
    n = Math.min(max, Math.max(1, value));
    count.textContent = `${n} ☕`;
    count.classList.remove("pop");
    void count.offsetWidth; // restart the pop
    count.classList.add("pop");
    less.disabled = n <= 1;
    more.disabled = n >= max;
    link.href = `https://api.pctweaker.app/api/tip/start?product=tweaky&quantity=${n}`;
    showCrypto();
  };
  less.addEventListener("click", () => set(n - 1));
  more.addEventListener("click", () => set(n + 1));
  root.querySelector(".coffee-step").hidden = false;
  fetch("https://api.pctweaker.app/api/billing/prices", { credentials: "omit", signal: AbortSignal.timeout(8000) })
    .then((r) => (r.ok ? r.json() : null))
    .then((prices) => {
      const cents = prices && prices.crypto && prices.crypto.available === true && prices.crypto.coffee && prices.crypto.coffee.usd;
      if (cryptoLink && Number.isInteger(cents) && cents > 0) {
        cryptoCents = cents;
        showCrypto();
      }
    })
    .catch(() => {}); // no answer: card only, as before

  // Back from Stripe: thank on success, say nothing on cancel, then drop the query.
  const params = new URLSearchParams(location.search);
  const tip = params.get("tip");
  if (tip) {
    if (tip === "thanks") {
      const note = root.querySelector("[data-coffee-note]");
      note.setAttribute("role", "status");
      note.textContent = "Thank you for the coffee! It goes straight into the next release.";
      root.scrollIntoView({ block: "center" });
    }
    params.delete("tip");
    const rest = params.toString();
    history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : "") + location.hash);
  }
})();
