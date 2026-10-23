"""Main window at every short-window tier, rendered in Brave against the Vite dev server.

Usage: python scripts/qa/sidebar-fit.py <base-url> [screenshot-dir]
Start the dev server first (`npx vite --port 8792 --strictPort`; never port 8765). The Tauri IPC
and the account API are mocked (signed out, free trial on offer). For every language and window
size from 1400x900 down to the 820x600 minimum, checks that the whole sidebar menu and its footer
(Plans & pricing, Buy me a coffee) fit without a scroll, that the rail itself never scrolls, and
that the title bar's free-trial button is fully visible and clear of the CPU/RAM meters and the
window buttons.
"""
import json, sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8")
base = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else None
BRAVE = r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe"
LANGS = ["en", "it", "es", "fr", "de", "pt"]
SIZES = [(1400, 900), (1280, 820), (1000, 760), (1000, 721), (1000, 700), (1000, 690), (1000, 681),
         (1000, 680), (1000, 672), (1000, 651), (1000, 614), (820, 600)]
TAURI = """(() => {
  let next = 1;
  const answers = { is_store_install: false, system_stats: { cpu_usage: 14, ram_used: 9.4e9, ram_total: 3.2e10 } };
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
    transformCallback: (cb) => { const id = next++; window['_' + id] = cb; return id; },
    unregisterCallback: () => {}, convertFileSrc: (p) => p,
    invoke: async (cmd) => cmd.startsWith('plugin:event|') ? next++ : cmd.startsWith('plugin:') ? null
      : cmd in answers ? answers[cmd] : cmd.startsWith('list_') ? [] : null,
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
})();"""
PRICES = {"trial_enabled": True, "trial_days": 3, "currency": "eur", "prices": [
    {"product": "pctweaker", "plan": "monthly", "amount": 799}, {"product": "pctweaker", "plan": "annual", "amount": 5999}]}
MEASURE = """() => {
  const nav = document.querySelector('.workspace-navigation'), side = document.querySelector('.workspace-sidebar');
  const foot = document.querySelector('.workspace-commercial').getBoundingClientRect();
  const chip = document.querySelector('.titlebar-trial')?.getBoundingClientRect();
  const blockers = [...document.querySelectorAll('.titlebar .winbtn, .titlebar .type-label')].map(e => e.getBoundingClientRect());
  const clear = chip && chip.left >= 0 && chip.top >= 0 && chip.bottom <= 44
    && blockers.every(b => b.right <= chip.left || b.left >= chip.right);
  return { navOverflow: nav.scrollHeight - nav.clientHeight, railScroll: side.scrollHeight - side.clientHeight,
           footer: foot.bottom <= innerHeight + 0.5, chip: Boolean(clear) };
}"""

failures = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=BRAVE, headless=True)
    for lang in LANGS:
        for w, h in SIZES:
            ctx = browser.new_context(viewport={"width": w, "height": h})
            ctx.add_init_script(TAURI)
            ctx.add_init_script(f"localStorage.setItem('pc-tweaker-lang', '{lang}');")
            page = ctx.new_page()
            page.route("https://api.pctweaker.app/**", lambda route, _req=None: route.fulfill(
                status=200, content_type="application/json", body=json.dumps(PRICES))
                if "/api/billing/prices" in route.request.url else route.fulfill(status=404, body="{}"))
            page.goto(base)
            page.wait_for_selector(".titlebar-trial", timeout=30000)
            page.wait_for_timeout(1200)
            m = page.evaluate(MEASURE)
            ok = m["navOverflow"] <= 0 and m["railScroll"] <= 0 and m["footer"] and m["chip"]
            print(f"{'ok  ' if ok else 'FAIL'} {lang} {w}x{h} {m}")
            if not ok:
                failures.append(f"{lang} {w}x{h}")
            if out and (w, h) in ((1400, 900), (1000, 700), (820, 600)):
                page.screenshot(path=f"{out}/main-{lang}-{w}x{h}.png")
            ctx.close()
    browser.close()
print("FAILURES:", ", ".join(failures) or "none")
sys.exit(1 if failures else 0)
