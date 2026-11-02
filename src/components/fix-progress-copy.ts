import type { Lang } from "../i18n";
import type { FixStepId } from "../fix-steps";

/** Copy for the progress ring of a fix (fix-progress.tsx). Every result line
 *  repeats a number the step measured; nothing here is estimated. */
type Copy = {
  titleScan: string;
  titleSafe: string;
  titleProfile: string;
  complete: string;
  progress: string;
  /** Read out at coarse steps: the percentage and the current step. */
  live: string;
  /** [row label, label while it runs] */
  steps: Record<FixStepId, [string, string]>;
  freed: string;
  released: string;
  applied: string;
  removed: string;
  restoreCreated: string;
  restoreReused: string;
  restoreRequested: string;
  restoreNone: string;
  on: string;
  incomplete: string;
  notMeasured: string;
};

const en: Copy = {
  titleScan: "Fixing your PC",
  titleSafe: "Optimizing safely",
  titleProfile: "Applying the profile",
  complete: "All done",
  progress: "Progress",
  live: "{percent}% · {step}",
  steps: {
    measure_before: ["Measure before", "Measuring your PC…"],
    restore_point: ["Restore point", "Creating a restore point…"],
    system_settings: ["System settings", "Applying system settings…"],
    system_junk: ["System junk files", "Cleaning system junk files…"],
    system_registry: ["System registry leftovers", "Removing system registry leftovers…"],
    memory: ["Standby memory", "Releasing standby memory…"],
    settings: ["Your settings", "Applying settings…"],
    junk: ["Junk files", "Cleaning junk files…"],
    caches: ["App caches", "Clearing app caches…"],
    registry: ["Registry leftovers", "Removing registry leftovers…"],
    booster: ["Smart RAM booster", "Turning on the Smart RAM booster…"],
    measure_after: ["Measure after", "Measuring the results…"],
  },
  freed: "{size} freed",
  released: "{size} released",
  applied: "Applied: {count}",
  removed: "Removed: {count}",
  restoreCreated: "Created at {time}",
  restoreReused: "Kept from {time}",
  restoreRequested: "Requested",
  restoreNone: "Not created",
  on: "On",
  incomplete: "Not completed",
  notMeasured: "Could not measure",
};

const it: Copy = {
  titleScan: "Correzione del PC in corso",
  titleSafe: "Ottimizzazione sicura in corso",
  titleProfile: "Applicazione del profilo",
  complete: "Tutto fatto",
  progress: "Avanzamento",
  live: "{percent}% · {step}",
  steps: {
    measure_before: ["Misura iniziale", "Misurazione del PC…"],
    restore_point: ["Punto di ripristino", "Creazione del punto di ripristino…"],
    system_settings: ["Impostazioni di sistema", "Applicazione delle impostazioni di sistema…"],
    system_junk: ["File inutili di sistema", "Pulizia dei file inutili di sistema…"],
    system_registry: [
      "Residui nel registro di sistema",
      "Rimozione dei residui dal registro di sistema…",
    ],
    memory: ["Memoria in standby", "Rilascio della memoria in standby…"],
    settings: ["Le tue impostazioni", "Applicazione delle impostazioni…"],
    junk: ["File inutili", "Pulizia dei file inutili…"],
    caches: ["Cache delle app", "Pulizia delle cache delle app…"],
    registry: ["Residui nel registro", "Rimozione dei residui dal registro…"],
    booster: ["Booster RAM intelligente", "Attivazione del Booster RAM intelligente…"],
    measure_after: ["Misura finale", "Misurazione dei risultati…"],
  },
  freed: "Liberati: {size}",
  released: "Rilasciati: {size}",
  applied: "Applicate: {count}",
  removed: "Rimosse: {count}",
  restoreCreated: "Creato alle {time}",
  restoreReused: "Mantenuto quello delle {time}",
  restoreRequested: "Richiesto",
  restoreNone: "Non creato",
  on: "Attivo",
  incomplete: "Non completato",
  notMeasured: "Misura non riuscita",
};

const fr: Copy = {
  titleScan: "Correction de votre PC",
  titleSafe: "Optimisation sûre en cours",
  titleProfile: "Application du profil",
  complete: "Terminé",
  progress: "Progression",
  live: "{percent} % · {step}",
  steps: {
    measure_before: ["Mesure initiale", "Mesure de votre PC…"],
    restore_point: ["Point de restauration", "Création d'un point de restauration…"],
    system_settings: ["Réglages du système", "Application des réglages du système…"],
    system_junk: ["Fichiers inutiles du système", "Nettoyage des fichiers inutiles du système…"],
    system_registry: [
      "Restes dans le registre du système",
      "Suppression des restes du registre du système…",
    ],
    memory: ["Mémoire en attente", "Libération de la mémoire en attente…"],
    settings: ["Vos réglages", "Application des réglages…"],
    junk: ["Fichiers inutiles", "Nettoyage des fichiers inutiles…"],
    caches: ["Caches d'applications", "Vidage des caches d'applications…"],
    registry: ["Restes dans le registre", "Suppression des restes du registre…"],
    booster: ["Booster de RAM intelligent", "Activation du booster de RAM intelligent…"],
    measure_after: ["Mesure finale", "Mesure des résultats…"],
  },
  freed: "Libéré : {size}",
  released: "Libérée : {size}",
  applied: "Appliqués : {count}",
  removed: "Supprimées : {count}",
  restoreCreated: "Créé à {time}",
  restoreReused: "Conservé, de {time}",
  restoreRequested: "Demandé",
  restoreNone: "Non créé",
  on: "Activé",
  incomplete: "Non terminé",
  notMeasured: "Mesure impossible",
};

const es: Copy = {
  titleScan: "Corrigiendo tu PC",
  titleSafe: "Optimizando de forma segura",
  titleProfile: "Aplicando el perfil",
  complete: "Todo listo",
  progress: "Progreso",
  live: "{percent}% · {step}",
  steps: {
    measure_before: ["Medición inicial", "Midiendo tu PC…"],
    restore_point: ["Punto de restauración", "Creando un punto de restauración…"],
    system_settings: ["Ajustes del sistema", "Aplicando los ajustes del sistema…"],
    system_junk: ["Archivos basura del sistema", "Limpiando los archivos basura del sistema…"],
    system_registry: [
      "Restos en el registro del sistema",
      "Eliminando los restos del registro del sistema…",
    ],
    memory: ["Memoria en espera", "Liberando la memoria en espera…"],
    settings: ["Tus ajustes", "Aplicando los ajustes…"],
    junk: ["Archivos basura", "Limpiando los archivos basura…"],
    caches: ["Cachés de aplicaciones", "Vaciando las cachés de aplicaciones…"],
    registry: ["Restos en el registro", "Eliminando los restos del registro…"],
    booster: ["Potenciador de RAM inteligente", "Activando el potenciador de RAM inteligente…"],
    measure_after: ["Medición final", "Midiendo los resultados…"],
  },
  freed: "Liberado: {size}",
  released: "Liberada: {size}",
  applied: "Aplicados: {count}",
  removed: "Eliminadas: {count}",
  restoreCreated: "Creado a las {time}",
  restoreReused: "Se mantuvo el de las {time}",
  restoreRequested: "Solicitado",
  restoreNone: "No creado",
  on: "Activado",
  incomplete: "Sin completar",
  notMeasured: "No se pudo medir",
};

const de: Copy = {
  titleScan: "Dein PC wird optimiert",
  titleSafe: "Sichere Optimierung läuft",
  titleProfile: "Profil wird angewendet",
  complete: "Fertig",
  progress: "Fortschritt",
  live: "{percent} % · {step}",
  steps: {
    measure_before: ["Vorher-Messung", "Dein PC wird gemessen…"],
    restore_point: ["Wiederherstellungspunkt", "Wiederherstellungspunkt wird erstellt…"],
    system_settings: ["Systemeinstellungen", "Systemeinstellungen werden angewendet…"],
    system_junk: ["System-Datenmüll", "System-Datenmüll wird entfernt…"],
    system_registry: [
      "Reste in der System-Registry",
      "Reste in der System-Registry werden entfernt…",
    ],
    memory: ["Standby-Speicher", "Standby-Speicher wird freigegeben…"],
    settings: ["Deine Einstellungen", "Einstellungen werden angewendet…"],
    junk: ["Datenmüll", "Datenmüll wird entfernt…"],
    caches: ["App-Caches", "App-Caches werden geleert…"],
    registry: ["Reste in der Registry", "Reste in der Registry werden entfernt…"],
    booster: ["Intelligenter RAM-Booster", "Intelligenter RAM-Booster wird eingeschaltet…"],
    measure_after: ["Nachher-Messung", "Ergebnisse werden gemessen…"],
  },
  freed: "Freigegeben: {size}",
  released: "Freigegeben: {size}",
  applied: "Angewendet: {count}",
  removed: "Entfernt: {count}",
  restoreCreated: "Erstellt um {time}",
  restoreReused: "Behalten, von {time}",
  restoreRequested: "Angefordert",
  restoreNone: "Nicht erstellt",
  on: "Eingeschaltet",
  incomplete: "Nicht abgeschlossen",
  notMeasured: "Messung nicht möglich",
};

const pt: Copy = {
  titleScan: "A corrigir o seu PC",
  titleSafe: "Otimização segura em curso",
  titleProfile: "A aplicar o perfil",
  complete: "Concluído",
  progress: "Progresso",
  live: "{percent}% · {step}",
  steps: {
    measure_before: ["Medição inicial", "A medir o seu PC…"],
    restore_point: ["Ponto de restauro", "A criar um ponto de restauro…"],
    system_settings: ["Definições do sistema", "A aplicar as definições do sistema…"],
    system_junk: ["Ficheiros inúteis do sistema", "A limpar os ficheiros inúteis do sistema…"],
    system_registry: ["Restos no registo do sistema", "A remover os restos do registo do sistema…"],
    memory: ["Memória em espera", "A libertar a memória em espera…"],
    settings: ["As suas definições", "A aplicar as definições…"],
    junk: ["Ficheiros inúteis", "A limpar os ficheiros inúteis…"],
    caches: ["Caches de aplicações", "A limpar as caches de aplicações…"],
    registry: ["Restos no registo", "A remover os restos do registo…"],
    booster: ["Otimizador de RAM inteligente", "A ativar o otimizador de RAM inteligente…"],
    measure_after: ["Medição final", "A medir os resultados…"],
  },
  freed: "Libertado: {size}",
  released: "Libertada: {size}",
  applied: "Aplicadas: {count}",
  removed: "Removidas: {count}",
  restoreCreated: "Criado às {time}",
  restoreReused: "Mantido o das {time}",
  restoreRequested: "Pedido",
  restoreNone: "Não criado",
  on: "Ativado",
  incomplete: "Não concluído",
  notMeasured: "Não foi possível medir",
};

export const FIX_PROGRESS_COPY: Record<Lang, Copy> = { en, it, fr, es, de, pt };
