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
  };
  less.addEventListener("click", () => set(n - 1));
  more.addEventListener("click", () => set(n + 1));
  root.querySelector(".coffee-step").hidden = false;

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
