import { useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Lang, Strings } from "../i18n";
import type { TweakInfo, TweakProfile } from "../types";
import { PRICING_COPY } from "./pricing-copy";
import { CrownIcon, LayersIcon } from "./icons";
import "./lifetime-tools.css";
import "./workspace-panels.css";

type Comparison = {
  left_name: string;
  right_name: string;
  common: string[];
  only_left: string[];
  only_right: string[];
  unknown_left_count: number;
  unknown_right_count: number;
};
const LABELS: Record<Lang, readonly string[]> = {
  en: [
    "Profile A",
    "Profile B",
    "Compare profiles",
    "Working…",
    "In both profiles",
    "Only in A",
    "Only in B",
    "No settings in this group.",
    "Save at least two profiles to compare them.",
    "Included exclusively with Lifetime. Your existing profile tools stay available.",
    "View Lifetime",
    "Include this comparison in the report",
    "Preview report",
    "Export Markdown",
    "Report saved.",
    "Hide preview",
    "Unrecognized settings were excluded",
    "The report omits account details, profile names and original registry values. Preview it before sharing.",
    "Reports are written in English.",
    "Choose a saved profile",
    "Preview the report before exporting.",
  ],
  it: [
    "Profilo A",
    "Profilo B",
    "Confronta profili",
    "Operazione in corso…",
    "In entrambi i profili",
    "Solo in A",
    "Solo in B",
    "Nessuna impostazione in questo gruppo.",
    "Salva almeno due profili per confrontarli.",
    "Incluso esclusivamente con Lifetime. Gli strumenti per i profili già disponibili rimangono accessibili.",
    "Scopri Lifetime",
    "Includi questo confronto nel report",
    "Anteprima report",
    "Esporta Markdown",
    "Report salvato.",
    "Nascondi anteprima",
    "Le impostazioni non riconosciute sono state escluse",
    "Il report omette dati dell'account, nomi dei profili e valori originali del registro. Controllalo prima di condividerlo.",
    "I report sono scritti in inglese.",
    "Scegli un profilo salvato",
    "Controlla l'anteprima prima di esportare.",
  ],
  fr: [
    "Profil A",
    "Profil B",
    "Comparer les profils",
    "En cours…",
    "Dans les deux profils",
    "Uniquement dans A",
    "Uniquement dans B",
    "Aucun réglage dans ce groupe.",
    "Enregistrez au moins deux profils pour les comparer.",
    "Inclus exclusivement avec l'offre à vie. Vos outils de profil existants restent disponibles.",
    "Voir l'offre à vie",
    "Inclure cette comparaison dans le rapport",
    "Aperçu du rapport",
    "Exporter en Markdown",
    "Rapport enregistré.",
    "Masquer l'aperçu",
    "Les réglages non reconnus ont été exclus",
    "Le rapport omet les données du compte, les noms des profils et les valeurs d'origine du registre. Vérifiez-le avant de le partager.",
    "Les rapports sont rédigés en anglais.",
    "Choisir un profil enregistré",
    "Consultez l'aperçu avant d'exporter.",
  ],
  es: [
    "Perfil A",
    "Perfil B",
    "Comparar perfiles",
    "Procesando…",
    "En ambos perfiles",
    "Solo en A",
    "Solo en B",
    "No hay ajustes en este grupo.",
    "Guarda al menos dos perfiles para compararlos.",
    "Incluido exclusivamente con Lifetime. Tus herramientas de perfiles existentes siguen disponibles.",
    "Ver Lifetime",
    "Incluir esta comparación en el informe",
    "Vista previa del informe",
    "Exportar Markdown",
    "Informe guardado.",
    "Ocultar vista previa",
    "Se excluyeron los ajustes no reconocidos",
    "El informe omite datos de la cuenta, nombres de perfiles y valores originales del registro. Revísalo antes de compartirlo.",
    "Los informes se escriben en inglés.",
    "Elige un perfil guardado",
    "Revisa el informe antes de exportarlo.",
  ],
  de: [
    "Profil A",
    "Profil B",
    "Profile vergleichen",
    "Wird verarbeitet…",
    "In beiden Profilen",
    "Nur in A",
    "Nur in B",
    "Keine Einstellungen in dieser Gruppe.",
    "Speichere mindestens zwei Profile für einen Vergleich.",
    "Exklusiv in Lifetime enthalten. Deine bisherigen Profilwerkzeuge bleiben verfügbar.",
    "Lifetime ansehen",
    "Diesen Vergleich in den Bericht aufnehmen",
    "Berichtsvorschau",
    "Markdown exportieren",
    "Bericht gespeichert.",
    "Vorschau schließen",
    "Unbekannte Einstellungen wurden ausgeschlossen",
    "Der Bericht enthält keine Kontodaten, Profilnamen oder ursprünglichen Registrierungswerte. Prüfe ihn vor dem Teilen.",
    "Berichte werden auf Englisch erstellt.",
    "Gespeichertes Profil auswählen",
    "Prüfe die Vorschau vor dem Export.",
  ],
  pt: [
    "Perfil A",
    "Perfil B",
    "Comparar perfis",
    "A processar…",
    "Nos dois perfis",
    "Apenas em A",
    "Apenas em B",
    "Sem definições neste grupo.",
    "Guarde pelo menos dois perfis para os comparar.",
    "Incluído exclusivamente com Lifetime. As ferramentas de perfis existentes continuam disponíveis.",
    "Ver Lifetime",
    "Incluir esta comparação no relatório",
    "Pré-visualizar relatório",
    "Exportar Markdown",
    "Relatório guardado.",
    "Ocultar pré-visualização",
    "As definições desconhecidas foram excluídas",
    "O relatório omite dados da conta, nomes de perfis e valores originais do registo. Reveja-o antes de partilhar.",
    "Os relatórios são escritos em inglês.",
    "Escolha um perfil guardado",
    "Reveja o relatório antes de exportar.",
  ],
};

export function LifetimeTools({
  s,
  lang,
  profiles,
  tweaks,
  owned,
  onViewPlans,
}: {
  s: Strings;
  lang: Lang;
  profiles: TweakProfile[];
  tweaks: TweakInfo[];
  owned: boolean;
  onViewPlans: () => void;
}) {
  const copy = PRICING_COPY[lang];
  const l = LABELS[lang];
  const id = useId();
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [include, setInclude] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const pending = useRef(false);
  const selectionVersion = useRef(0);
  const validSelection =
    profiles.some((p) => p.name === left) &&
    profiles.some((p) => p.name === right) &&
    left !== right;
  const currentComparison =
    comparison?.left_name === left && comparison?.right_name === right && validSelection
      ? comparison
      : null;
  const request = include && currentComparison ? { left_name: left, right_name: right } : null;

  function select(side: "left" | "right", value: string) {
    selectionVersion.current++;
    (side === "left" ? setLeft : setRight)(value);
    setComparison(null);
    setInclude(false);
    setReport(null);
    setSaved(false);
    setError(null);
  }
  async function run(action: "compare" | "preview" | "export") {
    if (!owned || pending.current || (action === "compare" && !validSelection)) return;
    pending.current = true;
    setBusy(action);
    setError(null);
    setSaved(false);
    const version = selectionVersion.current;
    try {
      if (action === "compare") {
        const result = await invoke<Comparison>("compare_lifetime_profiles", {
          leftName: left,
          rightName: right,
        });
        if (version === selectionVersion.current) {
          setComparison(result);
          setReport(null);
        }
      } else if (action === "preview") {
        const result = await invoke<string>("preview_lifetime_report", { comparison: request });
        if (version === selectionVersion.current) setReport(result);
      } else {
        const result = await invoke<boolean>("save_lifetime_report", { comparison: request });
        if (result) setSaved(true);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }
  const label = (tweakId: string) =>
    s.tweaks[tweakId]?.name ?? tweaks.find((t) => t.id === tweakId)?.name ?? tweakId;

  return (
    <section className="lifetime-tools" aria-labelledby={`${id}-heading`}>
      <header>
        <span className="lifetime-tools-tag">
          <CrownIcon className="h-3.5 w-3.5" />
          {s.pricing.lifetimeExclusive}
        </span>
        <h2 id={`${id}-heading`}>{copy.openTools}</h2>
        <p>{copy.notBenchmark}</p>
      </header>
      {!owned && (
        <div className="lifetime-tools-access">
          <p>{l[9]}</p>
          <button onClick={onViewPlans} className="workspace-button workspace-button-primary">
            {l[10]}
          </button>
        </div>
      )}
      <article className="lifetime-tool-block">
        <h3>
          <LayersIcon className="h-4 w-4" />
          {copy.profiles}
        </h3>
        <p>{copy.profileDetail}</p>
        {profiles.length < 2 && <p className="lifetime-tool-hint">{l[8]}</p>}
        <div className="lifetime-tool-selectors">
          {(["left", "right"] as const).map((side, index) => (
            <label key={side} htmlFor={`${id}-${side}`}>
              {l[index]}
              <select
                id={`${id}-${side}`}
                value={side === "left" ? left : right}
                disabled={!owned || busy !== null || profiles.length < 2}
                onChange={(e) => select(side, e.target.value)}
              >
                <option value="">{l[19]}</option>
                {profiles.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <button
          className="workspace-button workspace-button-secondary"
          disabled={!owned || busy !== null || !validSelection}
          aria-busy={busy === "compare"}
          onClick={() => void run("compare")}
        >
          {busy === "compare" ? l[3] : l[2]}
        </button>
        {currentComparison && (
          <div className="lifetime-comparison" aria-live="polite">
            {[
              currentComparison.common,
              currentComparison.only_left,
              currentComparison.only_right,
            ].map((ids, index) => (
              <section key={index}>
                <h4>
                  {l[index + 4]} <strong>{ids.length}</strong>
                </h4>
                {ids.length ? (
                  <ul>
                    {ids.map((tweakId) => (
                      <li key={tweakId}>{label(tweakId)}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{l[7]}</p>
                )}
              </section>
            ))}
            {currentComparison.unknown_left_count + currentComparison.unknown_right_count > 0 && (
              <p className="lifetime-unknown">
                {l[16]}: A {currentComparison.unknown_left_count}, B{" "}
                {currentComparison.unknown_right_count}.
              </p>
            )}
          </div>
        )}
      </article>
      <article className="lifetime-tool-block">
        <h3>{copy.reports}</h3>
        <p>{copy.reportDetail}</p>
        {currentComparison && (
          <label className="lifetime-report-include">
            <input
              type="checkbox"
              checked={include}
              disabled={busy !== null}
              onChange={(e) => {
                selectionVersion.current++;
                setInclude(e.target.checked);
                setReport(null);
                setSaved(false);
              }}
            />
            {l[11]}
          </label>
        )}
        <div className="lifetime-tool-actions">
          <button
            className="workspace-button workspace-button-secondary"
            disabled={!owned || busy !== null}
            onClick={() => void run("preview")}
          >
            {busy === "preview" ? l[3] : l[12]}
          </button>
          <button
            className="workspace-button workspace-button-primary"
            disabled={!owned || busy !== null || !report}
            onClick={() => void run("export")}
          >
            {busy === "export" ? l[3] : l[13]}
          </button>
        </div>
        <p className="lifetime-tool-hint">
          {l[17]} {l[18]} {!report && l[20]}
        </p>
        {report && (
          <div className="lifetime-report-preview">
            <button onClick={() => setReport(null)}>{l[15]}</button>
            <pre tabIndex={0} aria-label={l[12]}>
              {report}
            </pre>
          </div>
        )}
      </article>
      {error && (
        <p className="workspace-panel-error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="lifetime-tool-success" role="status">
          {l[14]}
        </p>
      )}
    </section>
  );
}
