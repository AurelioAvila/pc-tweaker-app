import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Lang, Strings } from "../i18n";
import type { AuditEntry, Section, TweakInfo } from "../types";
import { textFor } from "../lib";
import { type PulseSample, tracePoints } from "./command";
import { ChipIcon, HeartPulseIcon, HistoryIcon, LayersIcon, RadarIcon } from "./icons";
import "./overview.css";

interface OverviewCopy {
  eyebrow: string;
  title: string;
  introduction: string;
  snapshot: string;
  waiting: string;
  cpuUse: string;
  ramUse: string;
  recorded: string;
  recordedHint: string;
  viewChanges: string;
  next: string;
  scanTitle: string;
  scanDescription: string;
  scanAction: string;
  gamingTitle: string;
  gamingDescription: string;
  profilesTitle: string;
  profilesDescription: string;
  recent: string;
  viewHistory: string;
  loadingHistory: string;
  emptyHistory: string;
  emptyHint: string;
  historyError: string;
  retry: string;
  activity: string;
  completed: string;
}

const COPY: Record<Lang, OverviewCopy> = {
  en: {
    eyebrow: "YOUR PC, IN PERSPECTIVE",
    title: "Understand first. Tune with purpose.",
    introduction: "See your system's activity, review your settings, and choose your next move.",
    snapshot: "Latest system readings",
    waiting: "Waiting for readings",
    cpuUse: "Processor usage",
    ramUse: "Memory in use",
    recorded: "Applied settings",
    recordedHint: "Recorded by PC Tweaker",
    viewChanges: "Review changes",
    next: "A clear next step",
    scanTitle: "Find what matters on this PC.",
    scanDescription:
      "Review recommendations based on your hardware before choosing what to change.",
    scanAction: "Open Scan",
    gamingTitle: "Explore your gaming setup",
    gamingDescription: "Review game sessions, Turbo Boost, and game-specific settings.",
    profilesTitle: "Keep your settings together",
    profilesDescription: "Save, inspect, or load a profile of your chosen tweaks.",
    recent: "Recent activity",
    viewHistory: "Open change history",
    loadingHistory: "Reading local history…",
    emptyHistory: "Your history starts here.",
    emptyHint: "Actions recorded by PC Tweaker will appear here.",
    historyError: "Local history couldn't be loaded.",
    retry: "Try again",
    activity: "System activity",
    completed: "Completed",
  },
  it: {
    eyebrow: "IL TUO PC, A COLPO D'OCCHIO",
    title: "Prima comprendi. Poi scegli cosa migliorare.",
    introduction:
      "Osserva l'attività del sistema, rivedi le impostazioni e scegli il prossimo passo.",
    snapshot: "Ultime letture del sistema",
    waiting: "In attesa dei dati",
    cpuUse: "Utilizzo del processore",
    ramUse: "Memoria in uso",
    recorded: "Impostazioni applicate",
    recordedHint: "Registrate da PC Tweaker",
    viewChanges: "Rivedi le modifiche",
    next: "Il prossimo passo, con chiarezza",
    scanTitle: "Scopri cosa conta per questo PC.",
    scanDescription:
      "Esamina i suggerimenti basati sul tuo hardware prima di scegliere cosa modificare.",
    scanAction: "Apri Scansione",
    gamingTitle: "Esplora la configurazione gaming",
    gamingDescription:
      "Esplora le sessioni di gioco, Turbo Boost e le impostazioni dei singoli giochi.",
    profilesTitle: "Riunisci le tue impostazioni",
    profilesDescription: "Salva, esamina o carica un profilo con i tweak che hai scelto.",
    recent: "Attività recente",
    viewHistory: "Apri la cronologia",
    loadingHistory: "Lettura della cronologia locale…",
    emptyHistory: "La tua cronologia inizia qui.",
    emptyHint: "Le azioni registrate da PC Tweaker appariranno qui.",
    historyError: "Impossibile leggere la cronologia locale.",
    retry: "Riprova",
    activity: "Attività di sistema",
    completed: "Completata",
  },
  fr: {
    eyebrow: "VOTRE PC, EN UN COUP D'ŒIL",
    title: "Comprendre d'abord. Ajuster avec précision.",
    introduction: "Observez l'activité du système, consultez vos réglages et choisissez la suite.",
    snapshot: "Dernières mesures du système",
    waiting: "En attente des mesures",
    cpuUse: "Utilisation du processeur",
    ramUse: "Mémoire utilisée",
    recorded: "Réglages appliqués",
    recordedHint: "Enregistrés par PC Tweaker",
    viewChanges: "Voir les modifications",
    next: "La prochaine étape, clairement",
    scanTitle: "Identifiez ce qui compte pour ce PC.",
    scanDescription:
      "Consultez les recommandations adaptées à votre matériel avant de choisir vos modifications.",
    scanAction: "Ouvrir l'analyse",
    gamingTitle: "Explorez votre configuration de jeu",
    gamingDescription:
      "Explorez les sessions de jeu, Turbo Boost et les réglages propres à chaque jeu.",
    profilesTitle: "Regroupez vos réglages",
    profilesDescription: "Enregistrez, consultez ou chargez un profil de vos réglages.",
    recent: "Activité récente",
    viewHistory: "Ouvrir l'historique",
    loadingHistory: "Lecture de l'historique local…",
    emptyHistory: "Votre historique commence ici.",
    emptyHint: "Les actions enregistrées par PC Tweaker apparaîtront ici.",
    historyError: "Impossible de charger l'historique local.",
    retry: "Réessayer",
    activity: "Activité du système",
    completed: "Terminée",
  },
  es: {
    eyebrow: "TU PC, DE UN VISTAZO",
    title: "Comprende primero. Ajusta con criterio.",
    introduction: "Observa la actividad del sistema, revisa tus ajustes y elige el siguiente paso.",
    snapshot: "Últimas lecturas del sistema",
    waiting: "Esperando lecturas",
    cpuUse: "Uso del procesador",
    ramUse: "Memoria en uso",
    recorded: "Ajustes aplicados",
    recordedHint: "Registrados por PC Tweaker",
    viewChanges: "Revisar cambios",
    next: "Un siguiente paso claro",
    scanTitle: "Descubre qué importa en este PC.",
    scanDescription: "Revisa las recomendaciones según tu hardware antes de elegir qué cambiar.",
    scanAction: "Abrir el análisis",
    gamingTitle: "Explora tu configuración de juego",
    gamingDescription: "Explora las sesiones de juego, Turbo Boost y los ajustes de cada juego.",
    profilesTitle: "Reúne tus ajustes",
    profilesDescription: "Guarda, revisa o carga un perfil con los ajustes que has elegido.",
    recent: "Actividad reciente",
    viewHistory: "Abrir el historial",
    loadingHistory: "Leyendo el historial local…",
    emptyHistory: "Tu historial empieza aquí.",
    emptyHint: "Las acciones registradas por PC Tweaker aparecerán aquí.",
    historyError: "No se pudo cargar el historial local.",
    retry: "Reintentar",
    activity: "Actividad del sistema",
    completed: "Completada",
  },
  de: {
    eyebrow: "DEIN PC IM ÜBERBLICK",
    title: "Erst verstehen. Dann gezielt anpassen.",
    introduction:
      "Beobachte die Systemaktivität, prüfe deine Einstellungen und wähle den nächsten Schritt.",
    snapshot: "Letzte Systemmesswerte",
    waiting: "Warte auf Messwerte",
    cpuUse: "Prozessorauslastung",
    ramUse: "Belegter Arbeitsspeicher",
    recorded: "Angewendete Einstellungen",
    recordedHint: "Von PC Tweaker erfasst",
    viewChanges: "Änderungen prüfen",
    next: "Ein klarer nächster Schritt",
    scanTitle: "Finde heraus, was bei diesem PC zählt.",
    scanDescription: "Prüfe die Empfehlungen für deine Hardware, bevor du Änderungen auswählst.",
    scanAction: "Systemscan öffnen",
    gamingTitle: "Erkunde dein Gaming-Setup",
    gamingDescription: "Erkunde Spielsitzungen, Turbo Boost und Einstellungen für einzelne Spiele.",
    profilesTitle: "Behalte deine Einstellungen zusammen",
    profilesDescription:
      "Speichere, prüfe oder lade ein Profil mit deinen ausgewählten Anpassungen.",
    recent: "Letzte Aktivitäten",
    viewHistory: "Änderungsverlauf öffnen",
    loadingHistory: "Lokaler Verlauf wird geladen…",
    emptyHistory: "Dein Verlauf beginnt hier.",
    emptyHint: "Von PC Tweaker erfasste Aktionen erscheinen hier.",
    historyError: "Der lokale Verlauf konnte nicht geladen werden.",
    retry: "Erneut versuchen",
    activity: "Systemaktivität",
    completed: "Abgeschlossen",
  },
  pt: {
    eyebrow: "O TEU PC NUM RELANCE",
    title: "Primeiro compreende. Depois ajusta com critério.",
    introduction: "Observa a atividade do sistema, revê as definições e escolhe o próximo passo.",
    snapshot: "Últimas leituras do sistema",
    waiting: "A aguardar leituras",
    cpuUse: "Utilização do processador",
    ramUse: "Memória em utilização",
    recorded: "Definições aplicadas",
    recordedHint: "Registadas pelo PC Tweaker",
    viewChanges: "Rever alterações",
    next: "Um próximo passo claro",
    scanTitle: "Descobre o que importa neste PC.",
    scanDescription: "Revê as recomendações para o teu hardware antes de escolher o que alterar.",
    scanAction: "Abrir verificação",
    gamingTitle: "Explora a configuração de jogo",
    gamingDescription: "Explora as sessões de jogo, o Turbo Boost e as definições de cada jogo.",
    profilesTitle: "Reúne as tuas definições",
    profilesDescription: "Guarda, revê ou carrega um perfil com os ajustes que escolheste.",
    recent: "Atividade recente",
    viewHistory: "Abrir o histórico",
    loadingHistory: "A ler o histórico local…",
    emptyHistory: "O teu histórico começa aqui.",
    emptyHint: "As ações registadas pelo PC Tweaker aparecerão aqui.",
    historyError: "Não foi possível carregar o histórico local.",
    retry: "Tentar novamente",
    activity: "Atividade do sistema",
    completed: "Concluída",
  },
};

type HistoryState =
  { status: "loading" } | { status: "error" } | { status: "ready"; entries: AuditEntry[] };

function percentage(value: number | undefined): number | null {
  return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

function HistoryLabel({ entry, s, fallback }: { entry: AuditEntry; s: Strings; fallback: string }) {
  const labels: Record<string, string> = {
    "tweak-applied": s.ledger.actions.applied,
    "tweak-reverted": s.ledger.actions.reverted,
    cleanup: s.ledger.actions.cleanup,
    "files-deleted": s.ledger.actions.filesDeleted,
    "disk-optimize": s.ledger.actions.diskOptimize,
    "startup-change": s.ledger.actions.startupChange,
    "restore-point": s.ledger.actions.restorePoint,
  };
  return <>{labels[entry.action] ?? fallback}</>;
}

function Trace({ values }: { values: number[] }) {
  const points = tracePoints(values, 180, 32, 100);
  return (
    <svg
      className="overview-trace"
      viewBox="0 0 180 36"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path className="overview-trace-grid" d="M0 34H180M0 17H180" />
      {points && <polyline points={points} />}
    </svg>
  );
}

export function OverviewPanel({
  s,
  lang,
  tweaks,
  samples,
  onNavigate,
}: {
  s: Strings;
  lang: Lang;
  tweaks: TweakInfo[];
  samples: PulseSample[];
  onNavigate: (section: Section) => void;
}) {
  const copy = COPY[lang];
  const [history, setHistory] = useState<HistoryState>({ status: "loading" });
  const [historyRequest, setHistoryRequest] = useState(0);

  useEffect(() => {
    let alive = true;
    // One read on entry, with explicit retry. The shared system samples are
    // supplied by the shell; this screen starts no additional monitoring.
    void invoke<AuditEntry[]>("list_audit_log")
      .then((entries) => {
        if (alive) setHistory({ status: "ready", entries: entries.slice(0, 3) });
      })
      .catch(() => {
        if (alive) setHistory({ status: "error" });
      });
    return () => {
      alive = false;
    };
  }, [historyRequest]);

  const latest = samples[samples.length - 1];
  const cpu = percentage(latest?.cpu);
  const ram = percentage(
    latest && latest.ramTotal > 0 ? (latest.ramUsed / latest.ramTotal) * 100 : undefined,
  );
  const number = new Intl.NumberFormat(lang, { maximumFractionDigits: 0 });
  const memory = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  const time = new Intl.DateTimeFormat(lang, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const active = tweaks.filter((tweak) => tweak.applied).length;
  const cpuValues = samples.map((sample) => percentage(sample.cpu)).filter((v) => v !== null);
  const ramValues = samples
    .map((sample) =>
      percentage(sample.ramTotal > 0 ? (sample.ramUsed / sample.ramTotal) * 100 : undefined),
    )
    .filter((v) => v !== null);

  return (
    <section className="overview-panel" aria-labelledby="overview-heading">
      <header className="overview-introduction">
        <p className="overview-eyebrow">{copy.eyebrow}</p>
        <h2 id="overview-heading">{copy.title}</h2>
        <p className="overview-description">{copy.introduction}</p>
      </header>

      <section className="overview-snapshot" aria-label={copy.snapshot}>
        <div className="overview-reading">
          <div className="overview-reading-label">
            <span aria-hidden="true">
              <ChipIcon className="overview-icon" />
            </span>
            <span>{s.systemMonitor.cpu}</span>
          </div>
          <p className="overview-value">
            {cpu === null ? "—" : number.format(cpu)}
            {cpu !== null && <span>%</span>}
          </p>
          <p className="overview-reading-caption">{cpu === null ? copy.waiting : copy.cpuUse}</p>
          <Trace values={cpuValues} />
        </div>
        <div className="overview-reading overview-reading-memory" title={copy.ramUse}>
          <div className="overview-reading-label">
            <span aria-hidden="true">
              <LayersIcon className="overview-icon" />
            </span>
            <span>{s.systemMonitor.ram}</span>
          </div>
          <p className="overview-value">
            {ram === null ? "—" : number.format(ram)}
            {ram !== null && <span>%</span>}
          </p>
          <p className="overview-reading-caption">
            {ram !== null && latest
              ? `${memory.format(latest.ramUsed / 1024 ** 3)} / ${memory.format(latest.ramTotal / 1024 ** 3)} GiB`
              : copy.waiting}
          </p>
          <Trace values={ramValues} />
        </div>
        <div className="overview-reading overview-settings">
          <div className="overview-reading-label">
            <span aria-hidden="true">
              <HistoryIcon className="overview-icon" />
            </span>
            <span>{copy.recorded}</span>
          </div>
          <p className="overview-value">{tweaks.length ? number.format(active) : "—"}</p>
          <p className="overview-reading-caption">
            {tweaks.length ? copy.recordedHint : copy.waiting}
          </p>
          <button
            className="overview-text-button"
            type="button"
            onClick={() => onNavigate("ledger")}
          >
            {copy.viewChanges}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </section>

      <section className="overview-next" aria-labelledby="overview-next-heading">
        <h2 className="overview-section-title" id="overview-next-heading">
          {copy.next}
        </h2>
        <div className="overview-action-layout">
          <div className="overview-primary-action">
            <div className="overview-action-emblem" aria-hidden="true">
              <RadarIcon className="overview-icon" />
            </div>
            <h3>{copy.scanTitle}</h3>
            <p>{copy.scanDescription}</p>
            <button
              className="overview-primary-button"
              type="button"
              onClick={() => onNavigate("scan")}
            >
              {copy.scanAction}
              <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="overview-secondary-actions">
            <button
              className="overview-action-row"
              type="button"
              onClick={() => onNavigate("gaming")}
            >
              <span className="overview-row-icon" aria-hidden="true">
                <HeartPulseIcon className="overview-icon" />
              </span>
              <span className="overview-row-copy">
                <strong>{copy.gamingTitle}</strong>
                <span>{copy.gamingDescription}</span>
              </span>
              <span className="overview-row-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
            <button
              className="overview-action-row"
              type="button"
              onClick={() => onNavigate("profiles")}
            >
              <span className="overview-row-icon" aria-hidden="true">
                <LayersIcon className="overview-icon" />
              </span>
              <span className="overview-row-copy">
                <strong>{copy.profilesTitle}</strong>
                <span>{copy.profilesDescription}</span>
              </span>
              <span className="overview-row-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="overview-history" aria-labelledby="overview-history-heading">
        <div className="overview-section-heading">
          <h2 className="overview-section-title" id="overview-history-heading">
            {copy.recent}
          </h2>
          <button
            className="overview-text-button"
            type="button"
            onClick={() => onNavigate("ledger")}
          >
            {copy.viewHistory}
            <span aria-hidden="true">→</span>
          </button>
        </div>
        {history.status === "loading" && (
          <p className="overview-history-message" role="status">
            {copy.loadingHistory}
          </p>
        )}
        {history.status === "error" && (
          <div className="overview-history-message" role="status">
            <span>{copy.historyError}</span>
            <button
              className="overview-text-button"
              type="button"
              onClick={() => {
                setHistory({ status: "loading" });
                setHistoryRequest((request) => request + 1);
              }}
            >
              {copy.retry}
              <span aria-hidden="true">↻</span>
            </button>
          </div>
        )}
        {history.status === "ready" && history.entries.length === 0 && (
          <div className="overview-history-empty">
            <span className="overview-empty-icon" aria-hidden="true">
              <HistoryIcon className="overview-icon" />
            </span>
            <div>
              <p>{copy.emptyHistory}</p>
              <span>{copy.emptyHint}</span>
            </div>
          </div>
        )}
        {history.status === "ready" && history.entries.length > 0 && (
          <ul className="overview-history-list">
            {history.entries.map((entry, index) => {
              const tweak = tweaks.find((item) => item.id === entry.target);
              const target = tweak
                ? textFor(s.tweaks, tweak.id, tweak.name, tweak.description).name
                : null;
              const date = new Date(entry.ts * 1000);
              const validDate = Number.isFinite(date.getTime());
              return (
                <li key={`${entry.ts}-${entry.action}-${index}`}>
                  <span
                    className="overview-history-dot"
                    data-failed={!entry.success}
                    aria-hidden="true"
                  />
                  <span className="overview-history-copy">
                    <strong>
                      <HistoryLabel entry={entry} s={s} fallback={copy.activity} />
                    </strong>
                    {target && <span title={target}>{target}</span>}
                  </span>
                  <span className="overview-history-result" data-failed={!entry.success}>
                    {entry.success ? copy.completed : s.ledger.failed}
                  </span>
                  {validDate && <time dateTime={date.toISOString()}>{time.format(date)}</time>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
