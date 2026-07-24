import React, { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type Category = "performance" | "privacy" | "ui";

type TweakInfo = {
  id: string;
  name: string;
  description: string;
  category: Category;
  hive: "HKCU" | "HKLM";
  requires_admin: boolean;
  applied: boolean;
};

type Toast = {
  id: number;
  kind: "success" | "error";
  message: string;
};

const CATEGORIES: { key: Category | "all"; label: string }[] = [
  { key: "all", label: "Tutti" },
  { key: "performance", label: "Performance" },
  { key: "privacy", label: "Privacy" },
  { key: "ui", label: "UI" },
];

const CATEGORY_STYLE: Record<Category, { icon: React.ReactElement; ring: string; chip: string }> = {
  performance: {
    ring: "from-amber-400/30 to-orange-500/10",
    chip: "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  privacy: {
    ring: "from-emerald-400/30 to-teal-500/10",
    chip: "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  ui: {
    ring: "from-fuchsia-400/30 to-purple-500/10",
    chip: "bg-fuchsia-400/15 text-fuchsia-300 ring-1 ring-fuchsia-400/30",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M12 21a9 9 0 1 1 0-18c4 0 8 2.5 8 6.5 0 2-1.5 3.5-3.5 3.5H15a1.7 1.7 0 0 0-1 3.1c.4.3.6.7.6 1.2 0 1-1 2-2.6 2.7Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
        <circle cx="11" cy="7" r="1" fill="currentColor" />
        <circle cx="15.5" cy="9" r="1" fill="currentColor" />
      </svg>
    ),
  },
};

function ShieldBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300 ring-1 ring-sky-400/30">
      <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
        <path
          d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      Admin
    </span>
  );
}

function Toggle({
  checked,
  busy,
  onClick,
}: {
  checked: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={busy}
      onClick={onClick}
      aria-pressed={checked}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors duration-300 ease-out disabled:cursor-wait
        ${checked ? "bg-emerald-500" : "bg-white/10"} `}
    >
      <span
        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ease-out
          ${checked ? "translate-x-7" : "translate-x-1"}`}
      >
        {busy && (
          <svg
            className="absolute inset-0 m-auto h-4 w-4 animate-spin text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="3"
              className="opacity-25"
            />
            <path
              d="M21 12a9 9 0 0 0-9-9"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>
    </button>
  );
}

function App() {
  const [tweaks, setTweaks] = useState<TweakInfo[]>([]);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  async function refresh() {
    const list = await invoke<TweakInfo[]>("list_tweaks");
    setTweaks(list);
  }

  useEffect(() => {
    refresh().catch((e) => pushToast("error", String(e)));
  }, []);

  function pushToast(kind: Toast["kind"], message: string) {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }

  async function toggle(tweak: TweakInfo) {
    setBusyId(tweak.id);
    try {
      if (tweak.applied) {
        await invoke("rollback_tweak", { id: tweak.id });
        pushToast("success", `"${tweak.name}" ripristinato al valore originale.`);
      } else {
        await invoke("apply_tweak", { id: tweak.id });
        pushToast("success", `"${tweak.name}" applicato.`);
      }
      await refresh();
    } catch (e) {
      pushToast("error", String(e));
    } finally {
      setBusyId(null);
    }
  }

  const visible = useMemo(
    () => (filter === "all" ? tweaks : tweaks.filter((t) => t.category === filter)),
    [tweaks, filter],
  );

  const appliedCount = tweaks.filter((t) => t.applied).length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#1e293b,_#0b1120_60%)] px-8 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-sky-400 text-slate-900 shadow-lg shadow-indigo-500/30">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path
                    d="M12 2 4 6v6c0 5 3.4 9 8 10 4.6-1 8-5 8-10V6l-8-4Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              PC Tweaker
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {appliedCount} di {tweaks.length} tweak attivi
            </p>
          </div>
          <p className="max-w-[15rem] text-right text-xs leading-relaxed text-slate-500">
            Ogni tweak salva un backup del valore originale prima di essere
            applicato. I tweak con privilegi elevati chiedono un consenso UAC
            esplicito, solo per quell'azione.
          </p>
        </header>

        <nav className="mb-6 flex gap-1 rounded-full bg-white/5 p-1 backdrop-blur">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200
                ${
                  filter === c.key
                    ? "bg-indigo-500 text-white shadow"
                    : "text-slate-400 hover:text-slate-100"
                }`}
            >
              {c.label}
            </button>
          ))}
        </nav>

        <ul className="flex flex-col gap-3">
          {visible.map((t, i) => {
            const style = CATEGORY_STYLE[t.category];
            return (
              <li
                key={t.id}
                style={{ animationDelay: `${i * 40}ms` }}
                className={`animate-card group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4
                  shadow-lg shadow-black/20 transition-all duration-200 hover:border-white/20 hover:bg-white/[0.06]`}
              >
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${style.ring}`}
                />
                <div className="relative flex items-center gap-4">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${style.chip}`}>
                    {style.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-100">{t.name}</h2>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                        {t.hive}
                      </span>
                      {t.requires_admin && <ShieldBadge />}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-400">{t.description}</p>
                  </div>
                  <Toggle
                    checked={t.applied}
                    busy={busyId === t.id}
                    onClick={() => toggle(t)}
                  />
                </div>
              </li>
            );
          })}

          {visible.length === 0 && (
            <li className="animate-card rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
              Nessun tweak disponibile in questa categoria — presto in arrivo.
            </li>
          )}
        </ul>
      </div>

      <div className="pointer-events-none fixed bottom-6 right-6 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-toast pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-xl backdrop-blur
              ${
                t.kind === "success"
                  ? "bg-emerald-500/90 text-emerald-950"
                  : "bg-red-500/90 text-red-950"
              }`}
          >
            {t.kind === "success" ? (
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0">
                <path
                  d="m5 13 4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0">
                <path
                  d="M12 9v4m0 4h.01M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            {t.message}
          </div>
        ))}
      </div>
    </main>
  );
}

export default App;
