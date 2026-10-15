/**
 * The tweak catalogue as the website publishes it.
 *
 * Every registry path, value, service and flag below comes from
 * src/generated/tweak-catalog.json, which the Rust test
 * `the_public_catalogue_file_matches_the_code` (src-tauri/src/lib.rs) writes
 * from the same list the app shows and fails on as soon as the two disagree.
 * Nothing here restates a path by hand; the prose that explains a control
 * lives in tweak-notes.ts, next to the sources it was checked against.
 */
import catalogJson from "../generated/tweak-catalog.json";

export interface Source {
  readonly label: string;
  readonly url: string;
}

export type Change =
  | { kind: "registry"; path: string; valueName: string; valueType: "REG_DWORD" | "REG_SZ"; setsTo: string }
  | { kind: "command"; program: string; arguments: string }
  | { kind: "service"; name: string; action: string };

export interface CatalogTweak {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: "performance" | "privacy" | "ui" | "maintenance" | "gaming";
  readonly hive: string;
  readonly requires_admin: boolean;
  readonly requires_pro: boolean;
  readonly changes: readonly Change[];
  readonly min_build: number | null;
  readonly pro_edition: boolean;
  readonly enterprise_edition: boolean;
  readonly manual_only: boolean;
}

export const CATALOG = catalogJson as readonly CatalogTweak[];

export const ORIGIN = "https://pctweaker.app";
/** The day the notes, sources and commands on these pages were last checked. */
export const CHECKED = "15 October 2026";
export const CHECKED_ISO = "2026-10-15";
const GH = "https://github.com/AurelioAvila/pc-tweaker-app/blob/master/src-tauri/src";

/** `app` is the category's name inside PC Tweaker (src/i18n.ts, English). */
export const CATEGORIES = {
  performance: { slug: "performance", label: "Performance", app: "Performance" },
  gaming: { slug: "gaming", label: "Gaming", app: "Gaming" },
  privacy: { slug: "privacy", label: "Privacy", app: "Privacy" },
  ui: { slug: "interface", label: "Interface", app: "UI" },
  maintenance: { slug: "maintenance", label: "Maintenance", app: "Maintenance" },
} as const;

/** The module that defines each control, for the "read the code" link. */
const MODULES: Record<string, string> = {
  power_plan_performance: "power.rs",
  turbo_gaming: "turbo.rs",
  privacy_dns: "dns.rs",
  reduce_input_lag: "gaming.rs",
  turbo_boost: "gaming.rs",
  disable_core_parking: "gaming.rs",
  reduce_keyboard_delay: "gaming.rs",
  games_task_priority: "game_priority.rs",
  network_latency: "netlatency.rs",
  tcp_congestion_bbr: "netshaper.rs",
  disable_activity_history: "privacy_extra.rs",
  disable_typing_personalization: "privacy_extra.rs",
  classic_context_menu: "contextmenu.rs",
  disable_windows_search_service: "services.rs",
  disable_ai_fabric_service: "services.rs",
  disable_filter_keys_shortcut: "everyday.rs",
  ecoqos_rules: "ecoqos.rs",
  limit_do_background_download: "download_limit.rs",
  monitor_refresh_profile: "monitor_profiles.rs",
};

/** Defined in settings_tweaks.rs; anything not listed here or above is tweaks.rs. */
const SETTINGS_IDS = new Set([
  "block_oem_device_apps", "disable_click_to_do", "disable_drag_tray", "disable_edge_ai",
  "disable_fast_startup", "disable_game_bar_captures", "disable_notepad_ai", "disable_paint_ai",
  "disable_storage_sense", "disable_widgets", "disable_windows_suggestions", "explorer_open_this_pc",
  "hide_start_recommended", "taskbar_end_task",
]);

export function sourceFile(t: CatalogTweak): Source {
  const file =
    MODULES[t.id] ??
    (t.changes.some((c) => c.kind === "command" && c.program === "PowerWriteACValueIndex")
      ? "power_tuning.rs"
      : SETTINGS_IDS.has(t.id)
        ? "settings_tweaks.rs"
        : "tweaks.rs");
  return { label: `PC Tweaker source code: src-tauri/src/${file}`, url: `${GH}/${file}` };
}

export const tweakSlug = (t: CatalogTweak, override?: string) => override ?? t.id.replaceAll("_", "-");

/* ------------------------------------------------------------------ *
 * Manual method, derived from the disclosed changes.
 * ------------------------------------------------------------------ */

export interface ManualStep {
  readonly title: string;
  readonly note?: string;
  /** A command block, ready to paste. */
  readonly code?: string;
  readonly shell?: "cmd" | "PowerShell";
}

export interface ManualMethod {
  readonly elevated: boolean;
  readonly check: readonly ManualStep[];
  readonly apply: readonly ManualStep[];
  readonly undo: readonly ManualStep[];
  readonly signOut: boolean;
}

const q = (s: string) => `"${s}"`;
const regValueArg = (name: string) => (name === "(Default)" ? "/ve" : `/v ${q(name)}`);
/** "38 (0x26)" -> "38"; "\"High\"" -> "High". */
export function rawValue(c: Extract<Change, { kind: "registry" }>): string {
  return c.valueType === "REG_DWORD" ? c.setsTo.split(" ")[0] : c.setsTo.replace(/^"|"$/g, "");
}

const ADAPTER = "<active adapter GUID>";
const PLAN = "<active plan GUID>";
/** The interface Windows would use to reach the internet, as PowerShell finds it. */
const FIND_IF = "$if = (Find-NetRoute -RemoteIPAddress 1.1.1.1 | Select-Object -First 1).InterfaceIndex";
const FIND_ADAPTER = `${FIND_IF}\n$guid = (Get-NetAdapter -InterfaceIndex $if).InterfaceGuid`;

/** Power-plan values: `...\<plan>\<subgroup>\<setting>` + AC/DC index. */
function powerTarget(c: Extract<Change, { kind: "registry" }>) {
  const parts = c.path.split("\\");
  const i = parts.indexOf(PLAN);
  return { sub: parts[i + 1], setting: parts[i + 2], ac: c.valueName === "ACSettingIndex" };
}

function powerCommandTarget(args: string) {
  const sub = args.match(/subgroup ([0-9a-f-]{36})/)?.[1];
  const setting = args.match(/setting ([0-9a-f-]{36})/)?.[1];
  const index = args.match(/AC index (\d+)/)?.[1];
  return sub && setting && index ? { sub, setting, index } : null;
}

/**
 * The by-hand equivalent of a control, or null when the change is not a
 * plain value someone can set themselves (configurable tools, a control whose
 * mechanism the app does not disclose). Those pages explain the Windows route
 * in their notes instead of showing a command that would be a guess.
 */
export function manualMethod(t: CatalogTweak): ManualMethod | null {
  if (t.changes.length === 0) return null;
  const check: ManualStep[] = [];
  const apply: ManualStep[] = [];
  const undo: ManualStep[] = [];
  let elevated = t.requires_admin;
  let signOut = false;

  const registry = t.changes.filter((c) => c.kind === "registry") as Extract<Change, { kind: "registry" }>[];
  const plain = registry.filter((c) => !c.path.includes("<"));
  const adapter = registry.filter((c) => c.path.includes(ADAPTER));
  const plan = registry.filter((c) => c.path.includes(PLAN));
  const scheme = plain.filter((c) => c.valueName === "ActivePowerScheme");
  const values = plain.filter((c) => c.valueName !== "ActivePowerScheme");

  if (values.length) {
    elevated ||= values.some((c) => c.path.startsWith("HKLM"));
    signOut ||= values.some((c) => /^HKCU\\Control Panel\\/i.test(c.path));
    check.push({
      title: "Write down what is there now",
      note: "If reg reports that it cannot find a value, the value is absent, which is a state you will want to put back exactly.",
      code: values.map((c) => `reg query ${q(c.path)} ${regValueArg(c.valueName)}`).join("\n"),
      shell: "cmd",
    });
    apply.push({
      title: "Set the value",
      code: values
        .map((c) => `reg add ${q(c.path)} ${regValueArg(c.valueName)} /t ${c.valueType} /d ${q(rawValue(c))} /f`)
        .join("\n"),
      shell: "cmd",
    });
    undo.push({
      title: "Put back what you wrote down",
      note: "Use the value you recorded. If the value did not exist before, delete it instead, so Windows goes back to its own default.",
      code: values
        .map((c) => `reg add ${q(c.path)} ${regValueArg(c.valueName)} /t ${c.valueType} /d <previous value> /f\n` +
          `rem or, if it was absent:\nreg delete ${q(c.path)} ${regValueArg(c.valueName)} /f`)
        .join("\n"),
      shell: "cmd",
    });
  }

  if (scheme.length) {
    const guid = rawValue(scheme[0]);
    check.push({ title: "Note the active power plan", code: "powercfg /getactivescheme\npowercfg /list", shell: "cmd", note: "If the plan is not in the list, this PC does not offer it." });
    apply.push({ title: "Switch plans", code: `powercfg /setactive ${guid}`, shell: "cmd" });
    undo.push({ title: "Switch back", code: "powercfg /setactive <GUID you noted>", shell: "cmd" });
  }

  const nameServer = adapter.find((c) => c.valueName === "NameServer");
  if (nameServer) {
    const servers = rawValue(nameServer);
    check.push({ title: "See the DNS servers in use now", code: `${FIND_IF}\nGet-DnsClientServerAddress -InterfaceIndex $if`, shell: "PowerShell" });
    apply.push({ title: "Set the DNS servers", code: `${FIND_IF}\nSet-DnsClientServerAddress -InterfaceIndex $if -ServerAddresses ${servers}`, shell: "PowerShell" });
    undo.push({ title: "Go back", note: "If the servers came from your router (DHCP), reset them; otherwise set the addresses you noted.", code: `${FIND_IF}\nSet-DnsClientServerAddress -InterfaceIndex $if -ResetServerAddresses`, shell: "PowerShell" });
  }
  const adapterValues = adapter.filter((c) => c.valueName !== "NameServer");
  if (adapterValues.length) {
    const key = (c: Extract<Change, { kind: "registry" }>) => q(c.path.replace(ADAPTER, "$guid"));
    check.push({ title: "Find the adapter and read its current values", code: `${FIND_ADAPTER}\n` + adapterValues.map((c) => `reg query ${key(c)} /v ${q(c.valueName)}`).join("\n"), shell: "PowerShell" });
    apply.push({ title: "Set the values on that adapter", code: `${FIND_ADAPTER}\n` + adapterValues.map((c) => `reg add ${key(c)} /v ${q(c.valueName)} /t ${c.valueType} /d ${rawValue(c)} /f`).join("\n"), shell: "PowerShell" });
    undo.push({ title: "Remove them again", note: "Delete a value that was absent before; otherwise write back what you read.", code: `${FIND_ADAPTER}\n` + adapterValues.map((c) => `reg delete ${key(c)} /v ${q(c.valueName)} /f`).join("\n"), shell: "PowerShell" });
  }

  const powerWrites = [
    ...plan.map((c) => {
      const p = powerTarget(c);
      return { ...p, index: rawValue(c) };
    }),
    ...(t.changes.filter((c) => c.kind === "command" && c.program === "PowerWriteACValueIndex") as Extract<Change, { kind: "command" }>[])
      .map((c) => powerCommandTarget(c.arguments))
      .filter((p): p is { sub: string; setting: string; index: string } => p !== null)
      .map((p) => ({ ...p, ac: true })),
  ];
  if (powerWrites.length) {
    const uniq = [...new Map(powerWrites.map((p) => [`${p.sub}/${p.setting}`, p])).values()];
    check.push({
      title: "Read the current plan's values",
      note: "The output lists the current AC (plugged in) and DC (battery) indexes; note them. If only the plan name comes back, the setting is hidden on this PC: run the same line with /qh in place of /query.",
      code: uniq.map((p) => `powercfg /query SCHEME_CURRENT ${p.sub} ${p.setting}`).join("\n"),
      shell: "cmd",
    });
    apply.push({
      title: "Write the new index and re-apply the plan",
      code: [
        ...powerWrites.map((p) => `powercfg /set${p.ac ? "ac" : "dc"}valueindex SCHEME_CURRENT ${p.sub} ${p.setting} ${p.index}`),
        "powercfg /setactive SCHEME_CURRENT",
      ].join("\n"),
      shell: "cmd",
    });
    undo.push({
      title: "Write back the indexes you noted",
      code: [
        ...powerWrites.map((p) => `powercfg /set${p.ac ? "ac" : "dc"}valueindex SCHEME_CURRENT ${p.sub} ${p.setting} <previous index>`),
        "powercfg /setactive SCHEME_CURRENT",
      ].join("\n"),
      shell: "cmd",
    });
  }

  for (const c of t.changes) {
    if (c.kind === "service") {
      elevated = true;
      const start = c.action.includes("Manual") ? "demand" : "disabled";
      check.push({ title: `Note how ${c.name} starts today`, note: "START_TYPE in the output is what you will restore (AUTO_START, DEMAND_START or DISABLED; delayed auto start is listed separately).", code: `sc qc ${c.name}`, shell: "cmd" });
      apply.push({ title: `Stop ${c.name} and change its start type`, code: `sc stop ${c.name}\nsc config ${c.name} start= ${start}`, shell: "cmd" });
      undo.push({ title: "Restore the start type you noted, then start it", note: "Use auto, delayed-auto, demand or disabled to match what sc qc showed.", code: `sc config ${c.name} start= <auto|delayed-auto|demand>\nsc start ${c.name}`, shell: "cmd" });
    }
    if (c.kind === "command" && c.program === "taskkill") {
      apply.push({ title: "Restart Explorer so it picks the change up", code: "taskkill /f /im explorer.exe\nstart explorer.exe", shell: "cmd" });
      undo.push({ title: "Restart Explorer again", code: "taskkill /f /im explorer.exe\nstart explorer.exe", shell: "cmd" });
    }
  }

  if (apply.length === 0) return null;
  return { elevated, check, apply, undo, signOut };
}

/** Where a value applies, in words. */
export function scopeOf(t: CatalogTweak): string {
  const paths = t.changes.flatMap((c) => (c.kind === "registry" ? [c.path] : []));
  const hkcu = paths.some((p) => p.startsWith("HKCU"));
  const hklm = paths.some((p) => p.startsWith("HKLM"));
  if (t.changes.some((c) => c.kind === "service")) return "The whole PC (a Windows service)";
  if (hkcu && hklm) return "This account and the whole PC";
  if (hkcu) return "Only the signed-in Windows account";
  if (hklm) return "Every account on this PC";
  return "Depends on the setting, see below";
}

export function requirementsOf(t: CatalogTweak): string {
  const parts = ["Windows 10 or 11"];
  if (t.min_build) parts[0] = `Windows build ${t.min_build} or later`;
  if (t.enterprise_edition) parts.push("Enterprise or Education edition");
  else if (t.pro_edition) parts.push("Pro, Enterprise or Education edition");
  return parts.join(", ");
}
