// Browser preview of the UI with a mocked Tauri backend, for screenshots
// before/after a visual change - works on any OS, no Windows needed.
//   npm run dev                      (vite on :5173, in another terminal)
//   node .agents/skills/control-room-design/preview.cjs <tag> [Tab ...]
// e.g. `preview.cjs before Health Maintenance`. Screenshots go to
// $PREVIEW_OUT (default: <os tmp>/pc-tweaker-preview), never into the repo.
// Fixtures below are fake but shaped like src/types.ts; extend F for the
// screen you are touching. Theme: PREVIEW_THEME=teal_depths etc.
const os = require('os'); const path = require('path'); const fs = require('fs');
function loadPlaywright() {
  try { return require('playwright'); } catch {}
  const g = require('child_process').execSync('npm root -g').toString().trim();
  return require(path.join(g, 'playwright'));
}
const { chromium } = loadPlaywright();
const OUT = process.env.PREVIEW_OUT || path.join(os.tmpdir(), 'pc-tweaker-preview');
fs.mkdirSync(OUT, { recursive: true });
const THEME = process.env.PREVIEW_THEME || 'violet';
const [,, tag, ...tabs] = process.argv;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 2400 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  await p.addInitScript((theme) => {
    let cb = 0; const cmds = {};
    window.__TAURI_INTERNALS__ = {
      invoke: async (cmd) => {
        cmds[cmd] = (cmds[cmd]||0)+1; window.__cmds = cmds;
        const now = Math.floor(Date.now()/1000);
        const F = {
          system_stats: { cpu_usage: 23.4, cpu_name: 'AMD Ryzen 7 7800X3D', cpu_cores: 16, ram_used: 14.2e9, ram_total: 32e9, disk_used: 610e9, disk_total: 1000e9, os_name: 'Windows 11 Pro 24H2', uptime_secs: 93000 },
          list_tweaks: [
            { id:'t1', name:'Disable telemetry', description:'Stops diagnostic data upload.', category:'privacy', hive:'HKLM', requires_admin:true, requires_pro:false, applied:true, changes:[] },
            { id:'t2', name:'Game Mode', description:'Prioritise the foreground game.', category:'gaming', hive:'HKCU', requires_admin:false, requires_pro:false, applied:false, changes:[] },
            { id:'t3', name:'Ultimate power plan', description:'Unlock the hidden plan.', category:'performance', hive:'HKLM', requires_admin:true, requires_pro:true, applied:false, changes:[] } ],
          list_cleanup_targets: [ { id:'c1', name:'Temp files', description:'User and system temp.', requires_admin:false, requires_pro:false } ],
          health_report: { report: { overall: 72, categories: [
            { id:'performance', score: 81, factors:[{id:'f1',label:'Startup apps',earned:8,max:10,evidence:'4 heavy startup apps'},{id:'f2',label:'Power plan',earned:5,max:10,evidence:'Balanced'}] },
            { id:'privacy', score: 54, factors:[{id:'f3',label:'Telemetry',earned:2,max:10,evidence:'Full diagnostic data'}] },
            { id:'storage', score: 38, factors:[{id:'f4',label:'Free space',earned:3,max:10,evidence:'9% free on C:'}] } ] },
            ts: now, comparison: { previousTs: now-86400*3, previousOverall: 66, delta: 6, structuralChange:false, categories:[{id:'performance',before:70,after:81,delta:11,overallContribution:4,reasons:[{id:'f1',delta:3,evidenceBefore:'7 startup apps',evidenceAfter:'4 startup apps'}]},{id:'storage',before:45,after:38,delta:-7,overallContribution:-2,reasons:[]}] } },
          list_health_history: [ {ts: now-86400*6, overall: 61}, {ts: now-86400*3, overall: 66}, {ts: now, overall: 72} ],
          list_baselines: [ { ts: now-86400, cpuScore: 1830, memoryTouchMs: 41, diskWriteMs: 120, diskRandomReadMs: 9 } ],
          list_drives_cmd: [ { letter:'C:', media_type:'SSD', total_bytes: 1000e9, free_bytes: 90e9, is_system:true }, { letter:'D:', media_type:'HDD', total_bytes: 2000e9, free_bytes: 1200e9, is_system:false } ],
          disk_health: [ { drive:'C:', media_type:'SSD', status:'Healthy' } ],
          'plugin:app|version': '1.15.6',
        };
        if (cmd in F) return F[cmd];
        if (/^list_|_history$|_whitelist$/.test(cmd)) return [];
        if (/(_enabled|^hud_is|_pending)$/.test(cmd) || /^plugin:window\|is_/.test(cmd)) return false;
        return null;
      },
      transformCallback: () => ++cb, unregisterCallback: () => {}, convertFileSrc: s => s,
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    localStorage.setItem('pc-tweaker-theme', theme);
  }, THEME);
  await p.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/${tag}-home.png` });
  for (const t of tabs) {
    const el = p.getByRole('button', { name: new RegExp(t, 'i') }).first();
    if (await el.count()) {
      await el.click(); await p.waitForTimeout(800);
      if (t === 'Health') { await p.getByRole('button', { name: /Compute health score/i }).click(); await p.waitForSelector('.tool-health-panel[aria-busy="false"] >> text=Show more', { timeout: 15000 });
        for (const d of await p.getByRole('button', { name: /Show more/i }).all()) { try { await d.click(); await p.waitForTimeout(150); } catch {} } await p.waitForTimeout(400); await p.waitForSelector('.tool-health-panel[aria-busy="false"]'); }
      await p.screenshot({ path: `${OUT}/${tag}-${t}.png`, fullPage: true });
    }
    else console.log('tab non trovato:', t);
  }
  console.log('saved to', OUT); console.log('backend calls', JSON.stringify(await p.evaluate(() => window.__cmds)));
  console.log('page errors', errs.slice(0,8));
  await b.close();
})();
