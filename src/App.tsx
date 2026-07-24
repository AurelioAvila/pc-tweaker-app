import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type TweakInfo = {
  id: string;
  name: string;
  description: string;
  category: "performance" | "privacy" | "ui";
  hive: "HKCU" | "HKLM";
  requires_admin: boolean;
  applied: boolean;
};

const categoryLabel: Record<TweakInfo["category"], string> = {
  performance: "Performance",
  privacy: "Privacy",
  ui: "UI",
};

function App() {
  const [tweaks, setTweaks] = useState<TweakInfo[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const list = await invoke<TweakInfo[]>("list_tweaks");
    setTweaks(list);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  async function toggle(tweak: TweakInfo) {
    setBusyId(tweak.id);
    setError(null);
    try {
      if (tweak.applied) {
        await invoke("rollback_tweak", { id: tweak.id });
      } else {
        await invoke("apply_tweak", { id: tweak.id });
      }
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="container">
      <h1>PC Tweaker</h1>
      <p>
        Ogni tweak salva un backup del valore originale prima di essere
        applicato. I tweak che richiedono privilegi di amministratore
        chiederanno un consenso UAC esplicito solo per quell'azione.
      </p>

      {error && <p className="error">{error}</p>}

      <ul className="tweak-list">
        {tweaks.map((t) => (
          <li key={t.id} className="tweak-item">
            <div className="tweak-info">
              <div className="tweak-title">
                <strong>{t.name}</strong>
                <span className="badge">{categoryLabel[t.category]}</span>
                <span className="badge">{t.hive}</span>
                {t.requires_admin && (
                  <span className="badge badge-admin">Admin</span>
                )}
              </div>
              <p className="tweak-description">{t.description}</p>
            </div>
            <button
              disabled={busyId === t.id}
              onClick={() => toggle(t)}
              className={t.applied ? "btn-rollback" : "btn-apply"}
            >
              {busyId === t.id
                ? "..."
                : t.applied
                ? "Ripristina"
                : "Applica"}
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default App;
