(() => {
  if (window.location.hostname !== 'pctweaker.app') return;
  const products = new Map([
    ['https://dl.pctweaker.app/uninstaller/PCTweakerUninstaller-Setup.exe', 'uninstaller'],
    ['https://dl.pctweaker.app/tweaky-driver/TweakyDriver-Setup.exe', 'tweaky-driver'],
  ]);
  const entryPages = new Map([
    ['/', 'home'], ['/uninstaller/', 'uninstaller'], ['/tweaky-driver/', 'tweaky-driver'],
    ['/uninstall-programs-completely/', 'uninstall-programs-completely'],
    ...['armoury-crate', 'riot-vanguard', 'mcafee-webadvisor', 'microsoft-edge-webview2', 'onedrive']
      .map(slug => [`/uninstaller/guides/${slug}/`, `uninstaller-guide-${slug}`]),
  ]);
  const labels = new URLSearchParams();
  const supplied = new URLSearchParams(window.location.search);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const value = supplied.get(key);
    if (value && /^[A-Za-z0-9_.-]{1,80}$/.test(value)) labels.set(key, value);
  }
  if (!labels.has('utm_source')) {
    labels.set('utm_source', 'website');
    labels.set('utm_medium', 'owned-content');
    labels.set('utm_campaign', `pct-${entryPages.get(window.location.pathname) || 'suite'}`);
  }
  // Aggregate installer-link clicks only. No cookies, visitor identifiers or
  // claims of a completed download, installation, first launch or purchase.
  document.addEventListener('click', event => {
    const link = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('a[href]') : null;
    const product = link && products.get(link.href);
    if (!product) return;
    const payload = new URLSearchParams(labels);
    payload.set('utm_content', `${product}-installer-link`);
    try { navigator.sendBeacon(`https://api.pctweaker.app/api/download?${payload}`); }
    catch { /* Navigation to the signed installer works independently. */ }
  });
})();
