import type { ReactNode } from "react";
import type { Strings } from "../i18n";
import type { Section } from "../types";
import { NAV_ACCENT } from "../categories";
import { CoffeeCard } from "./coffee";
import { CrownIcon, GemIcon } from "./icons";

type NavigationItem = { key: Section; label: string; icon: ReactNode };

export function WorkspaceSidebar({
  s,
  items,
  active,
  isPro,
  showHistory,
  onNavigate,
  onTip,
}: {
  s: Strings;
  items: NavigationItem[];
  active: Section;
  isPro: boolean;
  showHistory: boolean;
  onNavigate: (section: Section) => void;
  onTip: (quantity: number) => Promise<void>;
}) {
  const groups: { label: string; keys: Section[]; primary?: boolean }[] = [
    {
      label: s.tabs.groupWorkspace,
      keys: showHistory ? ["overview", "profiles", "ledger"] : ["overview", "profiles"],
      primary: true,
    },
    { label: s.tabs.groupMonitor, keys: ["scan", "health", "hardware"] },
    { label: s.tabs.groupOptimize, keys: ["performance", "gaming", "privacy", "ui"] },
    { label: s.tabs.groupManage, keys: ["startup", "manutenzione"] },
  ];

  return (
    <aside className="workspace-sidebar bg-raised border-line flex h-full w-52 shrink-0 flex-col border-r px-4 py-5">
      <nav className="workspace-navigation flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {groups.map(({ label, keys, primary }) => (
          <div key={label} className={`workspace-nav-group${primary ? " workspace-primary" : ""}`}>
            <p className="type-label mb-1 px-3">{label}</p>
            {keys.map((key) => {
              const item = items.find((candidate) => candidate.key === key);
              if (!item) return null;
              const selected = active === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onNavigate(key)}
                  aria-current={selected ? "page" : undefined}
                  className={`nav-item group flex w-full items-center gap-2.5 rounded-[8px] px-3 py-[7px] text-left text-[13px] transition-colors duration-150 ${selected ? "font-semibold" : "text-ink-3 hover:bg-surface-1/50 hover:text-ink-2"}`}
                  data-active={selected}
                >
                  <span
                    aria-hidden="true"
                    className={`shrink-0 ${selected ? (NAV_ACCENT[key] ?? "text-accent") : "text-ink-3 group-hover:text-ink-2"}`}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="workspace-commercial border-line mt-auto border-t pt-3">
        <button
          type="button"
          onClick={() => onNavigate("pricing")}
          aria-current={active === "pricing" ? "page" : undefined}
          data-active={active === "pricing"}
          className="workspace-plan-link nav-item flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-[13px] font-semibold text-ink"
        >
          <GemIcon className="h-[18px] w-[18px] shrink-0 text-accent" />
          <span>{s.tabs.pricing}</span>
        </button>
        <CoffeeCard s={s} onTip={(quantity) => void onTip(quantity)} />
        <button
          type="button"
          onClick={() => onNavigate("pricing")}
          className="workspace-pro-state flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-[12px] font-semibold text-ink-2"
        >
          <CrownIcon className="h-4 w-4 shrink-0 text-accent" />
          <span>{isPro ? s.menu.planPro : s.menu.upgradeButton}</span>
        </button>
      </div>
    </aside>
  );
}
