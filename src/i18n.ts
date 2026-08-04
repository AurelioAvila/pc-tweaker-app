export type Lang = "it" | "en" | "fr" | "es" | "de";

export const LANGUAGES: { code: Lang; native: string }[] = [
  { code: "it", native: "Italiano" },
  { code: "en", native: "English" },
  { code: "fr", native: "Français" },
  { code: "es", native: "Español" },
  { code: "de", native: "Deutsch" },
];

export interface TweakText {
  name: string;
  description: string;
}

export interface Strings {
  appName: string;
  appliedCount: string; // "{applied} of {total} tweaks active" — use {applied}/{total}
  headerNote: string;
  tabs: {
    scan: string;
    performance: string;
    privacy: string;
    ui: string;
    manutenzione: string;
    gaming: string;
    startup: string;
    pricing: string;
  };
  systemMonitor: {
    cpu: string;
    ram: string;
    disk: string;
    uptime: string;
    uptimeValue: string; // uses {hours} {minutes}
    cores: string; // uses {count}
  };
  startupManager: {
    title: string;
    description: string;
    empty: string;
    activeCount: string; // uses {enabled} {total}
    machineWide: string;
    impactNote: string;
  };
  search: {
    placeholder: string;
    noResults: string; // uses {query}
    clear: string;
  };
  pricing: {
    title: string;
    subtitle: string;
    monthly: string;
    annual: string;
    saveBadge: string; // uses {percent}
    perMonth: string;
    perYear: string;
    annualDetail: string; // uses {monthly} {yearly}
    annualNudge: string; // uses {price}
    mostChosen: string;
    freeName: string;
    freeTagline: string;
    freePriceNote: string;
    freeCta: string;
    freeCurrent: string;
    proName: string;
    proTagline: string;
    proCta: string;
    proCurrent: string;
    everythingInFree: string;
    reassurance: string;
    freeFeatures: string[];
    proFeatures: string[];
  };
  toggle: { on: string; off: string };
  badges: { admin: string; pro: string; soon: string };
  emptyCategory: string;
  gameSessions: {
    title: string;
    subtitle: string;
    active: string; // uses {name}
    gamesCount: string; // uses {count}
    addGame: string;
  };
  turboBoost: {
    title: string;
    subtitle: string;
    startLabel: string;
    stopLabel: string;
    activating: string;
    deactivating: string;
    active: string;
    inactive: string;
  };
  scan: {
    title: string;
    subtitle: string;
    startLabel: string;
    stepPerformance: string;
    stepPrivacy: string;
    stepGaming: string;
    stepJunk: string;
    allGood: string;
    issuesFound: string; // uses {count}
    selectAll: string;
    deselectAll: string;
    fixAll: string;
    fixing: string; // uses {done} {total}
    fixedToast: string; // uses {count}
    proIssuesTitle: string;
    unlockPro: string;
    scanAgain: string;
    doneTitle: string;
    doneBody: string; // uses {count}
    fixHeading: string;
  };
  ram: {
    title: string;
    subtitle: string;
    button: string;
    cleaning: string;
    freed: string; // uses {amount}
    freedNothing: string;
    inUse: string; // uses {used} {total}
    autoLabel: string;
    autoOff: string;
    autoEvery: string; // uses {interval}
    autoHint: string;
  };
  restore: {
    button: string;
    title: string;
    body: string; // uses {count}
    confirm: string;
    cancel: string;
    running: string;
    doneToast: string; // uses {count}
    nothingToast: string;
  };
  passwordCheck: {
    title: string;
    description: string;
    placeholder: string;
    button: string;
    checking: string;
    safe: string;
    breached: string; // uses {count}
    error: string;
  };
  paywall: {
    title: string;
    body: string; // uses {feature}
    unlock: string;
    notNow: string;
    notConnectedToast: string;
  };
  cleanupConfirm: {
    title: string;
    body: string; // uses {name}
    confirm: string;
    cancel: string;
  };
  cleanupButton: string;
  cleanupRunning: string;
  cleanupResultToast: string; // uses {deleted} {freed} {skipped}
  cleanupResultToastSkipped: string; // appended fragment, uses {skipped}
  diskOptimize: {
    title: string;
    description: string;
    button: string;
    running: string;
    resultToast: string; // uses {media}
  };
  dnsFlush: {
    title: string;
    description: string;
    button: string;
    running: string;
    resultToast: string;
  };
  largeFiles: {
    title: string;
    description: string;
    chooseFolder: string;
    scanning: string;
    noneFound: string; // uses {size}
    foundCount: string; // uses {count}
    moveSelected: string; // uses {count}
    deleting: string;
    deletedToast: string; // uses {count} {freed}
  };
  diskHealth: {
    title: string;
    freeSpace: string; // uses {size}
    selectDrive: string;
    healthy: string;
    warning: string;
    unhealthy: string;
    unknown: string;
    loading: string;
  };
  duplicateFinder: {
    title: string;
    description: string;
    chooseFolder: string;
    scanning: string;
    noneFound: string;
    copies: string; // uses {count} {size}
    moveSelected: string; // uses {count}
    deleting: string;
    deletedToast: string; // uses {count} {freed}
  };
  ipMask: {
    title: string;
    description: string;
    button: string;
    explainerToast: string;
  };
  toasts: {
    applied: string; // uses {name}
    rolledBack: string; // uses {name}
  };
  menu: {
    account: string;
    plan: string;
    planFree: string;
    planPro: string;
    upgradeButton: string;
    language: string;
    theme: string;
    about: string;
    aboutBody: string;
    close: string;
  };
  auth: {
    login: string;
    register: string;
    email: string;
    password: string;
    loginButton: string;
    registerButton: string;
    working: string;
    logout: string;
    loggedInAs: string; // uses {email}
    backendNotConfigured: string;
    switchToRegister: string;
    switchToLogin: string;
    emailInvalid: string;
    passwordTooShort: string;
    firstName: string;
    lastName: string;
    registerDetailsRequired: string;
    loginRequiredForCheckout: string;
    forgotPasswordLink: string;
    forgotPasswordButton: string;
    forgotPasswordSent: string;
    backToLogin: string;
    emailNotVerified: string;
    emailVerified: string;
    resendVerification: string;
    verificationSent: string;
  };
  tweaks: Record<string, TweakText>;
  cleanup: Record<string, TweakText>;
}

function format(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export { format };

const it: Strings = {
  appName: "PC Tweaker",
  appliedCount: "{applied} di {total} tweak attivi",
  headerNote:
    "Ogni tweak salva un backup del valore originale prima di essere applicato. I tweak con privilegi elevati chiedono un consenso UAC esplicito, solo per quell'azione.",
  tabs: { scan: "Scansione", performance: "Prestazioni", privacy: "Privacy", ui: "Interfaccia", manutenzione: "Manutenzione", gaming: "Gaming", startup: "Avvio", pricing: "Piani e prezzi" },
  systemMonitor: {
    cpu: "CPU",
    ram: "Memoria",
    disk: "Disco",
    uptime: "Acceso da",
    uptimeValue: "{hours}h {minutes}m",
    cores: "{count} core",
  },
  startupManager: {
    title: "Programmi all'avvio",
    description:
      "I programmi che si aprono da soli all'accensione del PC. Disattivarne qualcuno accorcia i tempi di avvio: il programma resta installato e lo puoi comunque aprire a mano.",
    empty: "Nessun programma configurato per l'avvio automatico.",
    activeCount: "Attivi: {enabled} / {total}",
    machineWide: "Tutti gli utenti",
    impactNote: "Disattivare non disinstalla nulla ed è reversibile in qualsiasi momento.",
  },
  search: {
    placeholder: "Cerca un tweak...",
    noResults: "Nessun risultato per \"{query}\".",
    clear: "Cancella",
  },
  pricing: {
    title: "Scegli quanto vuoi spingere",
    subtitle: "Inizia gratis. Passa a Pro quando vuoi ogni singolo frame in pi\u00f9.",
    monthly: "Mensile",
    annual: "Annuale",
    saveBadge: "RISPARMI IL {percent}%",
    perMonth: "/mese",
    perYear: "/anno",
    annualDetail: "Sono {monthly} al mese, addebitati {yearly} una volta l\u2019anno",
    annualNudge: "Con il piano annuale sarebbero {price} al mese",
    mostChosen: "IL PI\u00d9 SCELTO",
    freeName: "Free",
    freeTagline: "Tutto il necessario per un PC pi\u00f9 pulito e reattivo.",
    freePriceNote: "Per sempre, senza scadenza",
    freeCta: "Stai usando il piano Free",
    freeCurrent: "Piano attuale",
    proName: "Pro",
    proTagline: "Per chi gioca sul serio e non vuole perdere un frame.",
    proCta: "Passa a Pro",
    proCurrent: "Il tuo piano",
    everythingInFree: "Tutto quello che c\u2019\u00e8 nel Free, pi\u00f9:",
    reassurance: "Disdici quando vuoi. Ogni modifica resta reversibile con un click, anche dopo la disdetta.",
    freeFeatures: [
      "{count} tweak reali, con backup e ripristino di ogni modifica",
      "Monitor di sistema in tempo reale (CPU, memoria, disco)",
      "Gestione dei programmi all\u2019avvio",
      "Controllo violazioni password",
      "Scansione del PC e correzione in un click",
      "Pulizia dei file temporanei",
    ],
    proFeatures: [
      "Game Sessions: attiva il turbo da solo quando lanci un gioco",
      "Preset Turbo Gaming e priorit\u00e0 massima ai giochi",
      "Privacy avanzata: telemetria e cronologia attivit\u00e0",
      "Trova e rimuove i file duplicati",
      "Svuota la cache di Windows Update",
      "Disattiva l\u2019indicizzazione che tiene il disco occupato",
      "Ogni tweak e ogni funzione futura, inclusi",
    ],
  },
  toggle: { on: "Attivato", off: "Disattivato" },
  badges: { admin: "Admin", pro: "PRO", soon: "IN ARRIVO" },
  emptyCategory: "Nessun tweak disponibile in questa categoria — presto in arrivo.",
  gameSessions: {
    title: "Game Sessions",
    subtitle: "Rileva automaticamente i tuoi giochi e applica/annulla il preset Turbo Gaming da solo.",
    active: "Sessione attiva: {name}",
    gamesCount: "{count} giochi registrati",
    addGame: "+ Aggiungi gioco (.exe)",
  },
  turboBoost: {
    title: "Turbo Boost",
    subtitle: "Spinge il processore al massimo delle prestazioni per il gaming, con un tocco.",
    startLabel: "START",
    stopLabel: "STOP",
    activating: "Attivazione turbo in corso...",
    deactivating: "Ripristino in corso...",
    active: "Turbo attivo",
    inactive: "Turbo non attivo",
  },
  scan: {
    title: "Scansione rapida",
    subtitle: "Controlla lo stato del PC e trova ottimizzazioni non ancora attive, in un click.",
    startLabel: "SCAN",
    stepPerformance: "Prestazioni",
    stepPrivacy: "Privacy",
    stepGaming: "Gaming",
    stepJunk: "File temporanei",
    allGood: "Tutto ok — nessun problema trovato.",
    issuesFound: "{count} ottimizzazioni disponibili",
    selectAll: "Seleziona tutto",
    deselectAll: "Deseleziona tutto",
    fixAll: "Correggi tutto",
    fixing: "Correzione {done}/{total}...",
    fixedToast: "{count} problemi corretti.",
    proIssuesTitle: "Disponibili anche con Pro",
    unlockPro: "Sblocca Pro",
    scanAgain: "Scansiona di nuovo",
    doneTitle: "Fatto!",
    doneBody: "{count} ottimizzazioni applicate. Il tuo PC è a posto.",
    fixHeading: "Pronte da applicare",
  },
  ram: {
    title: "Libera RAM",
    subtitle: "Chiede a Windows di rilasciare la memoria che i programmi tengono occupata senza usarla. Puoi farlo quante volte vuoi.",
    button: "Libera ora",
    cleaning: "Pulizia in corso...",
    freed: "Liberati {amount}",
    freedNothing: "La memoria era già ottimizzata",
    inUse: "{used} di {total} in uso",
    autoLabel: "Pulizia automatica",
    autoOff: "Disattivata",
    autoEvery: "Ogni {interval}",
    autoHint: "Con la pulizia automatica attiva, PC Tweaker libera la RAM da solo a intervalli regolari finché l'app resta aperta.",
  },
  restore: {
    button: "Ripristina tutto",
    title: "Ripristinare tutte le modifiche?",
    body: "Verranno disattivate le {count} ottimizzazioni attive e ogni valore tornerà esattamente com'era prima. Nessun dato viene perso.",
    confirm: "Sì, ripristina tutto",
    cancel: "Annulla",
    running: "Ripristino...",
    doneToast: "{count} ottimizzazioni ripristinate.",
    nothingToast: "Non c'è nulla da ripristinare.",
  },
  passwordCheck: {
    title: "Controllo violazioni password",
    description:
      "Verifica se una password è comparsa in una violazione di dati nota, senza mai inviarla per intero: solo un frammento del suo hash viene inviato (k-anonymity, standard usato da Have I Been Pwned).",
    placeholder: "Incolla una password da controllare",
    button: "Controlla",
    checking: "Controllo in corso...",
    safe: "Non risulta in nessuna violazione nota. Ottimo segno.",
    breached: "Trovata in {count} violazioni note. Cambiala subito, ovunque la usi.",
    error: "Impossibile controllare ora: verifica la connessione e riprova.",
  },
  paywall: {
    title: "Funzione Pro",
    body: '"{feature}" fa parte di PC Tweaker Pro, insieme a Game Sessions, ai preset gaming e a ogni funzione futura.',
    unlock: "Vedi piani e prezzi",
    notNow: "Non ora",
    notConnectedToast: "Il pagamento Pro non è ancora collegato in questa versione di sviluppo.",
  },
  cleanupConfirm: {
    title: "Confermi la pulizia?",
    body: '"{name}" sposterà i file corrispondenti nel Cestino di Windows. Potrai recuperarli da lì finché non lo svuoti.',
    confirm: "Sposta nel Cestino",
    cancel: "Annulla",
  },
  cleanupButton: "Pulisci",
  cleanupRunning: "...",
  cleanupResultToast: "{deleted} elementi spostati nel Cestino, {freed} liberati",
  cleanupResultToastSkipped: " ({skipped} in uso, saltati).",
  diskOptimize: {
    title: "Ottimizza disco",
    description: "Esegue lo strumento di ottimizzazione integrato di Windows: deframmentazione su HDD, oppure TRIM sugli SSD (mai una deframmentazione completa, che li usurerebbe inutilmente).",
    button: "Ottimizza ora",
    running: "Ottimizzazione in corso... può richiedere qualche minuto",
    resultToast: "Disco ({media}) ottimizzato con successo.",
  },
  dnsFlush: {
    title: "Svuota cache DNS",
    description: "Cancella gli indirizzi DNS salvati in memoria. Utile se un sito ha cambiato server e nel browser continui a vedere la versione vecchia.",
    button: "Svuota ora",
    running: "Svuotamento...",
    resultToast: "Cache DNS svuotata.",
  },
  largeFiles: {
    title: "Trova file di grandi dimensioni",
    description: "Cerca in una cartella i file più pesanti (oltre 100 MB), così puoi liberare spazio velocemente eliminando quelli che non ti servono più.",
    chooseFolder: "Scegli cartella",
    scanning: "Ricerca in corso...",
    noneFound: "Nessun file sopra {size} trovato.",
    foundCount: "{count} file trovati",
    moveSelected: "Cestina {count} selezionati",
    deleting: "Cestinamento...",
    deletedToast: "{count} file cestinati, {freed} liberati.",
  },
  diskHealth: {
    title: "Salute disco",
    freeSpace: "{size} liberi",
    selectDrive: "Disco",
    healthy: "Integro",
    warning: "Attenzione",
    unhealthy: "Compromesso",
    unknown: "Sconosciuto",
    loading: "Controllo...",
  },
  duplicateFinder: {
    title: "Trova file duplicati",
    description:
      "Scegli una cartella: individua i file identici e ti lascia scegliere quali spostare nel Cestino.",
    chooseFolder: "Scegli cartella",
    scanning: "Scansione...",
    noneFound: "Nessun file duplicato trovato in questa cartella.",
    copies: "{count} copie · {size} ciascuna",
    moveSelected: "Sposta nel Cestino ({count} selezionati)",
    deleting: "...",
    deletedToast: "{count} file spostati nel Cestino ({freed} liberati).",
  },
  ipMask: {
    title: "Maschera IP (VPN)",
    description:
      "Nasconde il tuo indirizzo IP instradando il traffico su un server VPN. Richiede un servizio VPN esterno: non ancora integrato in questa versione.",
    button: "Scopri di più",
    explainerToast:
      "Il mascheramento IP reale richiede un backend VPN dedicato (server + protocollo). Non è ancora collegato: qui trovi solo l'anteprima della funzione.",
  },
  toasts: {
    applied: '"{name}" applicato.',
    rolledBack: '"{name}" ripristinato al valore originale.',
  },
  menu: {
    account: "Account",
    plan: "Piano",
    planFree: "Gratuito",
    planPro: "Pro",
    upgradeButton: "Passa a Pro",
    language: "Lingua",
    theme: "Temi",
    about: "Informazioni",
    aboutBody: "PC Tweaker — tweak di sistema con backup e ripristino automatico.",
    close: "Chiudi",
  },
  auth: {
    login: "Accedi",
    register: "Registrati",
    email: "Email",
    password: "Password",
    loginButton: "Accedi",
    registerButton: "Crea account",
    working: "...",
    logout: "Esci",
    loggedInAs: "Accesso effettuato come {email}",
    backendNotConfigured:
      "Nessun server collegato ancora: configura API_BASE_URL dopo aver distribuito il backend.",
    switchToRegister: "Non hai un account? Registrati",
    switchToLogin: "Hai già un account? Accedi",
    emailInvalid: "Inserisci un'email valida.",
    passwordTooShort: "La password deve avere almeno 8 caratteri.",
    firstName: "Nome",
    lastName: "Cognome",
    registerDetailsRequired: "Nome, cognome e data di nascita sono obbligatori.",
    loginRequiredForCheckout: "Accedi o registrati prima di sbloccare Pro.",
    forgotPasswordLink: "Password dimenticata?",
    forgotPasswordButton: "Invia link di ripristino",
    forgotPasswordSent: "Se l'email è registrata, riceverai un link per reimpostare la password.",
    backToLogin: "Torna al login",
    emailNotVerified: "Email non verificata",
    emailVerified: "Email verificata",
    resendVerification: "Invia di nuovo",
    verificationSent: "Email di verifica inviata.",
  },
  tweaks: {
    disable_startup_delay: {
      name: "Rimuovi il ritardo dei programmi all'avvio",
      description:
        "Windows aspetta di proposito circa 10 secondi dopo l'accesso prima di lanciare i programmi all'avvio. Questa opzione elimina quell'attesa (HKCU, nessuna elevazione richiesta).",
    },
    menu_show_delay: {
      name: "Risposta immediata dei menu",
      description:
        "Elimina il ritardo con cui si aprono i menu: tutto il desktop risulta subito più reattivo (HKCU, nessuna elevazione richiesta).",
    },
    disable_power_throttling: {
      name: "Disattiva il risparmio energetico della CPU",
      description:
        "Impedisce a Windows di rallentare i processi in background per risparmiare energia: utile sui portatili, dove questo causa scatti durante le sessioni lunghe (HKLM, richiede privilegi di amministratore).",
    },
    games_gpu_priority: {
      name: "Aumenta la priorità GPU per i giochi",
      description:
        "Indica allo scheduler multimediale di assegnare ai giochi la classe di priorità GPU più alta, così le app in background smettono di contendere la GPU nel mezzo di una partita (HKLM, richiede privilegi di amministratore).",
    },
    disable_tailored_experiences: {
      name: "Disattiva le esperienze personalizzate",
      description:
        "Impedisce a Windows di usare i tuoi dati diagnostici per personalizzare pubblicità, suggerimenti e consigli (HKCU, nessuna elevazione richiesta).",
    },
    disable_app_launch_tracking: {
      name: "Non tracciare le app che apri",
      description:
        "Windows registra quanto spesso avvii ogni programma per ordinare i risultati del menu Start. Questa opzione disattiva quel tracciamento (HKCU, nessuna elevazione richiesta).",
    },
    disable_feedback_requests: {
      name: "Blocca le richieste di feedback di Windows",
      description:
        "Impedisce a Windows di interromperti con i sondaggi \"Quanto consiglieresti...\" (HKCU, nessuna elevazione richiesta).",
    },
    disable_cortana: {
      name: "Disattiva Cortana",
      description:
        "Disattiva Cortana tramite policy di sistema, liberando le risorse che riserva in background (HKLM, richiede privilegi di amministratore).",
    },
    show_file_extensions: {
      name: "Mostra sempre le estensioni dei file",
      description:
        "Rivela la vera estensione di ogni file. Vale la pena attivarla anche solo per sicurezza: smaschera file come \"fattura.pdf.exe\" che Windows altrimenti nasconde (HKCU, nessuna elevazione richiesta).",
    },
    hide_taskbar_widgets: {
      name: "Nascondi i Widget dalla barra delle applicazioni",
      description:
        "Rimuove il pulsante Widget (meteo/notizie), che carica contenuti in background anche se non lo apri mai (HKCU, nessuna elevazione richiesta).",
    },
    disable_transparency: {
      name: "Disattiva gli effetti di trasparenza",
      description:
        "Disattiva gli effetti sfocatura/acrilico di barra e menu. Un risparmio di GPU piccolo ma reale, che rende più fluidi i PC datati o con grafica integrata (HKCU, nessuna elevazione richiesta).",
    },
    dark_mode: {
      name: "Modalità scura",
      description: "Attiva il tema scuro per app e sistema (HKCU, nessuna elevazione richiesta).",
    },
    show_hidden_files: {
      name: "Mostra file nascosti",
      description: "Mostra i file e le cartelle nascosti in Esplora file (HKCU, nessuna elevazione richiesta).",
    },
    priority_separation: {
      name: "Ottimizza priorità processore",
      description:
        "Regola Win32PrioritySeparation per favorire i servizi in background (HKLM, richiede privilegi di amministratore).",
    },
    disable_game_dvr: {
      name: "Disattiva Xbox Game Bar / Game DVR",
      description:
        "Disattiva la registrazione in background di Xbox Game Bar, che consuma CPU/GPU durante il gioco (HKCU, nessuna elevazione richiesta).",
    },
    disable_telemetry_tasks: {
      name: "Riduci raccolta dati diagnostici",
      description: "Imposta il livello di diagnostica di Windows al minimo consentito (HKLM, richiede privilegi di amministratore).",
    },
    reset_advertising_id: {
      name: "Disattiva ID pubblicità",
      description: "Impedisce alle app di usare il tuo ID pubblicitario per la profilazione (HKCU, nessuna elevazione richiesta).",
    },
    disable_location_tracking: {
      name: "Disattiva tracciamento posizione",
      description:
        "Blocca l'accesso alla posizione geografica per tutte le app tramite policy di sistema (HKLM, richiede privilegi di amministratore).",
    },
    disable_bing_search: {
      name: "Disattiva ricerca Bing nel menu Start",
      description: "Impedisce che le tue ricerche nel menu Start vengano inviate a Bing (HKCU, nessuna elevazione richiesta).",
    },
    power_plan_performance: {
      name: "Prestazioni elevate (piano di alimentazione)",
      description:
        'Passa al piano di alimentazione Windows "Prestazioni elevate". Utile su desktop o quando sei collegato alla corrente; ripristina il piano precedente al rollback.',
    },
    turbo_gaming: {
      name: "Turbo Gaming",
      description:
        "Preset: disattiva Game DVR, imposta il piano di alimentazione su Prestazioni elevate e ottimizza la priorità del processore (richiede privilegi di amministratore).",
    },
    privacy_dns: {
      name: "DNS privati (Cloudflare)",
      description:
        "Passa a server DNS orientati alla privacy (1.1.1.1) impedendo al tuo provider di registrare le richieste DNS. Non nasconde il tuo indirizzo IP (per quello serve una VPN, vedi sotto).",
    },
    hardware_gpu_scheduling: {
      name: "Pianificazione GPU con accelerazione hardware",
      description:
        "Attiva la Pianificazione GPU con accelerazione hardware (HAGS) di Windows, che può ridurre la latenza di input in molti giochi (HKLM, richiede privilegi di amministratore).",
    },
    reduce_input_lag: {
      name: "Riduci ritardo di input (mouse)",
      description:
        'Disattiva l\'accelerazione del puntatore ("Migliora precisione puntatore") per un movimento del mouse 1:1, senza ritardi introdotti dal sistema (HKCU, nessuna elevazione richiesta).',
    },
    turbo_boost: {
      name: "Turbo Boost processore",
      description:
        'Imposta la modalità di aumento delle prestazioni del processore su "Aggressiva", per sfruttare al massimo il Turbo Boost/Turbo Core durante il gioco (richiede privilegi di amministratore).',
    },
    network_throttling_index: {
      name: "Disattiva limitazione di rete multimediale",
      description:
        "Rimuove il limite che Windows impone al traffico di rete durante l'uso di app multimediali/giochi, utile per ridurre micro-lag online (HKLM, richiede privilegi di amministratore).",
    },
    system_responsiveness: {
      name: "Massimizza reattività per app in primo piano",
      description:
        "Azzera la quota di CPU riservata da Windows ai task in background, lasciando più risorse all'app/gioco in primo piano (HKLM, richiede privilegi di amministratore).",
    },
    games_task_priority: {
      name: "Priorità massima ai giochi (multimedia scheduler)",
      description:
        "Dice allo scheduler multimediale di Windows di trattare i giochi come i processi a più alta priorità del sistema, davanti a qualunque task in background (HKLM, richiede privilegi di amministratore).",
    },
    reduce_keyboard_delay: {
      name: "Riduci ritardo di input (tastiera)",
      description:
        "Azzera il ritardo prima che una pressione prolungata dei tasti inizi a ripetersi e ne massimizza la velocità di ripetizione, per una risposta più immediata in gioco (HKCU, nessuna elevazione richiesta).",
    },
    taskbar_align_left: {
      name: "Allinea la barra delle applicazioni a sinistra",
      description:
        "Riporta le icone della taskbar allineate a sinistra (stile Windows 10) invece che al centro (HKCU, nessuna elevazione richiesta).",
    },
    hide_taskbar_chat: {
      name: "Nascondi Chat/Teams dalla barra delle applicazioni",
      description: "Rimuove l'icona Chat (Microsoft Teams) dalla taskbar (HKCU, nessuna elevazione richiesta).",
    },
    disable_start_suggestions: {
      name: "Disattiva suggerimenti e app consigliate nel menu Start",
      description:
        "Impedisce a Windows di mostrare app consigliate, annunci e suggerimenti nel menu Start (HKCU, nessuna elevazione richiesta).",
    },
    disable_activity_history: {
      name: "Disattiva cronologia attività (Windows Timeline)",
      description:
        "Impedisce a Windows di registrare, salvare e inviare a Microsoft la cronologia delle app e dei documenti usati, tramite policy di sistema (HKLM, richiede privilegi di amministratore).",
    },
    hide_taskbar_search: {
      name: "Nascondi la casella di ricerca dalla barra delle applicazioni",
      description:
        "Rimuove la casella/icona di ricerca dalla taskbar, per una barra più pulita (la ricerca resta comunque disponibile dal tasto Windows) (HKCU, nessuna elevazione richiesta).",
    },
    disable_fullscreen_optimizations_global: {
      name: "Disattiva ottimizzazioni schermo intero globalmente",
      description:
        "Forza DXGI a rispettare la vera modalità a schermo intero esclusiva invece della simulazione di Windows, riducendo micro-scatti e input lag in molti giochi più datati (HKCU, nessuna elevazione richiesta).",
    },
    disable_windows_search_service: {
      name: "Disattiva servizio di indicizzazione (Windows Search)",
      description:
        "Ferma e disattiva il servizio di indicizzazione dei file di Windows, riducendo l'attività su disco in background — utile su SSD piccoli o mentre giochi. La ricerca file nel menu Start diventa più lenta finché non lo riattivi (richiede privilegi di amministratore).",
    },
  },
  cleanup: {
    temp_cleanup: {
      name: "Pulisci file temporanei",
      description:
        "Sposta nel Cestino il contenuto di %TEMP%: puoi recuperarlo in qualsiasi momento, non è una cancellazione definitiva.",
    },
    winupdate_cache_cleanup: {
      name: "Svuota cache aggiornamenti Windows",
      description: "Sposta nel Cestino i pacchetti di Windows Update già installati (richiede privilegi di amministratore).",
    },
  },
};

const en: Strings = {
  appName: "PC Tweaker",
  appliedCount: "{applied} of {total} tweaks active",
  headerNote:
    "Every tweak backs up the original value before it's applied. Tweaks that need elevated rights ask for an explicit UAC prompt, only for that action.",
  tabs: { scan: "Scan", performance: "Performance", privacy: "Privacy", ui: "UI", manutenzione: "Maintenance", gaming: "Gaming", startup: "Startup", pricing: "Plans & pricing" },
  systemMonitor: {
    cpu: "CPU",
    ram: "Memory",
    disk: "Disk",
    uptime: "Up for",
    uptimeValue: "{hours}h {minutes}m",
    cores: "{count} cores",
  },
  startupManager: {
    title: "Startup programs",
    description:
      "Programs that open by themselves when your PC boots. Turning some off shortens startup time: the program stays installed and you can still open it manually.",
    empty: "No programs are set to start automatically.",
    activeCount: "Active: {enabled} / {total}",
    machineWide: "All users",
    impactNote: "Turning one off uninstalls nothing and is reversible at any time.",
  },
  search: {
    placeholder: "Search a tweak...",
    noResults: "No results for \"{query}\".",
    clear: "Clear",
  },
  pricing: {
    title: "Choose how hard you push",
    subtitle: "Start free. Go Pro when you want every last frame.",
    monthly: "Monthly",
    annual: "Yearly",
    saveBadge: "SAVE {percent}%",
    perMonth: "/month",
    perYear: "/year",
    annualDetail: "That\u2019s {monthly} a month, charged {yearly} once a year",
    annualNudge: "On the yearly plan it would be {price} a month",
    mostChosen: "MOST CHOSEN",
    freeName: "Free",
    freeTagline: "Everything you need for a cleaner, snappier PC.",
    freePriceNote: "Free forever, no expiry",
    freeCta: "You\u2019re on the Free plan",
    freeCurrent: "Current plan",
    proName: "Pro",
    proTagline: "For people who game seriously and won\u2019t drop a frame.",
    proCta: "Go Pro",
    proCurrent: "Your plan",
    everythingInFree: "Everything in Free, plus:",
    reassurance: "Cancel anytime. Every change stays one click away from being undone, even after you cancel.",
    freeFeatures: [
      "{count} real tweaks, each backed up and revertible",
      "Live system monitor (CPU, memory, disk)",
      "Startup programs manager",
      "Password breach check",
      "One-click PC scan and fix",
      "Temporary file cleanup",
    ],
    proFeatures: [
      "Game Sessions: turbo turns itself on when you launch a game",
      "Turbo Gaming preset and maximum priority for games",
      "Advanced privacy: telemetry and activity history",
      "Finds and removes duplicate files",
      "Clears the Windows Update cache",
      "Disables the indexing that keeps your disk busy",
      "Every tweak and every future feature, included",
    ],
  },
  toggle: { on: "On", off: "Off" },
  badges: { admin: "Admin", pro: "PRO", soon: "COMING SOON" },
  emptyCategory: "No tweaks available in this category yet — more coming soon.",
  gameSessions: {
    title: "Game Sessions",
    subtitle: "Auto-detects your games and applies/reverts the Turbo Gaming preset on its own.",
    active: "Session active: {name}",
    gamesCount: "{count} games registered",
    addGame: "+ Add game (.exe)",
  },
  turboBoost: {
    title: "Turbo Boost",
    subtitle: "Pushes your processor to peak gaming performance, with one tap.",
    startLabel: "START",
    stopLabel: "STOP",
    activating: "Activating turbo...",
    deactivating: "Restoring...",
    active: "Turbo active",
    inactive: "Turbo not active",
  },
  scan: {
    title: "Quick scan",
    subtitle: "Checks your PC's status and finds optimizations that aren't active yet, in one click.",
    startLabel: "SCAN",
    stepPerformance: "Performance",
    stepPrivacy: "Privacy",
    stepGaming: "Gaming",
    stepJunk: "Temp files",
    allGood: "All good — no issues found.",
    issuesFound: "{count} optimizations available",
    selectAll: "Select all",
    deselectAll: "Deselect all",
    fixAll: "Fix all",
    fixing: "Fixing {done}/{total}...",
    fixedToast: "{count} issues fixed.",
    proIssuesTitle: "Also available with Pro",
    unlockPro: "Unlock Pro",
    scanAgain: "Scan again",
    doneTitle: "Done!",
    doneBody: "{count} optimizations applied. Your PC is all set.",
    fixHeading: "Ready to apply",
  },
  ram: {
    title: "Free up RAM",
    subtitle: "Asks Windows to release memory that programs are holding but not using. Run it as often as you like.",
    button: "Free now",
    cleaning: "Cleaning up...",
    freed: "Freed {amount}",
    freedNothing: "Memory was already optimized",
    inUse: "{used} of {total} in use",
    autoLabel: "Automatic cleanup",
    autoOff: "Off",
    autoEvery: "Every {interval}",
    autoHint: "With automatic cleanup on, PC Tweaker frees RAM by itself at a regular interval for as long as the app stays open.",
  },
  restore: {
    button: "Restore all",
    title: "Restore every change?",
    body: "This will turn off the {count} active optimizations and put every value back exactly as it was. Nothing is lost.",
    confirm: "Yes, restore everything",
    cancel: "Cancel",
    running: "Restoring...",
    doneToast: "{count} optimizations restored.",
    nothingToast: "There is nothing to restore.",
  },
  passwordCheck: {
    title: "Password breach check",
    description:
      "Checks whether a password has shown up in a known data breach, without ever sending it in full: only a fragment of its hash is sent (k-anonymity, the same standard used by Have I Been Pwned).",
    placeholder: "Paste a password to check",
    button: "Check",
    checking: "Checking...",
    safe: "Not found in any known breach. Good sign.",
    breached: "Found in {count} known breaches. Change it now, everywhere you use it.",
    error: "Couldn't check right now: check your connection and try again.",
  },
  paywall: {
    title: "Pro feature",
    body: '"{feature}" is part of PC Tweaker Pro, along with Game Sessions, the gaming presets and every future feature.',
    unlock: "See plans & pricing",
    notNow: "Not now",
    notConnectedToast: "Pro payment isn't wired up yet in this development build.",
  },
  cleanupConfirm: {
    title: "Confirm cleanup?",
    body: '"{name}" will move the matching files to the Windows Recycle Bin. You can restore them from there until it\'s emptied.',
    confirm: "Move to Recycle Bin",
    cancel: "Cancel",
  },
  cleanupButton: "Clean up",
  cleanupRunning: "...",
  cleanupResultToast: "{deleted} items moved to Recycle Bin, {freed} freed",
  cleanupResultToastSkipped: " ({skipped} in use, skipped).",
  diskOptimize: {
    title: "Optimize drive",
    description: "Runs Windows' own built-in optimizer: defragmentation on an HDD, or TRIM on an SSD (never a full defrag, which would only wear it out for no benefit).",
    button: "Optimize now",
    running: "Optimizing... this can take a few minutes",
    resultToast: "Drive ({media}) optimized successfully.",
  },
  dnsFlush: {
    title: "Flush DNS cache",
    description: "Clears cached DNS lookups. Useful if a site changed servers and your browser keeps showing the old version.",
    button: "Flush now",
    running: "Flushing...",
    resultToast: "DNS cache flushed.",
  },
  largeFiles: {
    title: "Find large files",
    description: "Scans a folder for its biggest files (over 100 MB), so you can quickly free up space by removing the ones you no longer need.",
    chooseFolder: "Choose folder",
    scanning: "Scanning...",
    noneFound: "No files found over {size}.",
    foundCount: "{count} files found",
    moveSelected: "Move {count} selected to Recycle Bin",
    deleting: "Moving to Recycle Bin...",
    deletedToast: "{count} files moved, {freed} freed.",
  },
  diskHealth: {
    title: "Drive health",
    freeSpace: "{size} free",
    selectDrive: "Drive",
    healthy: "Healthy",
    warning: "Warning",
    unhealthy: "Unhealthy",
    unknown: "Unknown",
    loading: "Checking...",
  },
  duplicateFinder: {
    title: "Find duplicate files",
    description: "Pick a folder: find identical files and choose which ones to move to the Recycle Bin.",
    chooseFolder: "Choose folder",
    scanning: "Scanning...",
    noneFound: "No duplicate files found in this folder.",
    copies: "{count} copies · {size} each",
    moveSelected: "Move to Recycle Bin ({count} selected)",
    deleting: "...",
    deletedToast: "{count} files moved to Recycle Bin ({freed} freed).",
  },
  ipMask: {
    title: "Mask IP (VPN)",
    description:
      "Hides your IP address by routing traffic through a VPN server. Requires an external VPN service: not integrated yet in this version.",
    button: "Learn more",
    explainerToast:
      "Real IP masking needs a dedicated VPN backend (server + protocol). It isn't connected yet — this is only a preview of the feature.",
  },
  toasts: {
    applied: '"{name}" applied.',
    rolledBack: '"{name}" restored to its original value.',
  },
  menu: {
    account: "Account",
    plan: "Plan",
    planFree: "Free",
    planPro: "Pro",
    upgradeButton: "Upgrade to Pro",
    language: "Language",
    theme: "Themes",
    about: "About",
    aboutBody: "PC Tweaker — system tweaks with automatic backup and rollback.",
    close: "Close",
  },
  auth: {
    login: "Log in",
    register: "Sign up",
    email: "Email",
    password: "Password",
    loginButton: "Log in",
    registerButton: "Create account",
    working: "...",
    logout: "Log out",
    loggedInAs: "Logged in as {email}",
    backendNotConfigured: "No server connected yet: set API_BASE_URL once the backend is deployed.",
    switchToRegister: "No account? Sign up",
    switchToLogin: "Already have an account? Log in",
    emailInvalid: "Enter a valid email address.",
    passwordTooShort: "Password must be at least 8 characters.",
    firstName: "First name",
    lastName: "Last name",
    registerDetailsRequired: "First name, last name and date of birth are required.",
    loginRequiredForCheckout: "Log in or sign up before unlocking Pro.",
    forgotPasswordLink: "Forgot password?",
    forgotPasswordButton: "Send reset link",
    forgotPasswordSent: "If that email is registered, you'll receive a password reset link.",
    backToLogin: "Back to login",
    emailNotVerified: "Email not verified",
    emailVerified: "Email verified",
    resendVerification: "Resend",
    verificationSent: "Verification email sent.",
  },
  tweaks: {
    disable_startup_delay: {
      name: "Remove the startup app delay",
      description:
        "Windows deliberately waits about 10 seconds after sign-in before launching your startup programs. This removes that wait (HKCU, no elevation required).",
    },
    menu_show_delay: {
      name: "Instant menu response",
      description:
        "Removes the built-in delay before menus open, which makes the whole desktop feel noticeably snappier (HKCU, no elevation required).",
    },
    disable_power_throttling: {
      name: "Disable CPU power throttling",
      description:
        "Stops Windows from slowing down background processes to save power - useful on laptops where throttling causes stutter during long sessions (HKLM, requires administrator rights).",
    },
    games_gpu_priority: {
      name: "Raise GPU priority for games",
      description:
        "Tells the multimedia scheduler to give games the highest GPU priority class, so background apps stop competing for the GPU mid-match (HKLM, requires administrator rights).",
    },
    disable_tailored_experiences: {
      name: "Disable tailored experiences",
      description:
        "Stops Windows from using your diagnostic data to personalize ads, tips and recommendations (HKCU, no elevation required).",
    },
    disable_app_launch_tracking: {
      name: "Stop tracking which apps you open",
      description:
        "Windows records how often you launch each program to rank Start menu results. This turns that logging off (HKCU, no elevation required).",
    },
    disable_feedback_requests: {
      name: "Stop Windows feedback prompts",
      description:
        "Prevents Windows from interrupting you with 'How likely are you to recommend...' surveys (HKCU, no elevation required).",
    },
    disable_cortana: {
      name: "Disable Cortana",
      description:
        "Turns Cortana off through system policy, freeing the background resources it reserves (HKLM, requires administrator rights).",
    },
    show_file_extensions: {
      name: "Always show file extensions",
      description:
        "Reveals the real extension of every file. Worth turning on for safety alone: it exposes files like 'invoice.pdf.exe' that Windows otherwise hides (HKCU, no elevation required).",
    },
    hide_taskbar_widgets: {
      name: "Hide Widgets from the taskbar",
      description:
        "Removes the weather/news Widgets button, which loads content in the background even when you never open it (HKCU, no elevation required).",
    },
    disable_transparency: {
      name: "Disable transparency effects",
      description:
        "Turns off the blur/acrylic effects in the taskbar and menus. Small but real GPU saving, and it makes older or integrated-graphics machines feel smoother (HKCU, no elevation required).",
    },
    dark_mode: {
      name: "Dark mode",
      description: "Turns on dark theme for apps and system (HKCU, no elevation required).",
    },
    show_hidden_files: {
      name: "Show hidden files",
      description: "Shows hidden files and folders in File Explorer (HKCU, no elevation required).",
    },
    priority_separation: {
      name: "Optimize CPU priority",
      description: "Tunes Win32PrioritySeparation to favor background services (HKLM, requires administrator rights).",
    },
    disable_game_dvr: {
      name: "Disable Xbox Game Bar / Game DVR",
      description: "Turns off Xbox Game Bar's background recording, which eats CPU/GPU while gaming (HKCU, no elevation required).",
    },
    disable_telemetry_tasks: {
      name: "Reduce diagnostic data collection",
      description: "Sets Windows' diagnostic data level to the minimum allowed (HKLM, requires administrator rights).",
    },
    reset_advertising_id: {
      name: "Disable advertising ID",
      description: "Stops apps from using your advertising ID for profiling (HKCU, no elevation required).",
    },
    disable_location_tracking: {
      name: "Disable location tracking",
      description: "Blocks location access for all apps via system policy (HKLM, requires administrator rights).",
    },
    disable_bing_search: {
      name: "Disable Bing search in the Start menu",
      description: "Stops your Start menu searches from being sent to Bing (HKCU, no elevation required).",
    },
    power_plan_performance: {
      name: "High performance (power plan)",
      description:
        'Switches to the Windows "High performance" power plan. Useful on desktops or when plugged in; restores the previous plan on rollback.',
    },
    turbo_gaming: {
      name: "Turbo Gaming",
      description:
        "Preset: disables Game DVR, switches the power plan to High performance, and optimizes CPU priority (requires administrator rights).",
    },
    privacy_dns: {
      name: "Private DNS (Cloudflare)",
      description:
        "Switches to privacy-focused DNS servers (1.1.1.1), stopping your ISP from logging DNS lookups. Does not hide your IP address (that needs a VPN, see below).",
    },
    hardware_gpu_scheduling: {
      name: "Hardware-accelerated GPU scheduling",
      description:
        "Turns on Windows' Hardware-accelerated GPU scheduling (HAGS), which can reduce input latency in many games (HKLM, requires administrator rights).",
    },
    reduce_input_lag: {
      name: "Reduce input lag (mouse)",
      description:
        'Disables pointer acceleration ("Enhance pointer precision") for 1:1 mouse movement, with no delay added by the system (HKCU, no elevation required).',
    },
    turbo_boost: {
      name: "CPU Turbo Boost",
      description:
        'Sets the processor performance boost mode to "Aggressive", squeezing the most out of Turbo Boost/Turbo Core while gaming (requires administrator rights).',
    },
    network_throttling_index: {
      name: "Disable multimedia network throttling",
      description:
        "Removes the limit Windows places on network traffic while multimedia/gaming apps are active, useful for reducing online micro-lag (HKLM, requires administrator rights).",
    },
    system_responsiveness: {
      name: "Maximize responsiveness for foreground apps",
      description:
        "Zeroes out the CPU share Windows reserves for background tasks, leaving more resources for the app/game in the foreground (HKLM, requires administrator rights).",
    },
    games_task_priority: {
      name: "Maximum priority for games (multimedia scheduler)",
      description:
        "Tells Windows' multimedia scheduler to treat games as the highest-priority processes on the system, ahead of any background task (HKLM, requires administrator rights).",
    },
    reduce_keyboard_delay: {
      name: "Reduce input delay (keyboard)",
      description:
        "Zeroes out the delay before a held key starts repeating and maximizes its repeat rate, for a snappier response in games (HKCU, no elevation required).",
    },
    taskbar_align_left: {
      name: "Align the taskbar to the left",
      description: "Moves taskbar icons back to the left (Windows 10 style) instead of centered (HKCU, no elevation required).",
    },
    hide_taskbar_chat: {
      name: "Hide Chat/Teams from the taskbar",
      description: "Removes the Chat (Microsoft Teams) icon from the taskbar (HKCU, no elevation required).",
    },
    disable_start_suggestions: {
      name: "Disable Start menu suggestions and recommended apps",
      description: "Stops Windows from showing recommended apps, ads, and suggestions in the Start menu (HKCU, no elevation required).",
    },
    disable_activity_history: {
      name: "Disable activity history (Windows Timeline)",
      description:
        "Stops Windows from recording, saving, and sending Microsoft your app and document usage history, via system policy (HKLM, requires administrator rights).",
    },
    hide_taskbar_search: {
      name: "Hide the search box from the taskbar",
      description:
        "Removes the search box/icon from the taskbar for a cleaner bar (search is still available from the Windows key) (HKCU, no elevation required).",
    },
    disable_fullscreen_optimizations_global: {
      name: "Disable fullscreen optimizations globally",
      description:
        "Forces DXGI to honor true exclusive fullscreen instead of Windows' simulated mode, reducing micro-stutter and input lag in many older games (HKCU, no elevation required).",
    },
    disable_windows_search_service: {
      name: "Disable the indexing service (Windows Search)",
      description:
        "Stops and disables Windows' file indexing service, reducing background disk activity — useful on small SSDs or while gaming. Start menu file search becomes slower until you turn it back on (requires administrator rights).",
    },
  },
  cleanup: {
    temp_cleanup: {
      name: "Clean temporary files",
      description: "Moves the contents of %TEMP% to the Recycle Bin: you can recover it any time, it's not a permanent delete.",
    },
    winupdate_cache_cleanup: {
      name: "Clear Windows Update cache",
      description: "Moves already-installed Windows Update packages to the Recycle Bin (requires administrator rights).",
    },
  },
};

const fr: Strings = {
  appName: "PC Tweaker",
  appliedCount: "{applied} sur {total} optimisations actives",
  headerNote:
    "Chaque optimisation sauvegarde la valeur d'origine avant d'être appliquée. Celles qui nécessitent des droits élevés demandent un consentement UAC explicite, uniquement pour cette action.",
  tabs: { scan: "Analyse", performance: "Performances", privacy: "Confidentialité", ui: "Interface", manutenzione: "Entretien", gaming: "Gaming", startup: "Démarrage", pricing: "Offres et tarifs" },
  systemMonitor: {
    cpu: "Processeur",
    ram: "Mémoire",
    disk: "Disque",
    uptime: "Allumé depuis",
    uptimeValue: "{hours} h {minutes} min",
    cores: "{count} cœurs",
  },
  startupManager: {
    title: "Programmes au démarrage",
    description:
      "Les programmes qui s'ouvrent tout seuls au démarrage du PC. En désactiver certains raccourcit le démarrage : le programme reste installé et vous pouvez toujours l'ouvrir manuellement.",
    empty: "Aucun programme configuré pour le démarrage automatique.",
    activeCount: "Actifs : {enabled} / {total}",
    machineWide: "Tous les utilisateurs",
    impactNote: "Désactiver ne désinstalle rien et reste réversible à tout moment.",
  },
  search: {
    placeholder: "Rechercher une optimisation...",
    noResults: "Aucun r\u00e9sultat pour \"{query}\".",
    clear: "Effacer",
  },
  pricing: {
    title: "Choisissez jusqu\u2019o\u00f9 pousser",
    subtitle: "Commencez gratuitement. Passez \u00e0 Pro quand chaque image compte.",
    monthly: "Mensuel",
    annual: "Annuel",
    saveBadge: "\u00c9CONOMISEZ {percent}%",
    perMonth: "/mois",
    perYear: "/an",
    annualDetail: "Soit {monthly} par mois, pr\u00e9lev\u00e9s {yearly} une fois par an",
    annualNudge: "Avec l\u2019offre annuelle, ce serait {price} par mois",
    mostChosen: "LE PLUS CHOISI",
    freeName: "Free",
    freeTagline: "Tout le n\u00e9cessaire pour un PC plus propre et plus r\u00e9actif.",
    freePriceNote: "Gratuit pour toujours, sans expiration",
    freeCta: "Vous \u00eates sur l\u2019offre Free",
    freeCurrent: "Offre actuelle",
    proName: "Pro",
    proTagline: "Pour ceux qui jouent s\u00e9rieusement et ne l\u00e2chent aucune image.",
    proCta: "Passer \u00e0 Pro",
    proCurrent: "Votre offre",
    everythingInFree: "Tout ce que contient Free, plus\u00a0:",
    reassurance: "R\u00e9siliable \u00e0 tout moment. Chaque modification reste annulable en un clic, m\u00eame apr\u00e8s la r\u00e9siliation.",
    freeFeatures: [
      "{count} optimisations r\u00e9elles, chacune sauvegard\u00e9e et r\u00e9versible",
      "Moniteur syst\u00e8me en temps r\u00e9el (processeur, m\u00e9moire, disque)",
      "Gestion des programmes au d\u00e9marrage",
      "V\u00e9rification des fuites de mot de passe",
      "Analyse et correction du PC en un clic",
      "Nettoyage des fichiers temporaires",
    ],
    proFeatures: [
      "Game Sessions\u00a0: le turbo s\u2019active seul au lancement d\u2019un jeu",
      "Pr\u00e9r\u00e9glage Turbo Gaming et priorit\u00e9 maximale aux jeux",
      "Confidentialit\u00e9 avanc\u00e9e\u00a0: t\u00e9l\u00e9m\u00e9trie et historique d\u2019activit\u00e9",
      "Trouve et supprime les fichiers en double",
      "Vide le cache de Windows Update",
      "D\u00e9sactive l\u2019indexation qui occupe le disque",
      "Toutes les optimisations et fonctionnalit\u00e9s \u00e0 venir, incluses",
    ],
  },
  toggle: { on: "Activé", off: "Désactivé" },
  badges: { admin: "Admin", pro: "PRO", soon: "BIENTÔT" },
  emptyCategory: "Aucune optimisation disponible dans cette catégorie pour l'instant — à venir.",
  gameSessions: {
    title: "Game Sessions",
    subtitle: "Détecte automatiquement vos jeux et applique/annule le préréglage Turbo Gaming tout seul.",
    active: "Session active : {name}",
    gamesCount: "{count} jeux enregistrés",
    addGame: "+ Ajouter un jeu (.exe)",
  },
  turboBoost: {
    title: "Turbo Boost",
    subtitle: "Pousse votre processeur au maximum de ses performances pour le jeu, en un clic.",
    startLabel: "START",
    stopLabel: "STOP",
    activating: "Activation du turbo...",
    deactivating: "Restauration...",
    active: "Turbo actif",
    inactive: "Turbo inactif",
  },
  scan: {
    title: "Analyse rapide",
    subtitle: "Vérifie l'état de votre PC et trouve les optimisations pas encore actives, en un clic.",
    startLabel: "SCAN",
    stepPerformance: "Performances",
    stepPrivacy: "Confidentialité",
    stepGaming: "Gaming",
    stepJunk: "Fichiers temporaires",
    allGood: "Tout est en ordre — aucun problème trouvé.",
    issuesFound: "{count} optimisations disponibles",
    selectAll: "Tout sélectionner",
    deselectAll: "Tout désélectionner",
    fixAll: "Tout corriger",
    fixing: "Correction {done}/{total}...",
    fixedToast: "{count} problèmes corrigés.",
    proIssuesTitle: "Aussi disponibles avec Pro",
    unlockPro: "Débloquer Pro",
    scanAgain: "Analyser à nouveau",
    doneTitle: "Terminé !",
    doneBody: "{count} optimisations appliquées. Votre PC est prêt.",
    fixHeading: "Prêtes à appliquer",
  },
  ram: {
    title: "Libérer la RAM",
    subtitle: "Demande à Windows de libérer la mémoire que les programmes occupent sans l'utiliser. À lancer aussi souvent que vous voulez.",
    button: "Libérer maintenant",
    cleaning: "Nettoyage en cours...",
    freed: "{amount} libérés",
    freedNothing: "La mémoire était déjà optimisée",
    inUse: "{used} sur {total} utilises",
    autoLabel: "Nettoyage automatique",
    autoOff: "Désactivé",
    autoEvery: "Toutes les {interval}",
    autoHint: "Avec le nettoyage automatique, PC Tweaker libère la RAM tout seul à intervalle régulier tant que l'application reste ouverte.",
  },
  restore: {
    button: "Tout restaurer",
    title: "Restaurer toutes les modifications ?",
    body: "Les {count} optimisations actives seront désactivées et chaque valeur reviendra exactement à son état initial. Aucune donnée n'est perdue.",
    confirm: "Oui, tout restaurer",
    cancel: "Annuler",
    running: "Restauration...",
    doneToast: "{count} optimisations restaurées.",
    nothingToast: "Il n'y a rien à restaurer.",
  },
  passwordCheck: {
    title: "Vérification des fuites de mot de passe",
    description:
      "Vérifie si un mot de passe est apparu dans une fuite de données connue, sans jamais l'envoyer en entier : seul un fragment de son hash est envoyé (k-anonymat, la norme utilisée par Have I Been Pwned).",
    placeholder: "Collez un mot de passe à vérifier",
    button: "Vérifier",
    checking: "Vérification...",
    safe: "Introuvable dans une fuite connue. Bon signe.",
    breached: "Trouvé dans {count} fuites connues. Changez-le immédiatement, partout où vous l'utilisez.",
    error: "Impossible de vérifier pour le moment : vérifiez votre connexion et réessayez.",
  },
  paywall: {
    title: "Fonction Pro",
    body: '« {feature} » fait partie de PC Tweaker Pro, avec Game Sessions, les préréglages gaming et toutes les fonctionnalités à venir.',
    unlock: "Voir les offres et tarifs",
    notNow: "Pas maintenant",
    notConnectedToast: "Le paiement Pro n'est pas encore connecté dans cette version de développement.",
  },
  cleanupConfirm: {
    title: "Confirmer le nettoyage ?",
    body: '« {name} » déplacera les fichiers correspondants vers la Corbeille de Windows. Vous pourrez les récupérer tant qu\'elle n\'est pas vidée.',
    confirm: "Déplacer vers la Corbeille",
    cancel: "Annuler",
  },
  cleanupButton: "Nettoyer",
  cleanupRunning: "...",
  cleanupResultToast: "{deleted} éléments déplacés vers la Corbeille, {freed} libérés",
  cleanupResultToastSkipped: " ({skipped} en cours d'utilisation, ignorés).",
  diskOptimize: {
    title: "Optimiser le disque",
    description: "Lance l'optimiseur integre de Windows : defragmentation sur un HDD, ou TRIM sur un SSD (jamais une defragmentation complete, qui ne ferait que l'user inutilement).",
    button: "Optimiser maintenant",
    running: "Optimisation en cours... cela peut prendre quelques minutes",
    resultToast: "Disque ({media}) optimise avec succes.",
  },
  dnsFlush: {
    title: "Vider le cache DNS",
    description: "Efface les adresses DNS mises en cache. Utile si un site a change de serveur et que votre navigateur continue d'afficher l'ancienne version.",
    button: "Vider maintenant",
    running: "Vidage...",
    resultToast: "Cache DNS vide.",
  },
  largeFiles: {
    title: "Trouver les gros fichiers",
    description: "Recherche dans un dossier les fichiers les plus volumineux (plus de 100 Mo), pour libérer rapidement de l'espace en supprimant ceux dont vous n'avez plus besoin.",
    chooseFolder: "Choisir un dossier",
    scanning: "Recherche en cours...",
    noneFound: "Aucun fichier de plus de {size} trouve.",
    foundCount: "{count} fichiers trouves",
    moveSelected: "Mettre {count} elements a la corbeille",
    deleting: "Mise a la corbeille...",
    deletedToast: "{count} fichiers mis a la corbeille, {freed} liberes.",
  },
  diskHealth: {
    title: "Sante du disque",
    freeSpace: "{size} libres",
    selectDrive: "Disque",
    healthy: "Bon etat",
    warning: "Avertissement",
    unhealthy: "Mauvais etat",
    unknown: "Inconnu",
    loading: "Verification...",
  },
  duplicateFinder: {
    title: "Trouver les fichiers en double",
    description: "Choisissez un dossier : repère les fichiers identiques et laisse choisir lesquels déplacer vers la Corbeille.",
    chooseFolder: "Choisir un dossier",
    scanning: "Analyse...",
    noneFound: "Aucun fichier en double trouvé dans ce dossier.",
    copies: "{count} copies · {size} chacune",
    moveSelected: "Déplacer vers la Corbeille ({count} sélectionnés)",
    deleting: "...",
    deletedToast: "{count} fichiers déplacés vers la Corbeille ({freed} libérés).",
  },
  ipMask: {
    title: "Masquer l'IP (VPN)",
    description:
      "Masque votre adresse IP en routant le trafic via un serveur VPN. Nécessite un service VPN externe : pas encore intégré dans cette version.",
    button: "En savoir plus",
    explainerToast:
      "Le masquage d'IP réel nécessite un backend VPN dédié (serveur + protocole). Ce n'est pas encore connecté : ceci n'est qu'un aperçu de la fonction.",
  },
  toasts: {
    applied: "« {name} » appliqué.",
    rolledBack: "« {name} » restauré à sa valeur d'origine.",
  },
  menu: {
    account: "Compte",
    plan: "Forfait",
    planFree: "Gratuit",
    planPro: "Pro",
    upgradeButton: "Passer à Pro",
    language: "Langue",
    theme: "Thèmes",
    about: "À propos",
    aboutBody: "PC Tweaker — optimisations système avec sauvegarde et restauration automatiques.",
    close: "Fermer",
  },
  auth: {
    login: "Connexion",
    register: "Inscription",
    email: "E-mail",
    password: "Mot de passe",
    loginButton: "Se connecter",
    registerButton: "Créer un compte",
    working: "...",
    logout: "Se déconnecter",
    loggedInAs: "Connecté en tant que {email}",
    backendNotConfigured: "Aucun serveur connecté pour l'instant : définissez API_BASE_URL une fois le backend déployé.",
    switchToRegister: "Pas de compte ? Inscrivez-vous",
    switchToLogin: "Déjà un compte ? Connectez-vous",
    emailInvalid: "Saisissez une adresse e-mail valide.",
    passwordTooShort: "Le mot de passe doit contenir au moins 8 caractères.",
    firstName: "Prénom",
    lastName: "Nom",
    registerDetailsRequired: "Le prénom, le nom et la date de naissance sont obligatoires.",
    loginRequiredForCheckout: "Connectez-vous ou inscrivez-vous avant de débloquer Pro.",
    forgotPasswordLink: "Mot de passe oublié ?",
    forgotPasswordButton: "Envoyer le lien de réinitialisation",
    forgotPasswordSent: "Si cet e-mail est enregistré, vous recevrez un lien de réinitialisation.",
    backToLogin: "Retour à la connexion",
    emailNotVerified: "E-mail non vérifié",
    emailVerified: "E-mail vérifié",
    resendVerification: "Renvoyer",
    verificationSent: "E-mail de vérification envoyé.",
  },
  tweaks: {
    disable_startup_delay: {
      name: "Supprimer le délai des programmes au démarrage",
      description:
        "Windows attend volontairement environ 10 secondes après la connexion avant de lancer vos programmes de démarrage. Cette option supprime cette attente (HKCU, aucune élévation requise).",
    },
    menu_show_delay: {
      name: "Réponse instantanée des menus",
      description:
        "Supprime le délai d'ouverture des menus, ce qui rend tout le bureau nettement plus réactif (HKCU, aucune élévation requise).",
    },
    disable_power_throttling: {
      name: "Désactiver la limitation d'énergie du processeur",
      description:
        "Empêche Windows de ralentir les processus en arrière-plan pour économiser l'énergie - utile sur les portables, où cela provoque des saccades lors des longues sessions (HKLM, nécessite des droits administrateur).",
    },
    games_gpu_priority: {
      name: "Augmenter la priorité GPU des jeux",
      description:
        "Demande au planificateur multimédia d'accorder aux jeux la classe de priorité GPU la plus élevée, afin que les applications en arrière-plan cessent de disputer le GPU en pleine partie (HKLM, nécessite des droits administrateur).",
    },
    disable_tailored_experiences: {
      name: "Désactiver les expériences personnalisées",
      description:
        "Empêche Windows d'utiliser vos données de diagnostic pour personnaliser publicités, conseils et recommandations (HKCU, aucune élévation requise).",
    },
    disable_app_launch_tracking: {
      name: "Ne plus suivre les applications que vous ouvrez",
      description:
        "Windows enregistre la fréquence de lancement de chaque programme pour classer les résultats du menu Démarrer. Cette option désactive ce suivi (HKCU, aucune élévation requise).",
    },
    disable_feedback_requests: {
      name: "Bloquer les demandes de commentaires de Windows",
      description:
        "Empêche Windows de vous interrompre avec les sondages « Quelle est la probabilité que vous recommandiez... » (HKCU, aucune élévation requise).",
    },
    disable_cortana: {
      name: "Désactiver Cortana",
      description:
        "Désactive Cortana via une stratégie système, libérant les ressources qu'il réserve en arrière-plan (HKLM, nécessite des droits administrateur).",
    },
    show_file_extensions: {
      name: "Toujours afficher les extensions de fichiers",
      description:
        "Révèle la véritable extension de chaque fichier. À activer ne serait-ce que pour la sécurité : cela démasque les fichiers du type « facture.pdf.exe » que Windows masque autrement (HKCU, aucune élévation requise).",
    },
    hide_taskbar_widgets: {
      name: "Masquer les Widgets de la barre des tâches",
      description:
        "Supprime le bouton Widgets (météo/actualités), qui charge du contenu en arrière-plan même si vous ne l'ouvrez jamais (HKCU, aucune élévation requise).",
    },
    disable_transparency: {
      name: "Désactiver les effets de transparence",
      description:
        "Désactive les effets de flou/acrylique de la barre des tâches et des menus. Une économie de GPU modeste mais réelle, qui rend plus fluides les PC anciens ou à carte graphique intégrée (HKCU, aucune élévation requise).",
    },
    dark_mode: {
      name: "Mode sombre",
      description: "Active le thème sombre pour les applications et le système (HKCU, aucune élévation requise).",
    },
    show_hidden_files: {
      name: "Afficher les fichiers cachés",
      description: "Affiche les fichiers et dossiers cachés dans l'Explorateur (HKCU, aucune élévation requise).",
    },
    priority_separation: {
      name: "Optimiser la priorité du processeur",
      description: "Ajuste Win32PrioritySeparation pour favoriser les services en arrière-plan (HKLM, droits administrateur requis).",
    },
    disable_game_dvr: {
      name: "Désactiver Xbox Game Bar / Game DVR",
      description: "Désactive l'enregistrement en arrière-plan de Xbox Game Bar, gourmand en CPU/GPU pendant le jeu (HKCU, aucune élévation requise).",
    },
    disable_telemetry_tasks: {
      name: "Réduire la collecte de données de diagnostic",
      description: "Règle le niveau de diagnostic de Windows au minimum autorisé (HKLM, droits administrateur requis).",
    },
    reset_advertising_id: {
      name: "Désactiver l'ID publicitaire",
      description: "Empêche les applications d'utiliser votre ID publicitaire à des fins de profilage (HKCU, aucune élévation requise).",
    },
    disable_location_tracking: {
      name: "Désactiver le suivi de localisation",
      description: "Bloque l'accès à la localisation pour toutes les applications via une stratégie système (HKLM, droits administrateur requis).",
    },
    disable_bing_search: {
      name: "Désactiver la recherche Bing dans le menu Démarrer",
      description: "Empêche l'envoi de vos recherches du menu Démarrer à Bing (HKCU, aucune élévation requise).",
    },
    power_plan_performance: {
      name: "Performances élevées (mode d'alimentation)",
      description:
        "Passe au mode d'alimentation Windows « Performances élevées ». Utile sur un bureau ou branché sur secteur ; restaure le mode précédent lors de l'annulation.",
    },
    turbo_gaming: {
      name: "Turbo Gaming",
      description:
        "Préréglage : désactive Game DVR, passe le mode d'alimentation en Performances élevées et optimise la priorité du processeur (droits administrateur requis).",
    },
    privacy_dns: {
      name: "DNS privés (Cloudflare)",
      description:
        "Passe à des serveurs DNS axés confidentialité (1.1.1.1), empêchant votre fournisseur d'accès d'enregistrer vos requêtes DNS. Ne masque pas votre adresse IP (pour cela, il faut un VPN, voir ci-dessous).",
    },
    hardware_gpu_scheduling: {
      name: "Planification GPU accélérée par le matériel",
      description:
        "Active la planification GPU accélérée par le matériel (HAGS) de Windows, qui peut réduire la latence d'entrée dans de nombreux jeux (HKLM, droits administrateur requis).",
    },
    reduce_input_lag: {
      name: "Réduire le délai d'entrée (souris)",
      description:
        "Désactive l'accélération du pointeur (« Améliorer la précision du pointeur ») pour un mouvement de souris 1:1, sans délai ajouté par le système (HKCU, aucune élévation requise).",
    },
    turbo_boost: {
      name: "Turbo Boost du processeur",
      description:
        "Règle le mode d'augmentation des performances du processeur sur « Agressif », pour tirer le maximum du Turbo Boost/Turbo Core pendant le jeu (droits administrateur requis).",
    },
    network_throttling_index: {
      name: "Désactiver la limitation réseau multimédia",
      description:
        "Supprime la limite imposée par Windows au trafic réseau pendant l'utilisation d'apps multimédias/jeux, utile pour réduire les micro-latences en ligne (HKLM, droits administrateur requis).",
    },
    system_responsiveness: {
      name: "Maximiser la réactivité pour l'app au premier plan",
      description:
        "Ramène à zéro la part de CPU réservée par Windows aux tâches en arrière-plan, laissant plus de ressources à l'app/jeu au premier plan (HKLM, droits administrateur requis).",
    },
    games_task_priority: {
      name: "Priorité maximale aux jeux (planificateur multimédia)",
      description:
        "Indique au planificateur multimédia de Windows de traiter les jeux comme les processus les plus prioritaires du système, devant toute tâche en arrière-plan (HKLM, droits administrateur requis).",
    },
    reduce_keyboard_delay: {
      name: "Réduire le délai d'entrée (clavier)",
      description:
        "Ramène à zéro le délai avant qu'une touche maintenue commence à se répéter et maximise sa vitesse de répétition, pour une réponse plus immédiate en jeu (HKCU, aucune élévation requise).",
    },
    taskbar_align_left: {
      name: "Aligner la barre des tâches à gauche",
      description: "Replace les icônes de la barre des tâches à gauche (style Windows 10) au lieu du centre (HKCU, aucune élévation requise).",
    },
    hide_taskbar_chat: {
      name: "Masquer Chat/Teams de la barre des tâches",
      description: "Retire l'icône Chat (Microsoft Teams) de la barre des tâches (HKCU, aucune élévation requise).",
    },
    disable_start_suggestions: {
      name: "Désactiver les suggestions et apps recommandées du menu Démarrer",
      description: "Empêche Windows d'afficher des apps recommandées, publicités et suggestions dans le menu Démarrer (HKCU, aucune élévation requise).",
    },
    disable_activity_history: {
      name: "Désactiver l'historique d'activité (Windows Timeline)",
      description:
        "Empêche Windows d'enregistrer, de sauvegarder et d'envoyer à Microsoft l'historique de vos apps et documents utilisés, via une stratégie système (HKLM, droits administrateur requis).",
    },
    hide_taskbar_search: {
      name: "Masquer la barre de recherche de la barre des tâches",
      description:
        "Retire la case/icône de recherche de la barre des tâches pour une barre plus épurée (la recherche reste accessible via la touche Windows) (HKCU, aucune élévation requise).",
    },
    disable_fullscreen_optimizations_global: {
      name: "Désactiver les optimisations plein écran globalement",
      description:
        "Force DXGI à respecter le vrai mode plein écran exclusif au lieu de la simulation de Windows, réduisant les micro-saccades et l'input lag dans de nombreux jeux plus anciens (HKCU, aucune élévation requise).",
    },
    disable_windows_search_service: {
      name: "Désactiver le service d'indexation (Windows Search)",
      description:
        "Arrête et désactive le service d'indexation des fichiers de Windows, réduisant l'activité disque en arrière-plan — utile sur les petits SSD ou pendant le jeu. La recherche de fichiers dans le menu Démarrer devient plus lente jusqu'à sa réactivation (droits administrateur requis).",
    },
  },
  cleanup: {
    temp_cleanup: {
      name: "Nettoyer les fichiers temporaires",
      description: "Déplace le contenu de %TEMP% vers la Corbeille : récupérable à tout moment, ce n'est pas une suppression définitive.",
    },
    winupdate_cache_cleanup: {
      name: "Vider le cache de Windows Update",
      description: "Déplace vers la Corbeille les paquets Windows Update déjà installés (droits administrateur requis).",
    },
  },
};

const es: Strings = {
  appName: "PC Tweaker",
  appliedCount: "{applied} de {total} ajustes activos",
  headerNote:
    "Cada ajuste guarda una copia del valor original antes de aplicarse. Los ajustes que requieren privilegios elevados piden un consentimiento UAC explícito, solo para esa acción.",
  tabs: { scan: "Análisis", performance: "Rendimiento", privacy: "Privacidad", ui: "Interfaz", manutenzione: "Mantenimiento", gaming: "Gaming", startup: "Inicio", pricing: "Planes y precios" },
  systemMonitor: {
    cpu: "CPU",
    ram: "Memoria",
    disk: "Disco",
    uptime: "Encendido desde hace",
    uptimeValue: "{hours} h {minutes} min",
    cores: "{count} núcleos",
  },
  startupManager: {
    title: "Programas de inicio",
    description:
      "Los programas que se abren solos al encender el PC. Desactivar algunos acorta el tiempo de arranque: el programa sigue instalado y puedes abrirlo a mano igualmente.",
    empty: "Ningún programa configurado para iniciarse automáticamente.",
    activeCount: "Activos: {enabled} / {total}",
    machineWide: "Todos los usuarios",
    impactNote: "Desactivar no desinstala nada y es reversible en cualquier momento.",
  },
  search: {
    placeholder: "Buscar un ajuste...",
    noResults: "Sin resultados para \"{query}\".",
    clear: "Borrar",
  },
  pricing: {
    title: "Elige cu\u00e1nto quieres exprimirlo",
    subtitle: "Empieza gratis. Pasa a Pro cuando quieras hasta el \u00faltimo fotograma.",
    monthly: "Mensual",
    annual: "Anual",
    saveBadge: "AHORRAS UN {percent}%",
    perMonth: "/mes",
    perYear: "/a\u00f1o",
    annualDetail: "Son {monthly} al mes, con un cargo de {yearly} una vez al a\u00f1o",
    annualNudge: "Con el plan anual ser\u00edan {price} al mes",
    mostChosen: "EL M\u00c1S ELEGIDO",
    freeName: "Free",
    freeTagline: "Todo lo necesario para un PC m\u00e1s limpio y \u00e1gil.",
    freePriceNote: "Gratis para siempre, sin caducidad",
    freeCta: "Est\u00e1s en el plan Free",
    freeCurrent: "Plan actual",
    proName: "Pro",
    proTagline: "Para quien juega en serio y no pierde ni un fotograma.",
    proCta: "Pasar a Pro",
    proCurrent: "Tu plan",
    everythingInFree: "Todo lo que incluye Free, y adem\u00e1s:",
    reassurance: "Cancela cuando quieras. Cada cambio sigue siendo reversible con un clic, incluso tras cancelar.",
    freeFeatures: [
      "{count} ajustes reales, cada uno con copia de seguridad y reversible",
      "Monitor del sistema en tiempo real (CPU, memoria, disco)",
      "Gesti\u00f3n de los programas de inicio",
      "Comprobaci\u00f3n de filtraciones de contrase\u00f1as",
      "An\u00e1lisis del PC y correcci\u00f3n en un clic",
      "Limpieza de archivos temporales",
    ],
    proFeatures: [
      "Game Sessions: el turbo se activa solo al abrir un juego",
      "Preset Turbo Gaming y prioridad m\u00e1xima para los juegos",
      "Privacidad avanzada: telemetr\u00eda e historial de actividad",
      "Encuentra y elimina archivos duplicados",
      "Vac\u00eda la cach\u00e9 de Windows Update",
      "Desactiva la indexaci\u00f3n que mantiene ocupado el disco",
      "Todos los ajustes y funciones futuras, incluidos",
    ],
  },
  toggle: { on: "Activado", off: "Desactivado" },
  badges: { admin: "Admin", pro: "PRO", soon: "PRÓXIMAMENTE" },
  emptyCategory: "Todavía no hay ajustes disponibles en esta categoría — próximamente.",
  gameSessions: {
    title: "Game Sessions",
    subtitle: "Detecta automáticamente tus juegos y aplica/revierte el preset Turbo Gaming por sí solo.",
    active: "Sesión activa: {name}",
    gamesCount: "{count} juegos registrados",
    addGame: "+ Añadir juego (.exe)",
  },
  turboBoost: {
    title: "Turbo Boost",
    subtitle: "Lleva tu procesador al máximo rendimiento para gaming, con un toque.",
    startLabel: "START",
    stopLabel: "STOP",
    activating: "Activando turbo...",
    deactivating: "Restaurando...",
    active: "Turbo activo",
    inactive: "Turbo no activo",
  },
  scan: {
    title: "Análisis rápido",
    subtitle: "Comprueba el estado de tu PC y encuentra optimizaciones que aún no están activas, en un clic.",
    startLabel: "SCAN",
    stepPerformance: "Rendimiento",
    stepPrivacy: "Privacidad",
    stepGaming: "Gaming",
    stepJunk: "Archivos temporales",
    allGood: "Todo bien — no se encontraron problemas.",
    issuesFound: "{count} optimizaciones disponibles",
    selectAll: "Seleccionar todo",
    deselectAll: "Deseleccionar todo",
    fixAll: "Corregir todo",
    fixing: "Corrigiendo {done}/{total}...",
    fixedToast: "{count} problemas corregidos.",
    proIssuesTitle: "También disponibles con Pro",
    unlockPro: "Desbloquear Pro",
    scanAgain: "Analizar de nuevo",
    doneTitle: "\u00a1Listo!",
    doneBody: "{count} optimizaciones aplicadas. Tu PC está a punto.",
    fixHeading: "Listas para aplicar",
  },
  ram: {
    title: "Liberar RAM",
    subtitle: "Pide a Windows que libere la memoria que los programas ocupan sin usarla. Puedes hacerlo tantas veces como quieras.",
    button: "Liberar ahora",
    cleaning: "Limpiando...",
    freed: "{amount} liberados",
    freedNothing: "La memoria ya estaba optimizada",
    inUse: "{used} de {total} en uso",
    autoLabel: "Limpieza automática",
    autoOff: "Desactivada",
    autoEvery: "Cada {interval}",
    autoHint: "Con la limpieza automática activada, PC Tweaker libera la RAM por sí solo a intervalos regulares mientras la app siga abierta.",
  },
  restore: {
    button: "Restaurar todo",
    title: "\u00bfRestaurar todos los cambios?",
    body: "Se desactivarán las {count} optimizaciones activas y cada valor volverá exactamente a como estaba. No se pierde nada.",
    confirm: "S\u00ed, restaurar todo",
    cancel: "Cancelar",
    running: "Restaurando...",
    doneToast: "{count} optimizaciones restauradas.",
    nothingToast: "No hay nada que restaurar.",
  },
  passwordCheck: {
    title: "Comprobación de filtraciones de contraseña",
    description:
      "Comprueba si una contraseña ha aparecido en una filtración de datos conocida, sin enviarla nunca por completo: solo se envía un fragmento de su hash (k-anonimato, el mismo estándar que usa Have I Been Pwned).",
    placeholder: "Pega una contraseña para comprobar",
    button: "Comprobar",
    checking: "Comprobando...",
    safe: "No encontrada en ninguna filtración conocida. Buena señal.",
    breached: "Encontrada en {count} filtraciones conocidas. Cámbiala ya, en todos los sitios donde la uses.",
    error: "No se ha podido comprobar ahora: revisa tu conexión e inténtalo de nuevo.",
  },
  paywall: {
    title: "Función Pro",
    body: '"{feature}" forma parte de PC Tweaker Pro, junto a Game Sessions, los presets de gaming y todas las funciones futuras.',
    unlock: "Ver planes y precios",
    notNow: "Ahora no",
    notConnectedToast: "El pago Pro todavía no está conectado en esta versión de desarrollo.",
  },
  cleanupConfirm: {
    title: "¿Confirmas la limpieza?",
    body: '"{name}" moverá los archivos correspondientes a la Papelera de reciclaje de Windows. Podrás recuperarlos desde ahí hasta que la vacíes.',
    confirm: "Mover a la Papelera",
    cancel: "Cancelar",
  },
  cleanupButton: "Limpiar",
  cleanupRunning: "...",
  cleanupResultToast: "{deleted} elementos movidos a la Papelera, {freed} liberados",
  cleanupResultToastSkipped: " ({skipped} en uso, omitidos).",
  diskOptimize: {
    title: "Optimizar disco",
    description: "Ejecuta el optimizador integrado de Windows: desfragmentacion en un HDD, o TRIM en un SSD (nunca una desfragmentacion completa, que solo lo desgastaria sin beneficio).",
    button: "Optimizar ahora",
    running: "Optimizando... puede tardar unos minutos",
    resultToast: "Disco ({media}) optimizado correctamente.",
  },
  dnsFlush: {
    title: "Vaciar cache DNS",
    description: "Borra las direcciones DNS guardadas en memoria. Util si un sitio cambio de servidor y tu navegador sigue mostrando la version antigua.",
    button: "Vaciar ahora",
    running: "Vaciando...",
    resultToast: "Cache DNS vaciada.",
  },
  largeFiles: {
    title: "Buscar archivos grandes",
    description: "Busca en una carpeta los archivos mas pesados (mas de 100 MB), para que puedas liberar espacio rapidamente eliminando los que ya no necesitas.",
    chooseFolder: "Elegir carpeta",
    scanning: "Buscando...",
    noneFound: "No se encontraron archivos de mas de {size}.",
    foundCount: "{count} archivos encontrados",
    moveSelected: "Enviar {count} seleccionados a la papelera",
    deleting: "Enviando a la papelera...",
    deletedToast: "{count} archivos enviados, {freed} liberados.",
  },
  diskHealth: {
    title: "Salud del disco",
    freeSpace: "{size} libres",
    selectDrive: "Disco",
    healthy: "Correcto",
    warning: "Advertencia",
    unhealthy: "Danado",
    unknown: "Desconocido",
    loading: "Comprobando...",
  },
  duplicateFinder: {
    title: "Buscar archivos duplicados",
    description: "Elige una carpeta: encuentra archivos idénticos y te deja elegir cuáles mover a la Papelera.",
    chooseFolder: "Elegir carpeta",
    scanning: "Escaneando...",
    noneFound: "No se encontraron archivos duplicados en esta carpeta.",
    copies: "{count} copias · {size} cada una",
    moveSelected: "Mover a la Papelera ({count} seleccionados)",
    deleting: "...",
    deletedToast: "{count} archivos movidos a la Papelera ({freed} liberados).",
  },
  ipMask: {
    title: "Enmascarar IP (VPN)",
    description:
      "Oculta tu dirección IP enrutando el tráfico a través de un servidor VPN. Requiere un servicio VPN externo: aún no integrado en esta versión.",
    button: "Más información",
    explainerToast:
      "El enmascaramiento real de IP necesita un backend VPN dedicado (servidor + protocolo). Todavía no está conectado: esto es solo un adelanto de la función.",
  },
  toasts: {
    applied: '"{name}" aplicado.',
    rolledBack: '"{name}" restaurado a su valor original.',
  },
  menu: {
    account: "Cuenta",
    plan: "Plan",
    planFree: "Gratis",
    planPro: "Pro",
    upgradeButton: "Pasar a Pro",
    language: "Idioma",
    theme: "Temas",
    about: "Acerca de",
    aboutBody: "PC Tweaker — ajustes del sistema con copia de seguridad y restauración automáticas.",
    close: "Cerrar",
  },
  auth: {
    login: "Iniciar sesión",
    register: "Registrarse",
    email: "Correo electrónico",
    password: "Contraseña",
    loginButton: "Iniciar sesión",
    registerButton: "Crear cuenta",
    working: "...",
    logout: "Cerrar sesión",
    loggedInAs: "Sesión iniciada como {email}",
    backendNotConfigured: "Todavía no hay servidor conectado: configura API_BASE_URL cuando despliegues el backend.",
    switchToRegister: "¿No tienes cuenta? Regístrate",
    switchToLogin: "¿Ya tienes cuenta? Inicia sesión",
    emailInvalid: "Introduce un correo electrónico válido.",
    passwordTooShort: "La contraseña debe tener al menos 8 caracteres.",
    firstName: "Nombre",
    lastName: "Apellido",
    registerDetailsRequired: "Nombre, apellido y fecha de nacimiento son obligatorios.",
    loginRequiredForCheckout: "Inicia sesión o regístrate antes de desbloquear Pro.",
    forgotPasswordLink: "¿Olvidaste la contraseña?",
    forgotPasswordButton: "Enviar enlace de restablecimiento",
    forgotPasswordSent: "Si ese correo está registrado, recibirás un enlace para restablecer la contraseña.",
    backToLogin: "Volver al inicio de sesión",
    emailNotVerified: "Correo no verificado",
    emailVerified: "Correo verificado",
    resendVerification: "Reenviar",
    verificationSent: "Correo de verificación enviado.",
  },
  tweaks: {
    disable_startup_delay: {
      name: "Eliminar el retraso de los programas al inicio",
      description:
        "Windows espera a propósito unos 10 segundos tras iniciar sesión antes de abrir tus programas de inicio. Esta opción elimina esa espera (HKCU, no requiere elevación).",
    },
    menu_show_delay: {
      name: "Respuesta instantánea de los menús",
      description:
        "Elimina el retraso con el que se abren los menús, lo que hace que todo el escritorio se sienta más ágil (HKCU, no requiere elevación).",
    },
    disable_power_throttling: {
      name: "Desactivar la limitación de energía de la CPU",
      description:
        "Impide que Windows ralentice los procesos en segundo plano para ahorrar energía: útil en portátiles, donde provoca tirones en sesiones largas (HKLM, requiere permisos de administrador).",
    },
    games_gpu_priority: {
      name: "Aumentar la prioridad de GPU para juegos",
      description:
        "Indica al programador multimedia que dé a los juegos la clase de prioridad de GPU más alta, para que las apps en segundo plano dejen de competir por la GPU en plena partida (HKLM, requiere permisos de administrador).",
    },
    disable_tailored_experiences: {
      name: "Desactivar las experiencias personalizadas",
      description:
        "Impide que Windows use tus datos de diagnóstico para personalizar anuncios, sugerencias y recomendaciones (HKCU, no requiere elevación).",
    },
    disable_app_launch_tracking: {
      name: "Dejar de registrar qué aplicaciones abres",
      description:
        "Windows registra con qué frecuencia abres cada programa para ordenar los resultados del menú Inicio. Esta opción desactiva ese registro (HKCU, no requiere elevación).",
    },
    disable_feedback_requests: {
      name: "Bloquear las peticiones de opinión de Windows",
      description:
        "Evita que Windows te interrumpa con encuestas del tipo «¿Qué probabilidad hay de que recomiendes...?» (HKCU, no requiere elevación).",
    },
    disable_cortana: {
      name: "Desactivar Cortana",
      description:
        "Desactiva Cortana mediante directiva del sistema, liberando los recursos que reserva en segundo plano (HKLM, requiere permisos de administrador).",
    },
    show_file_extensions: {
      name: "Mostrar siempre las extensiones de archivo",
      description:
        "Revela la extensión real de cada archivo. Merece la pena activarlo solo por seguridad: destapa archivos como «factura.pdf.exe» que Windows oculta (HKCU, no requiere elevación).",
    },
    hide_taskbar_widgets: {
      name: "Ocultar los Widgets de la barra de tareas",
      description:
        "Quita el botón de Widgets (tiempo/noticias), que carga contenido en segundo plano aunque nunca lo abras (HKCU, no requiere elevación).",
    },
    disable_transparency: {
      name: "Desactivar los efectos de transparencia",
      description:
        "Desactiva los efectos de desenfoque/acrílico de la barra de tareas y los menús. Un ahorro de GPU pequeño pero real, que hace más fluidos los equipos antiguos o con gráficos integrados (HKCU, no requiere elevación).",
    },
    dark_mode: {
      name: "Modo oscuro",
      description: "Activa el tema oscuro para apps y sistema (HKCU, sin elevación requerida).",
    },
    show_hidden_files: {
      name: "Mostrar archivos ocultos",
      description: "Muestra archivos y carpetas ocultos en el Explorador de archivos (HKCU, sin elevación requerida).",
    },
    priority_separation: {
      name: "Optimizar prioridad del procesador",
      description: "Ajusta Win32PrioritySeparation para favorecer los servicios en segundo plano (HKLM, requiere privilegios de administrador).",
    },
    disable_game_dvr: {
      name: "Desactivar Xbox Game Bar / Game DVR",
      description: "Desactiva la grabación en segundo plano de Xbox Game Bar, que consume CPU/GPU durante el juego (HKCU, sin elevación requerida).",
    },
    disable_telemetry_tasks: {
      name: "Reducir la recopilación de datos de diagnóstico",
      description: "Establece el nivel de diagnóstico de Windows al mínimo permitido (HKLM, requiere privilegios de administrador).",
    },
    reset_advertising_id: {
      name: "Desactivar ID de publicidad",
      description: "Impide que las apps usen tu ID de publicidad para elaborar perfiles (HKCU, sin elevación requerida).",
    },
    disable_location_tracking: {
      name: "Desactivar seguimiento de ubicación",
      description: "Bloquea el acceso a la ubicación para todas las apps mediante directiva del sistema (HKLM, requiere privilegios de administrador).",
    },
    disable_bing_search: {
      name: "Desactivar la búsqueda de Bing en el menú Inicio",
      description: "Impide que tus búsquedas del menú Inicio se envíen a Bing (HKCU, sin elevación requerida).",
    },
    power_plan_performance: {
      name: "Alto rendimiento (plan de energía)",
      description:
        'Cambia al plan de energía de Windows "Alto rendimiento". Útil en equipos de escritorio o conectados a la corriente; restaura el plan anterior al revertir.',
    },
    turbo_gaming: {
      name: "Turbo Gaming",
      description:
        "Preajuste: desactiva Game DVR, cambia el plan de energía a Alto rendimiento y optimiza la prioridad del procesador (requiere privilegios de administrador).",
    },
    privacy_dns: {
      name: "DNS privados (Cloudflare)",
      description:
        "Cambia a servidores DNS centrados en la privacidad (1.1.1.1), impidiendo que tu proveedor registre las consultas DNS. No oculta tu dirección IP (para eso hace falta una VPN, ver abajo).",
    },
    hardware_gpu_scheduling: {
      name: "Programación de GPU acelerada por hardware",
      description:
        "Activa la Programación de GPU acelerada por hardware (HAGS) de Windows, que puede reducir la latencia de entrada en muchos juegos (HKLM, requiere privilegios de administrador).",
    },
    reduce_input_lag: {
      name: "Reducir el retardo de entrada (ratón)",
      description:
        'Desactiva la aceleración del puntero ("Mejorar precisión del puntero") para un movimiento del ratón 1:1, sin retardo añadido por el sistema (HKCU, sin elevación requerida).',
    },
    turbo_boost: {
      name: "Turbo Boost del procesador",
      description:
        'Establece el modo de aumento de rendimiento del procesador en "Agresivo", para aprovechar al máximo el Turbo Boost/Turbo Core durante el juego (requiere privilegios de administrador).',
    },
    network_throttling_index: {
      name: "Desactivar la limitación de red multimedia",
      description:
        "Elimina el límite que Windows impone al tráfico de red mientras usas apps multimedia/juegos, útil para reducir microlags online (HKLM, requiere privilegios de administrador).",
    },
    system_responsiveness: {
      name: "Maximizar la capacidad de respuesta para apps en primer plano",
      description:
        "Reduce a cero la cuota de CPU que Windows reserva para tareas en segundo plano, dejando más recursos a la app/juego en primer plano (HKLM, requiere privilegios de administrador).",
    },
    games_task_priority: {
      name: "Prioridad máxima para juegos (planificador multimedia)",
      description:
        "Indica al planificador multimedia de Windows que trate los juegos como los procesos de mayor prioridad del sistema, por delante de cualquier tarea en segundo plano (HKLM, requiere privilegios de administrador).",
    },
    reduce_keyboard_delay: {
      name: "Reducir el retardo de entrada (teclado)",
      description:
        "Reduce a cero el retardo antes de que una tecla mantenida empiece a repetirse y maximiza su velocidad de repetición, para una respuesta más inmediata en el juego (HKCU, no requiere elevación).",
    },
    taskbar_align_left: {
      name: "Alinear la barra de tareas a la izquierda",
      description: "Vuelve a alinear los iconos de la barra de tareas a la izquierda (estilo Windows 10) en vez de al centro (HKCU, no requiere elevación).",
    },
    hide_taskbar_chat: {
      name: "Ocultar Chat/Teams de la barra de tareas",
      description: "Elimina el icono de Chat (Microsoft Teams) de la barra de tareas (HKCU, no requiere elevación).",
    },
    disable_start_suggestions: {
      name: "Desactivar sugerencias y apps recomendadas en el menú Inicio",
      description: "Evita que Windows muestre apps recomendadas, anuncios y sugerencias en el menú Inicio (HKCU, no requiere elevación).",
    },
    disable_activity_history: {
      name: "Desactivar el historial de actividad (Windows Timeline)",
      description:
        "Evita que Windows registre, guarde y envíe a Microsoft el historial de tus apps y documentos usados, mediante una política del sistema (HKLM, requiere privilegios de administrador).",
    },
    hide_taskbar_search: {
      name: "Ocultar el cuadro de búsqueda de la barra de tareas",
      description:
        "Elimina el cuadro/icono de búsqueda de la barra de tareas, para una barra más limpia (la búsqueda sigue disponible desde la tecla Windows) (HKCU, no requiere elevación).",
    },
    disable_fullscreen_optimizations_global: {
      name: "Desactivar las optimizaciones de pantalla completa globalmente",
      description:
        "Obliga a DXGI a respetar el verdadero modo de pantalla completa exclusiva en lugar de la simulación de Windows, reduciendo microcortes y latencia de entrada en muchos juegos más antiguos (HKCU, no requiere elevación).",
    },
    disable_windows_search_service: {
      name: "Desactivar el servicio de indexación (Windows Search)",
      description:
        "Detiene y desactiva el servicio de indexación de archivos de Windows, reduciendo la actividad de disco en segundo plano — útil en SSD pequeños o mientras juegas. La búsqueda de archivos en el menú Inicio se vuelve más lenta hasta que lo reactives (requiere privilegios de administrador).",
    },
  },
  cleanup: {
    temp_cleanup: {
      name: "Limpiar archivos temporales",
      description: "Mueve el contenido de %TEMP% a la Papelera: puedes recuperarlo en cualquier momento, no es un borrado definitivo.",
    },
    winupdate_cache_cleanup: {
      name: "Vaciar la caché de Windows Update",
      description: "Mueve a la Papelera los paquetes de Windows Update ya instalados (requiere privilegios de administrador).",
    },
  },
};

const de: Strings = {
  appName: "PC Tweaker",
  appliedCount: "{applied} von {total} Optimierungen aktiv",
  headerNote:
    "Jede Optimierung sichert den ursprünglichen Wert, bevor sie angewendet wird. Optimierungen mit erhöhten Rechten fragen gezielt per UAC nach, nur für diese Aktion.",
  tabs: { scan: "Systemscan", performance: "Leistung", privacy: "Datenschutz", ui: "Oberfläche", manutenzione: "Wartung", gaming: "Gaming", startup: "Autostart", pricing: "Tarife & Preise" },
  systemMonitor: {
    cpu: "CPU",
    ram: "Arbeitsspeicher",
    disk: "Datenträger",
    uptime: "Läuft seit",
    uptimeValue: "{hours} Std. {minutes} Min.",
    cores: "{count} Kerne",
  },
  startupManager: {
    title: "Autostart-Programme",
    description:
      "Programme, die sich beim Hochfahren des PCs von selbst öffnen. Einige zu deaktivieren verkürzt den Systemstart: Das Programm bleibt installiert und lässt sich weiterhin manuell öffnen.",
    empty: "Keine Programme für den automatischen Start eingerichtet.",
    activeCount: "Aktiv: {enabled} / {total}",
    machineWide: "Alle Benutzer",
    impactNote: "Deaktivieren deinstalliert nichts und ist jederzeit umkehrbar.",
  },
  search: {
    placeholder: "Tweak suchen...",
    noResults: "Keine Treffer f\u00fcr \"{query}\".",
    clear: "L\u00f6schen",
  },
  pricing: {
    title: "Entscheide, wie weit du gehst",
    subtitle: "Starte kostenlos. Wechsle zu Pro, wenn jedes Frame z\u00e4hlt.",
    monthly: "Monatlich",
    annual: "J\u00e4hrlich",
    saveBadge: "{percent}% SPAREN",
    perMonth: "/Monat",
    perYear: "/Jahr",
    annualDetail: "Das sind {monthly} pro Monat, einmal j\u00e4hrlich mit {yearly} abgebucht",
    annualNudge: "Im Jahrestarif w\u00e4ren es {price} pro Monat",
    mostChosen: "AM H\u00c4UFIGSTEN GEW\u00c4HLT",
    freeName: "Free",
    freeTagline: "Alles f\u00fcr einen saubereren, flotteren PC.",
    freePriceNote: "F\u00fcr immer kostenlos, ohne Ablauf",
    freeCta: "Du nutzt den Free-Tarif",
    freeCurrent: "Aktueller Tarif",
    proName: "Pro",
    proTagline: "F\u00fcr alle, die ernsthaft spielen und kein Frame verlieren wollen.",
    proCta: "Zu Pro wechseln",
    proCurrent: "Dein Tarif",
    everythingInFree: "Alles aus Free, dazu:",
    reassurance: "Jederzeit k\u00fcndbar. Jede \u00c4nderung bleibt mit einem Klick r\u00fcckg\u00e4ngig zu machen, auch nach der K\u00fcndigung.",
    freeFeatures: [
      "{count} echte Tweaks, jeder gesichert und umkehrbar",
      "Live-Systemmonitor (CPU, Arbeitsspeicher, Datentr\u00e4ger)",
      "Verwaltung der Autostart-Programme",
      "Passwort-Datenleck-Pr\u00fcfung",
      "PC-Scan und Behebung mit einem Klick",
      "Bereinigung tempor\u00e4rer Dateien",
    ],
    proFeatures: [
      "Game Sessions: Turbo aktiviert sich beim Spielstart von selbst",
      "Turbo-Gaming-Preset und h\u00f6chste Priorit\u00e4t f\u00fcr Spiele",
      "Erweiterter Datenschutz: Telemetrie und Aktivit\u00e4tsverlauf",
      "Findet und entfernt doppelte Dateien",
      "Leert den Windows-Update-Cache",
      "Deaktiviert die Indizierung, die den Datentr\u00e4ger belastet",
      "Jeder Tweak und jede k\u00fcnftige Funktion inklusive",
    ],
  },
  toggle: { on: "Ein", off: "Aus" },
  badges: { admin: "Admin", pro: "PRO", soon: "DEMNÄCHST" },
  emptyCategory: "In dieser Kategorie sind noch keine Optimierungen verfügbar — bald verfügbar.",
  gameSessions: {
    title: "Game Sessions",
    subtitle: "Erkennt deine Spiele automatisch und wendet das Turbo-Gaming-Preset selbstständig an/rückgängig.",
    active: "Sitzung aktiv: {name}",
    gamesCount: "{count} Spiele registriert",
    addGame: "+ Spiel hinzufügen (.exe)",
  },
  turboBoost: {
    title: "Turbo Boost",
    subtitle: "Bringt deinen Prozessor mit einem Tipp auf Spitzenleistung fürs Gaming.",
    startLabel: "START",
    stopLabel: "STOP",
    activating: "Turbo wird aktiviert...",
    deactivating: "Wird wiederhergestellt...",
    active: "Turbo aktiv",
    inactive: "Turbo nicht aktiv",
  },
  scan: {
    title: "Schnellscan",
    subtitle: "Prüft den Zustand deines PCs und findet noch nicht aktive Optimierungen, mit einem Klick.",
    startLabel: "SCAN",
    stepPerformance: "Leistung",
    stepPrivacy: "Datenschutz",
    stepGaming: "Gaming",
    stepJunk: "Temporäre Dateien",
    allGood: "Alles in Ordnung — keine Probleme gefunden.",
    issuesFound: "{count} Optimierungen verfügbar",
    selectAll: "Alles auswählen",
    deselectAll: "Alles abwählen",
    fixAll: "Alles beheben",
    fixing: "Behebe {done}/{total}...",
    fixedToast: "{count} Probleme behoben.",
    proIssuesTitle: "Auch mit Pro verfügbar",
    unlockPro: "Pro freischalten",
    scanAgain: "Erneut scannen",
    doneTitle: "Fertig!",
    doneBody: "{count} Optimierungen angewendet. Dein PC ist bereit.",
    fixHeading: "Bereit zum Anwenden",
  },
  ram: {
    title: "RAM freigeben",
    subtitle: "Fordert Windows auf, Speicher freizugeben, den Programme belegen, aber nicht nutzen. So oft ausführbar, wie du willst.",
    button: "Jetzt freigeben",
    cleaning: "Wird bereinigt...",
    freed: "{amount} freigegeben",
    freedNothing: "Der Speicher war bereits optimiert",
    inUse: "{used} von {total} belegt",
    autoLabel: "Automatische Bereinigung",
    autoOff: "Aus",
    autoEvery: "Alle {interval}",
    autoHint: "Bei aktiver automatischer Bereinigung gibt PC Tweaker den RAM selbstständig in regelmäßigen Abständen frei, solange die App geöffnet bleibt.",
  },
  restore: {
    button: "Alles zur\u00fccksetzen",
    title: "Alle \u00c4nderungen zur\u00fccksetzen?",
    body: "Die {count} aktiven Optimierungen werden deaktiviert und jeder Wert exakt so wiederhergestellt, wie er vorher war. Es gehen keine Daten verloren.",
    confirm: "Ja, alles zur\u00fccksetzen",
    cancel: "Abbrechen",
    running: "Wird zur\u00fcckgesetzt...",
    doneToast: "{count} Optimierungen zur\u00fcckgesetzt.",
    nothingToast: "Es gibt nichts zur\u00fcckzusetzen.",
  },
  passwordCheck: {
    title: "Passwort-Datenleck-Prüfung",
    description:
      "Prüft, ob ein Passwort in einem bekannten Datenleck aufgetaucht ist, ohne es je vollständig zu senden: Es wird nur ein Fragment seines Hashes gesendet (k-Anonymität, derselbe Standard wie bei Have I Been Pwned).",
    placeholder: "Ein zu prüfendes Passwort einfügen",
    button: "Prüfen",
    checking: "Wird geprüft...",
    safe: "In keinem bekannten Datenleck gefunden. Gutes Zeichen.",
    breached: "In {count} bekannten Datenlecks gefunden. Ändere es sofort, überall wo du es verwendest.",
    error: "Konnte gerade nicht geprüft werden: Verbindung prüfen und erneut versuchen.",
  },
  paywall: {
    title: "Pro-Funktion",
    body: '„{feature}" ist Teil von PC Tweaker Pro — zusammen mit Game Sessions, den Gaming-Presets und jeder künftigen Funktion.',
    unlock: "Tarife & Preise ansehen",
    notNow: "Nicht jetzt",
    notConnectedToast: "Die Pro-Zahlung ist in dieser Entwicklungsversion noch nicht angebunden.",
  },
  cleanupConfirm: {
    title: "Bereinigung bestätigen?",
    body: '„{name}" verschiebt die betreffenden Dateien in den Windows-Papierkorb. Du kannst sie von dort wiederherstellen, solange er nicht geleert wird.',
    confirm: "In den Papierkorb verschieben",
    cancel: "Abbrechen",
  },
  cleanupButton: "Bereinigen",
  cleanupRunning: "...",
  cleanupResultToast: "{deleted} Elemente in den Papierkorb verschoben, {freed} freigegeben",
  cleanupResultToastSkipped: " ({skipped} in Verwendung, übersprungen).",
  diskOptimize: {
    title: "Laufwerk optimieren",
    description: "Fuhrt das integrierte Windows-Optimierungstool aus: Defragmentierung bei einer HDD oder TRIM bei einer SSD (nie eine vollstandige Defragmentierung, die sie nur unnotig abnutzen wurde).",
    button: "Jetzt optimieren",
    running: "Optimierung lauft... kann einige Minuten dauern",
    resultToast: "Laufwerk ({media}) erfolgreich optimiert.",
  },
  dnsFlush: {
    title: "DNS-Cache leeren",
    description: "Loscht zwischengespeicherte DNS-Eintrage. Nutzlich, wenn eine Website den Server gewechselt hat und dein Browser weiterhin die alte Version anzeigt.",
    button: "Jetzt leeren",
    running: "Wird geleert...",
    resultToast: "DNS-Cache geleert.",
  },
  largeFiles: {
    title: "Grosse Dateien finden",
    description: "Durchsucht einen Ordner nach den grossten Dateien (uber 100 MB), damit du schnell Speicherplatz freigeben kannst, indem du nicht mehr benotigte loschst.",
    chooseFolder: "Ordner wahlen",
    scanning: "Wird durchsucht...",
    noneFound: "Keine Dateien uber {size} gefunden.",
    foundCount: "{count} Dateien gefunden",
    moveSelected: "{count} ausgewahlte in den Papierkorb verschieben",
    deleting: "Wird in den Papierkorb verschoben...",
    deletedToast: "{count} Dateien verschoben, {freed} freigegeben.",
  },
  diskHealth: {
    title: "Laufwerksgesundheit",
    freeSpace: "{size} frei",
    selectDrive: "Laufwerk",
    healthy: "Intakt",
    warning: "Warnung",
    unhealthy: "Beeintrachtigt",
    unknown: "Unbekannt",
    loading: "Wird gepruft...",
  },
  duplicateFinder: {
    title: "Doppelte Dateien finden",
    description: "Ordner wählen: findet identische Dateien und lässt dich auswählen, welche in den Papierkorb verschoben werden.",
    chooseFolder: "Ordner wählen",
    scanning: "Wird gescannt...",
    noneFound: "Keine doppelten Dateien in diesem Ordner gefunden.",
    copies: "{count} Kopien · je {size}",
    moveSelected: "In den Papierkorb verschieben ({count} ausgewählt)",
    deleting: "...",
    deletedToast: "{count} Dateien in den Papierkorb verschoben ({freed} freigegeben).",
  },
  ipMask: {
    title: "IP maskieren (VPN)",
    description:
      "Verbirgt deine IP-Adresse, indem der Datenverkehr über einen VPN-Server geleitet wird. Erfordert einen externen VPN-Dienst: in dieser Version noch nicht integriert.",
    button: "Mehr erfahren",
    explainerToast:
      "Echtes IP-Masking braucht ein eigenes VPN-Backend (Server + Protokoll). Das ist noch nicht angebunden — hier siehst du nur eine Vorschau der Funktion.",
  },
  toasts: {
    applied: '„{name}" angewendet.',
    rolledBack: '„{name}" auf den ursprünglichen Wert zurückgesetzt.',
  },
  menu: {
    account: "Konto",
    plan: "Tarif",
    planFree: "Kostenlos",
    planPro: "Pro",
    upgradeButton: "Auf Pro upgraden",
    language: "Sprache",
    theme: "Designs",
    about: "Info",
    aboutBody: "PC Tweaker — Systemoptimierungen mit automatischer Sicherung und Wiederherstellung.",
    close: "Schließen",
  },
  auth: {
    login: "Anmelden",
    register: "Registrieren",
    email: "E-Mail",
    password: "Passwort",
    loginButton: "Anmelden",
    registerButton: "Konto erstellen",
    working: "...",
    logout: "Abmelden",
    loggedInAs: "Angemeldet als {email}",
    backendNotConfigured: "Noch kein Server verbunden: API_BASE_URL setzen, sobald das Backend bereitgestellt ist.",
    switchToRegister: "Noch kein Konto? Registrieren",
    switchToLogin: "Schon ein Konto? Anmelden",
    emailInvalid: "Bitte eine gültige E-Mail-Adresse eingeben.",
    passwordTooShort: "Das Passwort muss mindestens 8 Zeichen lang sein.",
    firstName: "Vorname",
    lastName: "Nachname",
    registerDetailsRequired: "Vorname, Nachname und Geburtsdatum sind erforderlich.",
    loginRequiredForCheckout: "Vor dem Freischalten von Pro anmelden oder registrieren.",
    forgotPasswordLink: "Passwort vergessen?",
    forgotPasswordButton: "Link zum Zurücksetzen senden",
    forgotPasswordSent: "Falls diese E-Mail registriert ist, erhältst du einen Link zum Zurücksetzen des Passworts.",
    backToLogin: "Zurück zur Anmeldung",
    emailNotVerified: "E-Mail nicht bestätigt",
    emailVerified: "E-Mail bestätigt",
    resendVerification: "Erneut senden",
    verificationSent: "Bestätigungs-E-Mail gesendet.",
  },
  tweaks: {
    disable_startup_delay: {
      name: "Verzögerung der Autostart-Programme entfernen",
      description:
        "Windows wartet nach der Anmeldung absichtlich etwa 10 Sekunden, bevor Autostart-Programme gestartet werden. Diese Option entfernt die Wartezeit (HKCU, keine Erhöhung erforderlich).",
    },
    menu_show_delay: {
      name: "Sofortige Menüreaktion",
      description:
        "Entfernt die Verzögerung beim Öffnen von Menüs, wodurch sich der gesamte Desktop spürbar flotter anfühlt (HKCU, keine Erhöhung erforderlich).",
    },
    disable_power_throttling: {
      name: "CPU-Energiedrosselung deaktivieren",
      description:
        "Verhindert, dass Windows Hintergrundprozesse zum Energiesparen ausbremst - nützlich bei Notebooks, wo das bei langen Sitzungen zu Rucklern führt (HKLM, erfordert Administratorrechte).",
    },
    games_gpu_priority: {
      name: "GPU-Priorität für Spiele erhöhen",
      description:
        "Weist den Multimedia-Scheduler an, Spielen die höchste GPU-Prioritätsklasse zu geben, damit Hintergrund-Apps mitten im Match nicht mehr um die GPU konkurrieren (HKLM, erfordert Administratorrechte).",
    },
    disable_tailored_experiences: {
      name: "Personalisierte Erlebnisse deaktivieren",
      description:
        "Verhindert, dass Windows deine Diagnosedaten nutzt, um Werbung, Tipps und Empfehlungen zu personalisieren (HKCU, keine Erhöhung erforderlich).",
    },
    disable_app_launch_tracking: {
      name: "Nicht mehr erfassen, welche Apps du öffnest",
      description:
        "Windows protokolliert, wie oft du jedes Programm startest, um Startmenü-Ergebnisse zu sortieren. Diese Option schaltet das ab (HKCU, keine Erhöhung erforderlich).",
    },
    disable_feedback_requests: {
      name: "Windows-Feedback-Abfragen unterbinden",
      description:
        "Verhindert, dass Windows dich mit Umfragen wie „Wie wahrscheinlich ist es, dass du ... weiterempfiehlst\" unterbricht (HKCU, keine Erhöhung erforderlich).",
    },
    disable_cortana: {
      name: "Cortana deaktivieren",
      description:
        "Schaltet Cortana per Systemrichtlinie ab und gibt die im Hintergrund reservierten Ressourcen frei (HKLM, erfordert Administratorrechte).",
    },
    show_file_extensions: {
      name: "Dateiendungen immer anzeigen",
      description:
        "Zeigt die echte Endung jeder Datei. Allein aus Sicherheitsgründen sinnvoll: Dateien wie „rechnung.pdf.exe\" werden so sichtbar, die Windows sonst verbirgt (HKCU, keine Erhöhung erforderlich).",
    },
    hide_taskbar_widgets: {
      name: "Widgets aus der Taskleiste ausblenden",
      description:
        "Entfernt die Widgets-Schaltfläche (Wetter/Nachrichten), die auch dann Inhalte im Hintergrund lädt, wenn du sie nie öffnest (HKCU, keine Erhöhung erforderlich).",
    },
    disable_transparency: {
      name: "Transparenzeffekte deaktivieren",
      description:
        "Schaltet die Weichzeichner-/Acryleffekte in Taskleiste und Menüs ab. Eine kleine, aber echte GPU-Ersparnis, die ältere Rechner oder Systeme mit integrierter Grafik flüssiger macht (HKCU, keine Erhöhung erforderlich).",
    },
    dark_mode: {
      name: "Dunkler Modus",
      description: "Aktiviert das dunkle Design für Apps und System (HKCU, keine Rechteerhöhung erforderlich).",
    },
    show_hidden_files: {
      name: "Versteckte Dateien anzeigen",
      description: "Zeigt versteckte Dateien und Ordner im Explorer an (HKCU, keine Rechteerhöhung erforderlich).",
    },
    priority_separation: {
      name: "CPU-Priorität optimieren",
      description: "Passt Win32PrioritySeparation an, um Hintergrunddienste zu bevorzugen (HKLM, Administratorrechte erforderlich).",
    },
    disable_game_dvr: {
      name: "Xbox Game Bar / Game DVR deaktivieren",
      description: "Deaktiviert die Hintergrundaufnahme der Xbox Game Bar, die beim Spielen CPU/GPU beansprucht (HKCU, keine Rechteerhöhung erforderlich).",
    },
    disable_telemetry_tasks: {
      name: "Diagnosedatenerfassung reduzieren",
      description: "Setzt die Windows-Diagnosestufe auf das minimal zulässige Niveau (HKLM, Administratorrechte erforderlich).",
    },
    reset_advertising_id: {
      name: "Werbe-ID deaktivieren",
      description: "Verhindert, dass Apps deine Werbe-ID zur Profilbildung nutzen (HKCU, keine Rechteerhöhung erforderlich).",
    },
    disable_location_tracking: {
      name: "Standortverfolgung deaktivieren",
      description: "Blockiert den Standortzugriff für alle Apps per Systemrichtlinie (HKLM, Administratorrechte erforderlich).",
    },
    disable_bing_search: {
      name: "Bing-Suche im Startmenü deaktivieren",
      description: "Verhindert, dass deine Suchanfragen im Startmenü an Bing gesendet werden (HKCU, keine Rechteerhöhung erforderlich).",
    },
    power_plan_performance: {
      name: "Hohe Leistung (Energiesparplan)",
      description:
        'Wechselt zum Windows-Energiesparplan „Hohe Leistung". Nützlich bei Desktop-PCs oder im Netzbetrieb; stellt beim Rückgängigmachen den vorherigen Plan wieder her.',
    },
    turbo_gaming: {
      name: "Turbo Gaming",
      description:
        "Preset: deaktiviert Game DVR, stellt den Energiesparplan auf Hohe Leistung und optimiert die CPU-Priorität (Administratorrechte erforderlich).",
    },
    privacy_dns: {
      name: "Privates DNS (Cloudflare)",
      description:
        "Wechselt zu datenschutzfreundlichen DNS-Servern (1.1.1.1), damit dein Provider DNS-Anfragen nicht protokollieren kann. Verbirgt nicht deine IP-Adresse (dafür ist ein VPN nötig, siehe unten).",
    },
    hardware_gpu_scheduling: {
      name: "Hardwarebeschleunigte GPU-Planung",
      description:
        "Aktiviert die hardwarebeschleunigte GPU-Planung (HAGS) von Windows, die in vielen Spielen die Eingabelatenz verringern kann (HKLM, Administratorrechte erforderlich).",
    },
    reduce_input_lag: {
      name: "Eingabeverzögerung reduzieren (Maus)",
      description:
        'Deaktiviert die Zeigerbeschleunigung („Mauspräzision verbessern") für eine 1:1-Mausbewegung ohne systemseitige Verzögerung (HKCU, keine Rechteerhöhung erforderlich).',
    },
    turbo_boost: {
      name: "Prozessor-Turbo-Boost",
      description:
        'Stellt den Leistungssteigerungsmodus des Prozessors auf „Aggressiv", um beim Spielen das Meiste aus Turbo Boost/Turbo Core herauszuholen (Administratorrechte erforderlich).',
    },
    network_throttling_index: {
      name: "Netzwerk-Drosselung für Multimedia deaktivieren",
      description:
        "Entfernt die Begrenzung, die Windows dem Netzwerkverkehr bei Multimedia-/Spiele-Apps auferlegt — nützlich, um Online-Mikroruckler zu reduzieren (HKLM, Administratorrechte erforderlich).",
    },
    system_responsiveness: {
      name: "Reaktionsfähigkeit für Vordergrund-Apps maximieren",
      description:
        "Setzt den von Windows für Hintergrundaufgaben reservierten CPU-Anteil auf null, sodass der App/dem Spiel im Vordergrund mehr Ressourcen bleiben (HKLM, Administratorrechte erforderlich).",
    },
    games_task_priority: {
      name: "Maximale Priorität für Spiele (Multimedia-Scheduler)",
      description:
        "Weist den Multimedia-Scheduler von Windows an, Spiele als Prozesse mit der höchsten Systempriorität zu behandeln, noch vor jeder Hintergrundaufgabe (HKLM, Administratorrechte erforderlich).",
    },
    reduce_keyboard_delay: {
      name: "Eingabeverzögerung reduzieren (Tastatur)",
      description:
        "Setzt die Verzögerung, bevor eine gehaltene Taste zu wiederholen beginnt, auf null und maximiert die Wiederholrate — für eine unmittelbarere Reaktion beim Spielen (HKCU, keine Elevation erforderlich).",
    },
    taskbar_align_left: {
      name: "Taskleiste links ausrichten",
      description: "Richtet die Taskleisten-Symbole wieder links aus (Windows-10-Stil) statt zentriert (HKCU, keine Elevation erforderlich).",
    },
    hide_taskbar_chat: {
      name: "Chat/Teams aus der Taskleiste ausblenden",
      description: "Entfernt das Chat-Symbol (Microsoft Teams) aus der Taskleiste (HKCU, keine Elevation erforderlich).",
    },
    disable_start_suggestions: {
      name: "Startmenü-Vorschläge und empfohlene Apps deaktivieren",
      description: "Verhindert, dass Windows empfohlene Apps, Werbung und Vorschläge im Startmenü anzeigt (HKCU, keine Elevation erforderlich).",
    },
    disable_activity_history: {
      name: "Aktivitätsverlauf deaktivieren (Windows Timeline)",
      description:
        "Verhindert, dass Windows deinen App- und Dokumentenverlauf per Systemrichtlinie aufzeichnet, speichert und an Microsoft sendet (HKLM, Administratorrechte erforderlich).",
    },
    hide_taskbar_search: {
      name: "Suchfeld aus der Taskleiste ausblenden",
      description:
        "Entfernt das Suchfeld/-symbol aus der Taskleiste für eine aufgeräumtere Leiste (die Suche bleibt über die Windows-Taste verfügbar) (HKCU, keine Elevation erforderlich).",
    },
    disable_fullscreen_optimizations_global: {
      name: "Vollbildoptimierungen global deaktivieren",
      description:
        "Zwingt DXGI dazu, den echten exklusiven Vollbildmodus statt der simulierten Windows-Variante zu verwenden, was Mikroruckler und Eingabeverzögerung in vielen älteren Spielen reduziert (HKCU, keine Elevation erforderlich).",
    },
    disable_windows_search_service: {
      name: "Indizierungsdienst deaktivieren (Windows Search)",
      description:
        "Stoppt und deaktiviert den Datei-Indizierungsdienst von Windows und reduziert so die Festplattenaktivität im Hintergrund — nützlich bei kleinen SSDs oder beim Spielen. Die Dateisuche im Startmenü wird langsamer, bis du ihn wieder aktivierst (Administratorrechte erforderlich).",
    },
  },
  cleanup: {
    temp_cleanup: {
      name: "Temporäre Dateien bereinigen",
      description: "Verschiebt den Inhalt von %TEMP% in den Papierkorb: jederzeit wiederherstellbar, kein endgültiges Löschen.",
    },
    winupdate_cache_cleanup: {
      name: "Windows Update-Cache leeren",
      description: "Verschiebt bereits installierte Windows Update-Pakete in den Papierkorb (Administratorrechte erforderlich).",
    },
  },
};

export const STRINGS: Record<Lang, Strings> = { it, en, fr, es, de };

/**
 * English is the product's primary language: a first-time user always sees
 * English regardless of their Windows locale, and only an explicit choice in
 * the language menu (persisted here) changes that. Auto-detecting from
 * `navigator.language` used to mean an Italian Windows install silently got
 * the Italian build on first launch, which made the app feel region-specific
 * rather than international.
 */
export function detectInitialLang(): Lang {
  const stored = localStorage.getItem("pc-tweaker-lang");
  if (stored && stored in STRINGS) return stored as Lang;
  return "en";
}
