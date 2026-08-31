export type Lang = "it" | "en" | "fr" | "es" | "de" | "pt";

export const LANGUAGES: { code: Lang; native: string }[] = [
  { code: "it", native: "Italiano" },
  { code: "en", native: "English" },
  { code: "fr", native: "Français" },
  { code: "es", native: "Español" },
  { code: "de", native: "Deutsch" },
  { code: "pt", native: "Português" },
];

export interface TweakText {
  name: string;
  description: string;
}

export interface Strings {
  appName: string;
  appliedCount: string; // "{applied} of {total} tweaks active" — use {applied}/{total}
  headerNote: string;
  advisor: {
    eyebrow: string;
    applyButton: string;
    confidenceHigh: string;
    confidenceStandard: string;
    reversible: string;
    empty: string;
  };
  drift: {
    // Two titles, because the card describes two different situations and a
    // title blaming Windows above a body saying Windows was not involved
    // contradicts itself.
    titleAfterUpdate: string;
    titleNoUpdate: string;
    // Singular and plural spelled out: there is no plural helper in this
    // file, and "1 tweak non risultano" is the kind of sentence that makes a
    // product feel machine-made.
    afterUpdateOne: string; // uses {patch}
    afterUpdateMany: string; // uses {count} {patch}
    noUpdateOne: string;
    noUpdateMany: string; // uses {count}
    reapplyOne: string;
    reapplyMany: string; // uses {count}
    reapplying: string;
    reappliedOne: string;
    reappliedMany: string; // uses {count}
  };
  crashes: {
    title: string;
    subtitle: string;
    copy: string;
    copied: string;
    clear: string;
    cleared: string;
    processApp: string;
    processElevated: string;
  };
  ledger: {
    title: string;
    subtitle: string;
    empty: string;
    clear: string;
    clearing: string;
    cleared: string;
    revert: string;
    elevated: string;
    failed: string;
    actions: {
      applied: string;
      reverted: string;
      cleanup: string;
      filesDeleted: string;
      diskOptimize: string;
      startupChange: string;
      restorePoint: string;
    };
  };
  tabs: {
    groupMonitor: string;
    groupOptimize: string;
    groupManage: string;
    scan: string;
    health: string;
    hardware: string;
    performance: string;
    privacy: string;
    ui: string;
    manutenzione: string;
    gaming: string;
    startup: string;
    profiles: string;
    pricing: string;
    ledger: string;
  };
  healthPanel: {
    title: string;
    subtitle: string;
    why: string;
    refresh: string;
    compute: string;
    computing: string;
    idleHint: string;
    showMore: string;
    showLess: string;
    stageProfile: string;
    stageTweaks: string;
    stageSecurity: string;
    stageScoring: string;
    verdictExcellent: string;
    verdictGood: string;
    verdictFair: string;
    verdictNeedsWork: string;
    baselineTitle: string;
    baselineHint: string;
    baselineRun: string;
    baselineRunning: string;
    baselineEmpty: string;
    changeSinceLast: string;
    changeNone: string;
    changeFirstRun: string;
    changeWhyTitle: string;
    changeContributes: string;
    changeStructural: string;
    changeTrend: string;
    categories: {
      performance: string;
      gaming: string;
      responsiveness: string;
      memory: string;
      storage: string;
      startup: string;
      maintenance: string;
      privacy: string;
      security: string;
    };
  };
  transparency: {
    title: string;
    key: string;
    value: string;
    setsTo: string;
    note: string;
    kindRegistry: string;
    kindCommand: string;
    kindService: string;
    copy: string;
    copied: string;
  };
  command: {
    statusQuiet: string;
    statusScanning: string;
    statusFindings: string; // uses {count}
    domainsLine: string;
    consent: string;
    runScan: string;
    reviewFindings: string; // uses {count}
    memTitle: string;
    pressureLow: string;
    pressureElevated: string;
    pressureHigh: string;
    memReview: string;
    memTopTitle: string;
    trimTitle: string;
    trimExplainer: string;
    trimButton: string;
    autoTitle: string;
    profilesTitle: string;
    profileGame: string;
    profileGameDesc: string;
    profileFocus: string;
    profileFocusDesc: string;
    profileQuiet: string;
    profileQuietDesc: string;
    profileDownload: string;
    profileDownloadDesc: string;
    previewBtn: string;
    gameChange1: string;
    gameChange2: string;
    gameChange3: string;
    previewReq: string;
    previewCost: string;
    previewRevert: string;
    applySession: string;
    restoreSession: string;
    statusActive: string;
    statusOff: string;
    soon: string;
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
    refresh: string;
    refreshing: string;
    hiddenOrphans: string;
  };
  search: {
    placeholder: string;
    noResults: string; // uses {query}
    clear: string;
  };
  pricing: {
    eyebrow: string;
    title: string;
    subtitle: string;
    monthly: string;
    annual: string;
    lifetime: string;
    saveBadge: string; // uses {percent}
    perMonth: string;
    perYear: string;
    once: string;
    lifetimeDetail: string; // uses {months}
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
    manageBilling: string;
    everythingInFree: string;
    reassurance: string;
    freeFeatures: string[];
    proFeatures: string[];
  };
  toggle: { on: string; off: string };
  driverBooster: {
    title: string;
    subtitle: string;
    scan: string;
    scanning: string;
    selectAll: string;
    selectNone: string;
    selectedCount: string;
    pagesForSelection: string;
    openSelected: string;
    opened: string;
    openedCapped: string;
    allCurrent: string;
    nothingActionable: string;
    note: string;
  };
  secureDefrag: {
    title: string;
    willDefrag: string;
    willRetrim: string;
    start: string;
    running: string;
    working: string;
    phaseAnalyze: string;
    phaseOptimize: string;
    analysisTitle: string;
    doneDefrag: string;
    doneRetrim: string;
    note: string;
  };
  zeroTrace: {
    title: string;
    subtitle: string;
    purgeTitle: string;
    purgeBody: string;
    purgeButton: string;
    purging: string;
    purgeResult: string;
    purgeLimit: string;
    shredTitle: string;
    shredBody: string;
    shredButton: string;
    shredding: string;
    shredDone: string;
    shredSummary: string;
    shredWarning: string;
    ssdCaveat: string;
  };
  hud: {
    title: string;
    subtitle: string;
    fpsAbout: string;
    fpsLowExplained: string;
    fpsStart: string;
    fpsStop: string;
    fpsNeedsAdmin: string;
    fpsRunning: string;
    show: string;
    hide: string;
    lock: string;
    unlock: string;
    dragHint: string;
    lockedHint: string;
    sizeCompact: string;
    sizeNormal: string;
  };
  updater: {
    title: string; // uses {version}
    body: string;
    install: string;
    later: string;
    downloading: string; // uses {percent}
    installing: string;
    error: string; // uses {message}
    checkFailed: string; // uses {message}
  };
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
    /** The real steps the Rust side performs, shown as it works through them. */
    loadLabel: string;
    stageReading: string;
    stageRaising: string;
    stageApplying: string;
    /** Readout under the gauge once boost is engaged. */
    modeAggressive: string;
    modeDefault: string;
    /** Benchmark stages and the measured outcome. */
    stageMeasuringBefore: string;
    stageMeasuringAfter: string;
    gainMeasured: string; // uses {factor}
    gainSlight: string; // uses {factor}
    gainAtCeiling: string;
    ceilingLocked: string;
    ceilingUnlocked: string;
  };
  profiles: {
    title: string;
    subtitle: string;
    saveHeading: string;
    namePlaceholder: string;
    saveButton: string;
    savedHeading: string;
    empty: string;
    tweakCount: string; // uses {count}
    apply: string;
    applying: string;
    exportButton: string;
    importButton: string;
    deleteButton: string;
    savedToast: string; // uses {name}
    appliedToast: string; // uses {count}
    exportedToast: string;
    importedToast: string; // uses {count}
    droppedWarning: string; // uses {count}
    nameRequired: string;
    reviewNotice: string;
    signInRequired: string;
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
    /** Hardware-derived verdicts shown under a scanned item. */
    verdictRecommended: string;
    verdictNotRecommended: string;
    verdictUnsupported: string;
    /** Keyed by `reason_key` from the Rust recommendation engine. */
    reasons: {
      laptop_battery: string;
      hdd_index_cost: string;
      fast_disk_no_gain: string;
      needs_win10_2004: string;
      weak_gpu: string;
    };
    /** The hardware strip shown above the scan button. */
    thisPc: string;
    dashDrivesTitle: string;
    dashFreeOf: string; // uses {free} {total}
    dashAlmostFull: string;
    dashStartupTitle: string;
    dashStartupCount: string; // uses {on} {total}
    dashManage: string;
    dashUptimeTitle: string;
    dashUptimeDh: string; // uses {days} {hours}
    dashUptimeHm: string; // uses {hours} {minutes}
    dashUptimeLongHint: string;
    dashHistoryTitle: string;
    dashHistoryEmpty: string;
    dashActTweakApplied: string;
    dashActTweakReverted: string;
    dashActCleanup: string;
    dashActFilesDeleted: string;
    dashActStartupChange: string;
    dashActDiskOptimize: string;
    dashActRestorePoint: string;
    profileUnknown: string;
    diskHdd: string;
    diskSsd: string;
    diskNvme: string;
    formDesktop: string;
    formLaptop: string;
    /** Result groups, ordered by how much the hardware argues for them. */
    groupRecommended: string;
    groupOptional: string;
    groupNotRecommended: string;
    tailoredNote: string;
    /** The two primary actions, each carrying its own count. */
    fixRecommended: string; // uses {count}
    fixEverything: string; // uses {count}
    nothingSelected: string;
    foundHeadline: string; // uses {count}
    foundNone: string;
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
    autoNext: string; // uses {time}
    autoDue: string;
    autoLast: string; // uses {time} and {amount}
    autoNoneYet: string;
    autoFailed: string; // uses {detail}
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
    previewLoading: string;
    previewEmpty: string;
    previewNotAccessible: string;
    previewTruncated: string;
    selectedSummary: string; // uses {count} {size}
    confirmSelected: string;
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
  browserCleanup: {
    title: string;
    description: string;
    noneFound: string;
    cache: string;
    cookies: string;
    clearButton: string;
    clearing: string;
    runningWarning: string; // uses {browser}
    clearedToast: string; // uses {browser} {freed}
  };
  redaxaPromo: {
    title: string;
    description: string;
    button: string;
  };
  uninstallerPromo: {
    title: string;
    description: string;
    button: string;
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
    licenseNeedsRefresh: string;
    accountRefreshFailed: string;
  };
  titlebar: {
    applied: string; // uses {applied} and {total}
    cpu: string;
    ram: string;
    minimize: string;
    maximize: string;
    restore: string;
    close: string;
  };
  x3d: {
    title: string;
    subtitle: string;
    cpuLabel: string;
    readyHeadline: string; // uses {cores}
    readyBody: string;
    singleDie: string;
    uniformCache: string;
    unavailable: string;
    dieLabel: string; // uses {index}
    dieCache: string; // uses {mb}
    dieThreads: string; // uses {count}
    vcacheBadge: string;
    processesTitle: string;
    processesHint: string;
    refresh: string;
    refreshing: string;
    align: string;
    reset: string;
    alignedBadge: string;
    noProcesses: string;
    persistenceNote: string;
    alignedToast: string; // uses {name}
    resetToast: string; // uses {name}
  };
  hardware: {
    intro: string;
    gpuLabel: string;
    cpuLabel: string;
    liveBadge: string;
    gpuDriver: string; // uses {version}
    load: string;
    vram: string;
    fan: string;
    power: string;
    fanIdle: string;
    powerLimit: string; // uses {limit}
    tempCool: string;
    tempGood: string;
    tempWarm: string;
    tempHot: string;
    traceLabel: string;
    traceRange: string; // uses {min} and {max}
    noTempSensor: string;
    cpuAcpiSource: string;
    cpuNoSensor: string;
    noGpuTool: string;
    thermalsUnavailable: string;
    driversTitle: string;
    driversSubtitle: string;
    driversRescan: string;
    driversScanning: string;
    driversCounted: string; // uses {count}
    driversAging: string; // uses {count}
    driversStale: string; // uses {count}
    driversAllCurrent: string;
    driversNone: string;
    driversShowAll: string; // uses {count}
    driversShowLess: string;
    driversInboxNote: string; // uses {count}
    ageYears: string; // uses {years}
    ageYear: string; // uses {years}, singular form
    ageMonths: string; // uses {months}
    ageMonth: string; // uses {months}, singular form
    vendorSite: string;
    watchLabel: string;
    peakLabel: string;
    verdictRisky: string;
    verdictNormal: string;
    verdictBetter: string;
    verdictIdle: string;
    verdictRiskyHint: string;
    verdictNormalHint: string;
    verdictBetterHint: string;
    verdictIdleHint: string;
    profilesTitle: string;
    profilesSubtitle: string;
    currentLimit: string; // uses {watts}
    modeSilent: string;
    modeSilentHint: string;
    modeStandard: string;
    modeStandardHint: string;
    modeGaming: string;
    modeGamingHint: string;
    modeApplying: string;
    profileStageReading: string;
    profileStageApplying: string;
    profileStageSettling: string;
    profileApplied: string; // uses {watts}
    profileNote: string;
    profileDefaultIsMax: string;
    driverInstalled: string; // uses {version} and {date}
    driversNoUpdateCheck: string;
    driversCheckedAt: string; // uses {time}
    modeClockLocked: string; // uses {mhz}
    modeClockAuto: string;
    profileApply: string;
    profileActive: string;
    profileWillSet: string; // uses {watts} and {clock}
    scanStarting: string;
    scanReading: string; // uses {class}
    scanCount: string; // uses {done}, {total} and {pct}
    driversScannedAll: string; // uses {total} and {classes}
    winUpdateLabel: string;
    winUpdateButton: string;
    winUpdateNote: string;
    winUpdateOpened: string;
    winUpdateSearching: string;
    winUpdateTakesAWhile: string;
    winUpdateInstall: string; // uses {count}
    winUpdateInstalling: string;
    winUpdateNone: string;
    winUpdateFailed: string; // uses {detail}
    winUpdateDone: string; // uses {installed} and {failed}
    rebootTitle: string;
    rebootBody: string;
    rebootNow: string;
    rebootLater: string;
  };
  menu: {
    account: string;
    plan: string;
    planFree: string;
    planPro: string;
    viewPlan: string;
    upgradeButton: string;
    language: string;
    theme: string;
    about: string;
    errorReports: string;
    errorReportsBody: string;
    changePhoto: string;
    removePhoto: string;
    photoFailed: string;
    support: string;
    reportIssue: string;
    aboutBody: string;
    close: string;
  };
  auth: {
    login: string;
    register: string;
    email: string;
    password: string;
    loginButton: string;
    rememberMe: string;
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
  advisor: {
    eyebrow: "Consigliato per il tuo PC",
    applyButton: "Applica",
    confidenceHigh: "Alta affidabilità — basato sull'hardware di questo PC",
    confidenceStandard: "Consigliato per questo tipo di macchina",
    reversible: "Reversibile — il valore originale viene salvato prima di ogni modifica.",
    empty:
      "Niente da consigliare al momento — la tua configurazione rispecchia già i nostri consigli.",
  },
  drift: {
    titleAfterUpdate: "Windows ha rimesso mano alle tue impostazioni",
    titleNoUpdate: "Alcune impostazioni non sono più attive",
    afterUpdateOne:
      "Dopo l’aggiornamento a {patch}, un tweak che avevi applicato non risulta più attivo sul sistema.",
    afterUpdateMany:
      "Dopo l’aggiornamento a {patch}, {count} tweak che avevi applicato non risultano più attivi sul sistema.",
    noUpdateOne:
      "Un tweak che avevi applicato non risulta più attivo sul sistema. Nessun aggiornamento di Windows nel frattempo, quindi l’ha cambiato qualcos’altro.",
    noUpdateMany:
      "{count} tweak che avevi applicato non risultano più attivi sul sistema. Nessun aggiornamento di Windows nel frattempo, quindi li ha cambiati qualcos’altro.",
    reapplyOne: "Riapplica il tweak",
    reapplyMany: "Riapplica {count} tweak",
    reapplying: "Riapplicazione...",
    reappliedOne: "Tweak riapplicato.",
    reappliedMany: "{count} tweak riapplicati.",
  },
  crashes: {
    title: "Chiusure impreviste",
    subtitle:
      "L'app si è chiusa da sola. Il rapporto resta su questo PC: copialo e inviamelo su Discord o su GitHub se vuoi che lo sistemi.",
    copy: "Copia rapporto",
    copied: "Rapporto copiato negli appunti.",
    clear: "Cancella",
    cleared: "Rapporti cancellati.",
    processApp: "finestra principale",
    processElevated: "operazione con diritti admin",
  },
  ledger: {
    title: "Registro modifiche",
    subtitle:
      "Tutto ciò che questa app ha modificato su questo PC, dal più recente. Salvato in locale, mai caricato online.",
    empty: "Nessuna modifica registrata. Applica il tuo primo tweak e comparirà qui.",
    clear: "Cancella cronologia",
    clearing: "Cancellazione...",
    cleared: "Cronologia cancellata.",
    revert: "Ripristina",
    elevated: "con diritti admin",
    failed: "non riuscita",
    actions: {
      applied: "Tweak applicato",
      reverted: "Tweak ripristinato",
      cleanup: "Pulizia",
      filesDeleted: "File eliminati",
      diskOptimize: "Ottimizzazione disco",
      startupChange: "Modifica avvio",
      restorePoint: "Punto di ripristino",
    },
  },
  tabs: {
    groupMonitor: "Monitoraggio",
    groupOptimize: "Ottimizza",
    groupManage: "Gestisci",
    scan: "Scansione",
    health: "Salute PC",
    hardware: "Hardware",
    performance: "Prestazioni",
    privacy: "Privacy",
    ui: "Interfaccia",
    manutenzione: "Manutenzione",
    gaming: "Gaming",
    startup: "Avvio",
    profiles: "Configurazioni",
    pricing: "Piani e prezzi",
    ledger: "Cronologia",
  },
  healthPanel: {
    title: "Salute del PC",
    subtitle: "Un punteggio spiegabile: ogni numero mostra i fatti da cui è calcolato.",
    why: "Perché {score}?",
    refresh: "Ricalcola",
    compute: "Calcola il punteggio",
    showMore: "Mostra dettagli",
    showLess: "Nascondi dettagli",
    stageProfile: "Lettura profilo di sistema",
    stageTweaks: "Verifica tweak applicati",
    stageSecurity: "Controllo stato sicurezza",
    stageScoring: "Calcolo del punteggio",
    verdictExcellent: "ECCELLENTE",
    verdictGood: "BUONO",
    verdictFair: "DISCRETO",
    verdictNeedsWork: "DA MIGLIORARE",
    computing: "Analisi in corso...",
    idleHint:
      "Nessuna analisi in background: il punteggio viene calcolato solo quando lo chiedi tu, interamente su questo PC.",
    baselineTitle: "Baseline",
    baselineHint:
      "Misure rapide e ripetibili — confrontabili solo con esecuzioni precedenti su questo PC.",
    baselineRun: "Esegui baseline",
    baselineRunning: "Misurazione in corso (~5 s)...",
    baselineEmpty:
      "Nessuna baseline ancora. Eseguine una prima di applicare modifiche, e una dopo.",
    changeSinceLast: "dall'ultimo controllo",
    changeNone: "Nessun cambiamento dall'ultimo controllo.",
    changeFirstRun:
      "Prima misurazione registrata. Eseguila di nuovo dopo una modifica per vedere cosa si è mosso.",
    changeWhyTitle: "Perché il punteggio è cambiato",
    changeContributes: "Contributo al punteggio complessivo:",
    changeStructural:
      "Un aggiornamento dell'app ha cambiato quali categorie vengono valutate: parte di questa differenza non dipende dal tuo PC.",
    changeTrend: "Andamento",
    categories: {
      performance: "Prestazioni",
      gaming: "Gaming",
      responsiveness: "Reattività",
      memory: "Memoria",
      storage: "Archiviazione",
      startup: "Avvio",
      maintenance: "Manutenzione",
      privacy: "Privacy",
      security: "Sicurezza",
    },
  },
  transparency: {
    title: "Cosa modifica esattamente",
    key: "Chiave",
    value: "Valore",
    setsTo: "Imposta a",
    note: "Il valore precedente viene salvato prima della scrittura, così il rollback lo ripristina esattamente com'era.",
    kindRegistry: "Registro",
    kindCommand: "Comando",
    kindService: "Servizio",
    copy: "Copia",
    copied: "Copiato",
  },
  command: {
    statusQuiet: "Tutto tranquillo",
    statusScanning: "Analisi in corso...",
    statusFindings: "{count} raccomandazioni pronte",
    domainsLine: "Avvio · Spazio · Memoria · Privacy · Prestazioni · Aggiornamenti",
    consent: "Nulla cambia senza la tua approvazione.",
    runScan: "Avvia scansione di sistema",
    reviewFindings: "Rivedi {count} raccomandazioni",
    memTitle: "Pressione memoria",
    pressureLow: "Bassa",
    pressureElevated: "Elevata",
    pressureHigh: "Alta",
    memReview: "Analizza l'uso della memoria",
    memTopTitle: "Processi principali",
    trimTitle: "Riduci i working set",
    trimExplainer:
      "Chiede a Windows di spostare le pagine inattive fuori dai working set delle app (EmptyWorkingSet). Utile quando la pressione è alta; le app potrebbero ricaricare brevemente le pagine al prossimo uso. Nessun dato viene perso.",
    trimButton: "Riduci ora",
    autoTitle: "Riduzione automatica",
    profilesTitle: "Profili sessione",
    profileGame: "Sessione di gioco",
    profileGameDesc: "Prepara il PC per giocare: energia, priorità e registrazione DVR.",
    profileFocus: "Focus",
    profileFocusDesc: "Meno distrazioni e attività non essenziali sotto controllo.",
    profileQuiet: "Sessione silenziosa",
    profileQuietDesc: "Efficienza, batteria e rumore contenuto.",
    profileDownload: "Sessione download",
    profileDownloadDesc: "Controlla banda e attività in background.",
    previewBtn: "Anteprima modifiche",
    gameChange1: "Disattiva Game DVR (registrazione in background)",
    gameChange2: "Passa al piano energetico Prestazioni elevate",
    gameChange3: "Ottimizza la priorità CPU per i giochi (Win32PrioritySeparation)",
    previewReq: "Richiede diritti di amministratore · Funzione Pro",
    previewCost: "Costo potenziale: maggiore consumo e calore finché attiva.",
    previewRevert: "Reversibile con un click: ogni valore originale viene salvato prima.",
    applySession: "Avvia sessione",
    restoreSession: "Ripristina",
    statusActive: "Attiva",
    statusOff: "Non attiva",
    soon: "In arrivo",
  },
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
    refresh: "Aggiorna",
    refreshing: "Rilettura...",
    hiddenOrphans: "{count} voci nascoste: il programma non è più installato.",
  },
  search: {
    placeholder: "Cerca un tweak...",
    noResults: 'Nessun risultato per "{query}".',
    clear: "Cancella",
  },
  pricing: {
    eyebrow: "Sblocca tutto",
    title: "Scegli quanto vuoi spingere",
    subtitle:
      "Ogni modifica salva prima com'era: qualsiasi cosa provi qui, la annulli in un click. Il gratuito copre l'essenziale, Pro apre il resto.",
    monthly: "Mensile",
    annual: "Annuale",
    lifetime: "A vita",
    saveBadge: "RISPARMI IL {percent}%",
    perMonth: "/mese",
    perYear: "/anno",
    once: "una tantum",
    lifetimeDetail:
      "Paghi una volta e resta tuo. Si ripaga in {months} mesi rispetto all’abbonamento annuale, e da lì in poi non paghi più",
    annualDetail: "Sono {monthly} al mese, addebitati {yearly} una volta l’anno",
    annualNudge: "Con il piano annuale sarebbero {price} al mese",
    mostChosen: "IL PIÙ SCELTO",
    freeName: "Free",
    freeTagline: "Tutto il necessario per un PC più pulito e reattivo.",
    freePriceNote: "Per sempre, senza scadenza",
    freeCta: "Stai usando il piano Free",
    freeCurrent: "Piano attuale",
    proName: "Pro",
    proTagline:
      "Ogni tweak, inclusi quelli che richiedono privilegi di amministratore e quelli che altrimenti faresti a mano nel registro.",
    proCta: "Passa a Pro",
    proCurrent: "Il tuo piano",
    manageBilling: "Gestisci abbonamento",
    everythingInFree: "Tutto quello che c’è nel Free, più:",
    reassurance:
      "Disdici quando vuoi. Ogni modifica resta reversibile con un click, anche dopo la disdetta.",
    freeFeatures: [
      "{count} tweak reali, con backup e ripristino di ogni modifica",
      "Monitor di sistema in tempo reale (CPU, memoria, disco)",
      "Gestione dei programmi all’avvio",
      "Controllo violazioni password",
      "Scansione del PC e correzione in un click",
      "Pulizia dei file temporanei",
    ],
    proFeatures: [
      "Game Sessions: attiva il turbo da solo quando lanci un gioco",
      "Preset Turbo Gaming e priorità massima ai giochi",
      "Privacy avanzata: telemetria e cronologia attività",
      "Trova e rimuove i file duplicati",
      "Svuota la cache di Windows Update",
      "Disattiva l’indicizzazione che tiene il disco occupato",
      "Ogni tweak e ogni funzione futura, inclusi",
    ],
  },
  toggle: { on: "Attivato", off: "Disattivato" },
  driverBooster: {
    title: "Driver Booster",
    subtitle:
      "Seleziona i driver più vecchi e apri tutte le loro pagine di download in un colpo solo.",
    scan: "Analizza driver",
    scanning: "Analisi...",
    selectAll: "Seleziona tutti",
    selectNone: "Deseleziona tutti",
    selectedCount: "{selected} di {total} selezionati",
    pagesForSelection: "{pages} pagine da aprire",
    openSelected: "Apri le pagine di download ({count})",
    opened: "{count} pagine aperte",
    openedCapped:
      "Aperte {opened} pagine su {total}: le altre restano selezionate, riprova per aprirle.",
    allCurrent: "Nessun driver risulta datato.",
    nothingActionable: "Nessun driver datato con una pagina del produttore disponibile.",
    note: "PC Tweaker non scarica pacchetti driver da solo: non esiste un’API dei produttori che dica qual è la versione giusta per il tuo esatto dispositivo, e installare il driver video sbagliato è uno dei pochi errori che può lasciarti senza schermo. Qui si automatizza la parte noiosa — trovare le pagine — non la scelta. Per i driver che Windows Update conosce davvero, usa il pulsante qui sopra.",
  },
  secureDefrag: {
    title: "Deframmentazione sicura",
    willDefrag: "Questo disco è meccanico: verrà eseguita una vera deframmentazione.",
    willRetrim:
      "Questo disco non risulta meccanico: viene analizzato per intero, poi viene eseguito un retrim invece di una deframmentazione. Il retrim dura pochi secondi e riguarda solo lo spazio libero — è così che funziona: comunica al controller quali blocchi non servono più, così può riutilizzarli senza rallentare. Deframmentare un SSD non lo velocizza, lo consuma soltanto.",
    start: "Avvia",
    running: "In corso...",
    working: "Elaborazione...",
    phaseAnalyze: "Analisi",
    phaseOptimize: "Ottimizzazione",
    analysisTitle: "Rapporto di analisi",
    doneDefrag: "Deframmentazione completata.",
    doneRetrim: "Retrim completato.",
    note: "Prima dell’operazione viene creato un punto di ripristino. La percentuale arriva da Windows stesso, non da un timer.",
  },
  zeroTrace: {
    title: "Zero-Trace Cleaner",
    subtitle:
      "Rimuove ciò che resta in memoria dopo la chiusura dei programmi e distrugge i file in modo irreversibile.",
    purgeTitle: "Pulizia memoria",
    purgeBody:
      "Windows tiene in RAM le pagine dei programmi chiusi come cache. Questo le rilascia: i frammenti lasciati da un processo terminato spariscono davvero dalla memoria fisica.",
    purgeButton: "Pulisci memoria",
    purging: "Pulizia...",
    purgeResult: "Liberati {freed} MB — ora liberi {after} MB",
    purgeLimit:
      "Non tocca il file di paging né quello di ibernazione: sono su disco e Windows non offre un’API per ripulirli a caldo.",
    shredTitle: "Distruzione sicura file",
    shredBody:
      "Sovrascrive il contenuto del file in tre passaggi prima di eliminarlo, rendendolo irrecuperabile dai normali strumenti di undelete.",
    shredButton: "Scegli file...",
    shredding: "Distruzione...",
    shredDone: "{count} file distrutti ({size})",
    shredSummary: "{shredded} distrutti, {skipped} saltati",
    shredWarning: "Definitivo: nessun passaggio dal Cestino, nessun recupero possibile.",
    ssdCaveat:
      "Su SSD il wear levelling scrive quasi sempre su celle diverse dall’originale: le celle vecchie vengono liberate, non riscritte. Solo il secure-erase del disco può garantire di più.",
  },
  hud: {
    title: "Overlay di gioco",
    subtitle:
      "Pannello trasparente sopra il gioco: carico CPU/GPU, temperature, VRAM, processo attivo con la sua priorità e indicatore di collo di bottiglia.",
    fpsAbout:
      "Gli FPS si contano dagli eventi di present che Windows emette per ogni fotogramma — la stessa fonte di PresentMon, senza alcun aggancio al gioco. Richiede l’avvio come amministratore, perché aprire una sessione di tracciamento è un’operazione privilegiata.",
    fpsLowExplained:
      "Accanto agli FPS medi c’è DROP: la velocità dell’1% di fotogrammi peggiori, quello che altrove trovi chiamato «1% low». È il numero che si muove quando il gioco scatta, mentre la media resta alta e non te lo dice. Più DROP è vicino alla media, più il gioco è fluido.",
    fpsStart: "Misura FPS",
    fpsStop: "Ferma misura",
    fpsNeedsAdmin: "Per misurare gli FPS serve avviare PC Tweaker come amministratore.",
    fpsRunning:
      "Misurazione attiva: gli FPS compaiono nell’overlay appena un gioco inizia a disegnare.",
    show: "Mostra",
    hide: "Nascondi",
    lock: "Blocca",
    unlock: "Sblocca",
    dragHint: "Trascina l’overlay dove vuoi, poi bloccalo prima di avviare il gioco.",
    lockedHint: "Bloccato: i clic lo attraversano e raggiungono il gioco. Sbloccalo per spostarlo.",
    sizeCompact: "Compatto",
    sizeNormal: "Normale",
  },
  updater: {
    title: "Aggiornamento disponibile: v{version}",
    body: "Si scarica e si installa in un passaggio; al termine l'app si riavvia da sola.",
    install: "Installa e riavvia",
    later: "Più tardi",
    downloading: "Download... {percent}%",
    installing: "Installazione...",
    error: "Aggiornamento non riuscito: {message}",
    checkFailed: "Controllo aggiornamenti non riuscito: {message}",
  },
  badges: { admin: "Admin", pro: "PRO", soon: "IN ARRIVO" },
  emptyCategory: "Nessun tweak disponibile in questa categoria — presto in arrivo.",
  gameSessions: {
    title: "Game Sessions",
    subtitle:
      "Rileva automaticamente i tuoi giochi e applica/annulla il preset Turbo Gaming da solo.",
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
    loadLabel: "CARICO CPU",
    stageReading: "Lettura del piano energetico",
    stageRaising: "Aumento del limite di boost",
    stageApplying: "Applicazione al sistema",
    modeAggressive: "Modalità aggressiva",
    modeDefault: "Modalità predefinita",
    stageMeasuringBefore: "Misurazione prima",
    stageMeasuringAfter: "Nuova misurazione",
    gainMeasured: "{factor}x più veloce",
    gainSlight: "{factor}x più veloce — guadagno contenuto",
    gainAtCeiling: "Già al massimo: questa CPU non aveva altro margine da liberare",
    ceilingLocked: "Limite boost bloccato",
    ceilingUnlocked: "Limite boost sbloccato",
  },
  profiles: {
    title: "Configurazioni",
    subtitle: "Salva come hai impostato il PC, riapplicalo in un click, o passalo a qualcun altro.",
    saveHeading: "Salva quella attuale",
    namePlaceholder: "Nome (es. Gaming)",
    saveButton: "Salva",
    savedHeading: "Salvate",
    empty: "Nessuna configurazione salvata.",
    tweakCount: "{count} tweak",
    apply: "Applica",
    applying: "Applico...",
    exportButton: "Esporta",
    importButton: "Importa da file",
    deleteButton: "Elimina",
    savedToast: 'Configurazione "{name}" salvata',
    appliedToast: "{count} tweak applicati",
    exportedToast: "File esportato",
    importedToast: "Importata: {count} tweak pronti da rivedere",
    droppedWarning: "{count} voci non riconosciute da questa versione sono state scartate",
    nameRequired: "Dai un nome alla configurazione",
    reviewNotice:
      "Le configurazioni importate non vengono mai applicate da sole: le rivedi tu prima.",
    signInRequired: "Accedi o crea un account per salvare le configurazioni.",
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
    verdictRecommended: "Consigliato su questo PC",
    verdictNotRecommended: "Sconsigliato su questo PC",
    verdictUnsupported: "Non supportato",
    reasons: {
      laptop_battery: "questo PC è un portatile: costa autonomia più di quanto renda",
      hdd_index_cost:
        "il disco di sistema è meccanico, l'indicizzazione in background si sente davvero",
      fast_disk_no_gain:
        "il disco di sistema è NVMe, già abbastanza veloce da rendere il guadagno trascurabile",
      needs_win10_2004: "richiede Windows 10 versione 2004 o successiva",
      weak_gpu: "grafica integrata: la trasparenza le costa prestazioni utili",
    },
    thisPc: "Questo PC",
    dashDrivesTitle: "Spazio disco",
    dashFreeOf: "{free} liberi di {total}",
    dashAlmostFull: "Quasi pieno",
    dashStartupTitle: "App all'avvio",
    dashStartupCount: "{on} attive su {total}",
    dashManage: "Gestisci",
    dashUptimeTitle: "Acceso da",
    dashUptimeDh: "{days}g {hours}h",
    dashUptimeHm: "{hours}h {minutes}min",
    dashUptimeLongHint:
      "Questo PC non viene riavviato da un po'. Un riavvio applica gli aggiornamenti in sospeso e libera la memoria trattenuta.",
    dashHistoryTitle: "Azioni recenti",
    dashHistoryEmpty: "Ancora nulla. Le azioni che esegui compariranno qui.",
    dashActTweakApplied: "Tweak applicato",
    dashActTweakReverted: "Tweak ripristinato",
    dashActCleanup: "Pulizia",
    dashActFilesDeleted: "File eliminati",
    dashActStartupChange: "Avvio modificato",
    dashActDiskOptimize: "Disco ottimizzato",
    dashActRestorePoint: "Punto di ripristino",
    profileUnknown: "Non rilevato",
    diskHdd: "HDD",
    diskSsd: "SSD",
    diskNvme: "NVMe",
    formDesktop: "Desktop",
    formLaptop: "Portatile",
    groupRecommended: "Consigliate per questo PC",
    groupOptional: "Facoltative",
    groupNotRecommended: "Sconsigliate su questo PC",
    tailoredNote: "Ogni voce è valutata sull'hardware qui sopra, non su una lista fissa.",
    fixRecommended: "Applica le {count} consigliate",
    fixEverything: "Applica le selezionate ({count})",
    nothingSelected: "Nessuna voce selezionata",
    foundHeadline: "{count} da sistemare su questo PC",
    foundNone: "Niente da sistemare",
    doneTitle: "Fatto!",
    doneBody: "{count} ottimizzazioni applicate. Il tuo PC è a posto.",
    fixHeading: "Pronte da applicare",
  },
  ram: {
    title: "Libera RAM",
    subtitle:
      "Chiede a Windows di rilasciare la memoria che i programmi tengono occupata senza usarla. Puoi farlo quante volte vuoi.",
    button: "Libera ora",
    cleaning: "Pulizia in corso...",
    freed: "Liberati {amount}",
    freedNothing: "La memoria era già ottimizzata",
    inUse: "{used} di {total} in uso",
    autoLabel: "Pulizia automatica",
    autoOff: "Disattivata",
    autoEvery: "Ogni {interval}",
    autoHint:
      "Con la pulizia automatica attiva, PC Tweaker libera la RAM da solo a intervalli regolari finché l'app resta aperta.",
    autoNext: "Prossima pulizia alle {time}",
    autoDue: "Pulizia in corso...",
    autoLast: "Ultima alle {time}: {amount} liberati",
    autoNoneYet: "Nessuna pulizia automatica ancora eseguita.",
    autoFailed: "Ultimo tentativo non riuscito: {detail}",
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
    previewLoading: "Calcolo di cosa verrà spostato nel Cestino...",
    previewEmpty: "Non c'è nulla da pulire: la cartella è già vuota.",
    previewNotAccessible:
      "Il contenuto non è leggibile senza permessi di amministratore; verrà elencato ed eliminato dal processo autorizzato.",
    previewTruncated: "Mostrati i 500 elementi più grandi; i totali includono tutto.",
    selectedSummary: "{count} elementi selezionati · {size}",
    confirmSelected: "Pulisci selezionati",
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
    description:
      "Esegue lo strumento di ottimizzazione integrato di Windows: deframmentazione su HDD, oppure TRIM sugli SSD (mai una deframmentazione completa, che li usurerebbe inutilmente).",
    button: "Ottimizza ora",
    running: "Ottimizzazione in corso... può richiedere qualche minuto",
    resultToast: "Disco ({media}) ottimizzato con successo.",
  },
  dnsFlush: {
    title: "Svuota cache DNS",
    description:
      "Cancella gli indirizzi DNS salvati in memoria. Utile se un sito ha cambiato server e nel browser continui a vedere la versione vecchia.",
    button: "Svuota ora",
    running: "Svuotamento...",
    resultToast: "Cache DNS svuotata.",
  },
  browserCleanup: {
    title: "Pulizia browser",
    description:
      "Svuota cache e cookie di Chrome, Edge e Firefox. Il browser li ricrea da solo al prossimo avvio, quindi non perdi nulla di permanente.",
    noneFound: "Nessun browser supportato trovato su questo PC.",
    cache: "Cache",
    cookies: "Cookie",
    clearButton: "Svuota",
    clearing: "Svuotamento...",
    runningWarning: "Chiudi {browser} per poterlo svuotare.",
    clearedToast: "{browser}: {freed} liberati.",
  },
  redaxaPromo: {
    title: "Redaxa",
    description:
      "Hai bloccato telemetria e tracciamento — ma cosa incolli nelle chat AI? Redaxa intercetta dati personali e credenziali prima che un prompt raggiunga qualsiasi modello. Stessa famiglia, stessa regola: niente viene salvato.",
    button: "Prova sul web",
  },
  uninstallerPromo: {
    title: "PC Tweaker Uninstaller",
    description:
      "Rimuovi interi programmi in sicurezza: punto di ripristino automatico, comando verificato e report onesto. Della stessa famiglia di PC Tweaker.",
    button: "Scopri",
  },
  largeFiles: {
    title: "Trova file di grandi dimensioni",
    description:
      "Cerca in una cartella i file più pesanti (oltre 100 MB), così puoi liberare spazio velocemente eliminando quelli che non ti servono più.",
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
    licenseNeedsRefresh:
      "Non riusciamo a verificare il tuo abbonamento Pro offline da troppo tempo. Riconnettiti a internet e riprova.",
    accountRefreshFailed:
      "Non riusciamo a verificare lo stato del tuo account. Lo stato mostrato qui potrebbe non essere aggiornato — controlla la connessione o riprova più tardi.",
  },
  titlebar: {
    applied: "{applied}/{total} attive",
    cpu: "CPU",
    ram: "RAM",
    minimize: "Riduci a icona",
    maximize: "Ingrandisci",
    restore: "Ripristina",
    close: "Chiudi",
  },
  x3d: {
    title: "Allineatore die 3D V-Cache",
    subtitle:
      "Sui Ryzen X3D a due die uno solo porta la cache impilata. Windows non sa quale sia e distribuisce il gioco su entrambi: ogni accesso che attraversa i die paga un giro sull'Infinity Fabric.",
    cpuLabel: "Processore",
    readyHeadline: "Die con V-Cache individuato: {cores} thread",
    readyBody: "Blocca un gioco su questo die e ogni suo thread resta dove la cache è più grande.",
    singleDie:
      "Questo processore ha un solo die: tutti i core vedono già la stessa cache, quindi non c'è nulla da allineare. La funzione compare da sola su una CPU a due die con cache asimmetrica.",
    uniformCache:
      "Questo processore ha più die ma con la stessa quantità di cache. Spostare un gioco da uno all'altro non cambierebbe nulla, quindi la funzione resta disattivata.",
    unavailable: "Windows non ha restituito la mappa delle cache di questo processore.",
    dieLabel: "Die {index}",
    dieCache: "{mb} MB L3",
    dieThreads: "{count} thread",
    vcacheBadge: "V-Cache",
    processesTitle: "Processi in esecuzione",
    processesHint: "I più attivi in cima. Scegli il gioco e bloccalo sul die con la cache.",
    refresh: "Aggiorna",
    refreshing: "Lettura...",
    align: "Allinea",
    reset: "Ripristina",
    alignedBadge: "Allineato",
    noProcesses: "Nessun processo abbastanza grande da mostrare.",
    persistenceNote:
      "L'affinità appartiene al processo in esecuzione: alla chiusura del gioco sparisce e va rifatta al lancio successivo. Nessuna impostazione di sistema viene modificata.",
    alignedToast: "{name} bloccato sul die con la V-Cache.",
    resetToast: "{name} riportato su tutti i core.",
  },
  hardware: {
    intro:
      "Letture dirette dai sensori del tuo hardware. Dove un sensore non esiste te lo diciamo, invece di mostrare un numero che nessuno può verificare.",
    gpuLabel: "Scheda video",
    cpuLabel: "Processore",
    liveBadge: "In tempo reale",
    gpuDriver: "Driver {version}",
    load: "Utilizzo GPU",
    vram: "Memoria video",
    fan: "Ventola",
    power: "Consumo",
    fanIdle: "ferma: sotto i 50° non serve",
    powerLimit: "limite {limit} W",
    tempCool: "fresca",
    tempGood: "ottimale",
    tempWarm: "calda",
    tempHot: "molto calda",
    traceLabel: "Andamento sessione",
    traceRange: "min {min}° · max {max}°",
    noTempSensor: "Questa scheda non espone un sensore di temperatura.",
    cpuAcpiSource: "letta dalla zona termica ACPI",
    cpuNoSensor:
      "Il firmware di questo PC non espone una zona termica ACPI, quindi Windows non ha una temperatura della CPU da leggere. I programmi che la mostrano sempre installano un driver a livello kernel per leggere i registri del processore: PC Tweaker non lo fa, e preferisce dirtelo piuttosto che mostrarti un valore inventato.",
    noGpuTool:
      "Nessuna scheda NVIDIA rilevata. AMD e Intel non forniscono uno strumento di interrogazione equivalente, quindi le loro temperature non sono leggibili senza software del produttore.",
    thermalsUnavailable: "Non riusciamo a leggere i sensori su questo sistema.",
    driversTitle: "Età dei driver",
    driversSubtitle:
      "Quanti anni hanno i driver installati dai produttori. Windows sa cosa è installato, non cosa è disponibile: qui trovi l'età reale, mai un falso avviso di aggiornamento.",
    driversRescan: "Rianalizza",
    driversScanning: "Analisi...",
    driversCounted: "{count} driver dei produttori",
    driversAging: "{count} oltre 2 anni",
    driversStale: "{count} oltre 4 anni",
    driversAllCurrent: "Tutti recenti",
    driversNone: "Nessun driver di produttori terzi in queste categorie.",
    driversShowAll: "Mostra gli altri {count}",
    driversShowLess: "Mostra meno",
    driversInboxNote:
      "Esclusi {count} driver Microsoft integrati: li aggiorna Windows Update e la loro data è un segnaposto fisso, quindi contarli come vecchi sarebbe un falso allarme.",
    ageYears: "{years} anni",
    ageYear: "{years} anno",
    ageMonths: "{months} mesi",
    ageMonth: "{months} mese",
    vendorSite: "Sito del produttore",
    watchLabel: "Sotto osservazione da",
    peakLabel: "Picco",
    verdictRisky: "Rischioso",
    verdictNormal: "Normale",
    verdictBetter: "Meglio delle aspettative",
    verdictIdle: "A riposo",
    verdictRiskyHint:
      "La scheda ha superato gli 84°, la soglia oltre la quale riduce da sola le prestazioni per proteggersi. Controlla il flusso d'aria o passa al profilo Silenzioso.",
    verdictNormalHint:
      "Temperature nella norma per una scheda sotto carico: nessun segnale di allarme.",
    verdictBetterHint:
      "È rimasta sotto i 65° pur lavorando davvero: raffreddamento migliore della media.",
    verdictIdleHint:
      "Non ha ancora lavorato abbastanza per dare un giudizio. Una scheda ferma resta fresca comunque, quindi non dimostrerebbe nulla.",
    profilesTitle: "Profili termici",
    profilesSubtitle:
      "Regolano il limite di potenza della scheda, cioè la leva che governa davvero calore e rumore della ventola. Ogni valore viene dai limiti dichiarati dalla scheda stessa.",
    currentLimit: "Ora: {watts} W",
    modeSilent: "Silenzioso",
    modeSilentHint:
      "Per lavoro, streaming e sessioni lunghe: la ventola resta quasi muta e la scheda scalda molto meno, al prezzo di qualche frame.",
    modeStandard: "Standard",
    modeStandardHint:
      "Un limite equilibrato poco sotto il tetto della scheda: ventola più quieta e temperature più basse, con un costo in frame nell'ordine di pochi punti percentuali.",
    modeGaming: "Gaming",
    modeGamingHint:
      "Per le sessioni competitive: watt al massimo e tetto del clock alzato, per tenere più stabili gli FPS minimi nei momenti concitati.",
    modeApplying: "Applico...",
    profileStageReading: "Lettura dei limiti della scheda",
    profileStageApplying: "Applicazione del limite",
    profileStageSettling: "Attesa della risposta delle ventole",
    profileApplied: "Limite impostato a {watts} W.",
    profileNote:
      "Richiede i permessi di amministratore e si azzera al riavvio. Non è una curva della ventola: NVIDIA non espone il controllo diretto della ventola in nvidia-smi, e i programmi che lo offrono usano API private non documentate che questa app non tocca.",
    profileDefaultIsMax:
      "Su questa scheda il limite di potenza di fabbrica coincide già con il massimo, quindi Silenzioso è l'unico profilo che cambia i watt: Gaming si distingue alzando il tetto del clock.",
    driverInstalled: "installato v{version} il {date}",
    driversNoUpdateCheck:
      "Questa schermata non contatta i produttori e non può sapere se esiste una versione più recente: mostra la versione installata e la sua età, e ti porta alla pagina ufficiale per verificarlo tu.",
    driversCheckedAt: "Letto il {time}",
    modeClockLocked: "clock fino a {mhz} MHz",
    modeClockAuto: "clock automatico",
    profileApply: "Applica profilo",
    profileActive: "Profilo attivo",
    profileWillSet: "Imposterà {watts} W, {clock}",
    scanStarting: "Avvio scansione...",
    scanReading: "Lettura classe {class}",
    scanCount: "{done}/{total} · {pct}%",
    driversScannedAll: "{total} driver esaminati in {classes} categorie",
    winUpdateLabel: "Windows Update",
    winUpdateButton: "Cerca su Windows Update",
    winUpdateNote:
      "Questo controlla solo il catalogo di Windows Update, non i driver specifici elencati sopra: molti produttori (soprattutto per audio e chipset integrati) non pubblicano mai i loro aggiornamenti lì, solo sul proprio sito. PC Tweaker non scarica pacchetti driver per conto suo: non esiste un'API dei produttori per sapere qual è la versione giusta per il tuo esatto dispositivo, e installare il driver video sbagliato è uno dei pochi errori che può lasciarti senza schermo.",
    winUpdateOpened: "Windows Update aperto.",
    winUpdateSearching: "Ricerca in corso...",
    winUpdateTakesAWhile: "Può richiedere un minuto: interroga il catalogo Microsoft.",
    winUpdateInstall: "Scarica e installa ({count})",
    winUpdateInstalling: "Download e installazione...",
    winUpdateNone:
      "Windows Update non ha nulla di più recente da offrire, anche per i driver segnati come vecchi qui sopra: molti produttori pubblicano gli aggiornamenti a modo loro, non tramite Windows Update.",
    winUpdateFailed: "Ricerca non riuscita: {detail}",
    winUpdateDone: "Installati {installed}, non riusciti {failed}.",
    rebootTitle: "Windows chiede un riavvio",
    rebootBody:
      "Windows segnala che un'installazione si completa solo al riavvio. Puoi farlo adesso o quando preferisci.",
    rebootNow: "Riavvia ora",
    rebootLater: "Più tardi",
  },
  menu: {
    account: "Account",
    plan: "Piano",
    planFree: "Gratuito",
    planPro: "Pro",
    viewPlan: "Vedi il piano",
    upgradeButton: "Passa a Pro",
    language: "Lingua",
    theme: "Temi",
    about: "Informazioni",
    errorReports: "Report errori anonimi",
    errorReportsBody:
      "Se qualcosa fallisce, invia solo il messaggio di errore (mai dati personali) per aiutarci a correggere i bug. Disattivato di default.",
    changePhoto: "Cambia foto profilo",
    removePhoto: "Rimuovi foto",
    photoFailed: "Impossibile usare questa immagine come foto profilo.",
    support: "Supporto",
    reportIssue: "Segnala un problema",
    aboutBody: "PC Tweaker — tweak di sistema con backup e ripristino automatico.",
    close: "Chiudi",
  },
  auth: {
    login: "Accedi",
    register: "Registrati",
    email: "Email",
    password: "Password",
    loginButton: "Accedi",
    rememberMe: "Ricordami su questo PC",
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
        'Impedisce a Windows di interromperti con i sondaggi "Quanto consiglieresti..." (HKCU, nessuna elevazione richiesta).',
    },
    disable_cortana: {
      name: "Disattiva Cortana",
      description:
        "Disattiva Cortana tramite policy di sistema, liberando le risorse che riserva in background (HKLM, richiede privilegi di amministratore).",
    },
    show_file_extensions: {
      name: "Mostra sempre le estensioni dei file",
      description:
        'Rivela la vera estensione di ogni file. Vale la pena attivarla anche solo per sicurezza: smaschera file come "fattura.pdf.exe" che Windows altrimenti nasconde (HKCU, nessuna elevazione richiesta).',
    },
    hide_taskbar_widgets: {
      name: "Nascondi i Widget dalla barra delle applicazioni",
      description:
        "Rimuove il pulsante Widget (meteo/notizie), che carica contenuti in background anche se non lo apri mai (HKCU, nessuna elevazione richiesta).",
    },
    network_latency: {
      name: "Taglia il ritardo di rete (algoritmo di Nagle)",
      description:
        "Windows trattiene i pacchetti piccoli per qualche millisecondo per raggrupparli, e per giunta ritarda le conferme di ricezione. È un buon compromesso per i download e pessimo per i giochi, dove ogni pacchetto è piccolo e arrivare tardi equivale a non arrivare. Questo disattiva entrambi sulla scheda di rete attiva (HKLM, richiede diritti di amministratore).",
    },
    disable_window_animations: {
      name: "Animazioni finestre istantanee",
      description:
        "Elimina l'animazione di apertura, chiusura e riduzione a icona delle finestre. Quell'animazione è puro tempo di attesa: toglierla fa rispondere il desktop nell'istante in cui clicchi e libera il lavoro GPU dietro di essa (HKCU, nessuna elevazione richiesta).",
    },
    disable_drag_full_windows: {
      name: "Trascinamento finestre più leggero",
      description:
        "Mentre trascini una finestra ne disegna solo il contorno invece di ridisegnarne tutto il contenuto a ogni fotogramma. Quasi impercettibile su una GPU veloce, differenza netta su grafica integrata o su un PC datato (HKCU, nessuna elevazione richiesta).",
    },
    mouse_hover_delay: {
      name: "Risposta immediata al passaggio del mouse",
      description:
        "Windows aspetta 400 ms prima di reagire al puntatore fermo su un elemento: anteprime della barra, suggerimenti, menu. Questo riduce l'attesa quasi a zero, così l'interfaccia segue il mouse invece di inseguirlo (HKCU, nessuna elevazione richiesta).",
    },
    disable_background_apps: {
      name: "Blocca le app in background",
      description:
        "Impedisce alle app dello Store di girare, aggiornarsi e interrogare la rete mentre non le stai usando. Sono CPU, RAM e batteria reali spese per app che non hai aperto (HKCU, nessuna elevazione richiesta).",
    },
    disable_delivery_optimization: {
      name: "Smetti di condividere gli aggiornamenti Windows",
      description:
        "Per impostazione predefinita Windows carica i file di aggiornamento scaricati verso altri PC usando la tua connessione. Questo limita Delivery Optimization al tuo solo computer, così quell'upload non ti mangia banda mentre giochi (HKLM, richiede diritti di amministratore).",
    },
    disable_copilot: {
      name: "Disattiva Windows Copilot",
      description:
        "Rimuove l'assistente Copilot dalla barra e gli impedisce di girare in background. Windows lo attiva di default e nelle Impostazioni non esiste un interruttore definitivo: questo imposta il criterio di sistema che lo spegne per sempre (HKCU, nessuna elevazione richiesta).",
    },
    disable_suggested_apps: {
      name: "Impedisci a Windows di installare app da solo",
      description:
        "Windows installa in silenzio app e giochi “consigliati” nel menu Start senza chiedertelo, all'installazione e di nuovo dopo i grandi aggiornamenti. Questo lo disattiva: sul tuo PC non finisce più niente che non hai scelto tu (HKCU, nessuna elevazione richiesta).",
    },
    disable_mouse_acceleration: {
      name: "Disattiva l'accelerazione del mouse",
      description:
        "Disattiva “Aumenta la precisione del puntatore”, che fa percorrere al cursore più strada quando muovi il mouse velocemente. È esattamente la risposta variabile che non vuoi quando miri: lo stesso gesto deve coprire sempre la stessa distanza sullo schermo (HKCU, nessuna elevazione richiesta).",
    },
    disable_sticky_keys_prompt: {
      name: "Elimina il popup del Filtro tasti",
      description:
        "Premere Maiusc cinque volte apre la finestra del Filtro tasti, che in un gioco significa uscire dallo schermo intero nel momento peggiore, di solito durante uno scontro. Questo disattiva la scorciatoia e il suo avviso; il Filtro tasti resta disponibile nelle Impostazioni (HKCU, nessuna elevazione richiesta).",
    },
    disable_recall: {
      name: "Disattiva Recall (istantanee AI dello schermo)",
      description:
        "Recall cattura lo schermo ogni pochi secondi e costruisce una cronologia indicizzata dall'AI di tutto ciò che hai guardato: password e messaggi privati inclusi, perché registra qualunque cosa sia a schermo. Questo imposta il criterio di sistema che gli impedisce di analizzare o conservare alcunché (HKLM, richiede diritti di amministratore).",
    },
    disable_memory_integrity: {
      name: "Disattiva Integrità della memoria (VBS)",
      description:
        "L'Integrità della memoria esegue parti di Windows dentro un contenitore virtualizzato, e questo costa CPU a ogni transizione verso il kernel: è il motivo per cui disattivarla è il guadagno di frame più grande disponibile gratuitamente. Sia chiaro il compromesso: è una vera funzione di sicurezza, e spegnerla toglie la protezione dai driver malevoli. Ha senso su un PC dedicato al gioco, non su una macchina di lavoro. Ha effetto dopo il riavvio (HKLM, richiede diritti di amministratore).",
    },
    disable_typing_personalization: {
      name: "Impedisci a Windows di studiare come scrivi",
      description:
        "Windows costruisce un dizionario personale da ciò che digiti e scrivi a mano — anche nei gestori di password, nelle chat e nelle caselle di ricerca — e lo sincronizza con il tuo account Microsoft per migliorare i suggerimenti. Questo disattiva sia la raccolta del testo sia quella della scrittura a mano (HKCU, nessuna elevazione richiesta).",
    },
    classic_context_menu: {
      name: "Riporta il menu del tasto destro completo",
      description:
        "Windows 11 nasconde gran parte del menu contestuale dietro “Mostra altre opzioni”, trasformando un clic in due per cose che fai tutto il giorno. Questo ripristina il menu completo di Windows 10 ovunque, in Esplora file e sul desktop. Esplora risorse viene riavviato per applicarlo, quindi le finestre aperte lampeggeranno una volta (HKCU, nessuna elevazione richiesta).",
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
      description:
        "Mostra i file e le cartelle nascosti in Esplora file (HKCU, nessuna elevazione richiesta).",
    },
    priority_separation: {
      name: "Ottimizza priorità processore",
      description:
        "Regola Win32PrioritySeparation (0x26) per dare all'app in primo piano quanti di CPU brevi e variabili con priorità 3x — il classico valore per reattività desktop/gaming (HKLM, richiede privilegi di amministratore).",
    },
    disable_game_dvr: {
      name: "Disattiva Xbox Game Bar / Game DVR",
      description:
        "Disattiva la registrazione in background di Xbox Game Bar, che consuma CPU/GPU durante il gioco (HKCU, nessuna elevazione richiesta).",
    },
    disable_telemetry_tasks: {
      name: "Riduci raccolta dati diagnostici",
      description:
        "Imposta il livello di diagnostica di Windows al minimo consentito (HKLM, richiede privilegi di amministratore).",
    },
    reset_advertising_id: {
      name: "Disattiva ID pubblicità",
      description:
        "Impedisce alle app di usare il tuo ID pubblicitario per la profilazione (HKCU, nessuna elevazione richiesta).",
    },
    disable_location_tracking: {
      name: "Disattiva tracciamento posizione",
      description:
        "Blocca l'accesso alla posizione geografica per tutte le app tramite policy di sistema (HKLM, richiede privilegi di amministratore).",
    },
    disable_bing_search: {
      name: "Disattiva ricerca Bing nel menu Start",
      description:
        "Impedisce che le tue ricerche nel menu Start vengano inviate a Bing (HKCU, nessuna elevazione richiesta).",
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
    keep_kernel_in_ram: {
      name: "Tieni kernel e driver nella RAM",
      description:
        "Windows può spostare su disco parti del kernel e del codice dei driver anche quando la memoria abbonda, e rileggerle è una pausa che senti come uno scatto. Questo li tiene in memoria. Conviene se hai RAM in abbondanza; su un PC con poca memoria lascialo disattivato (HKLM, richiede diritti di amministratore).",
    },
    auto_end_frozen_tasks: {
      name: "Non far bloccare lo spegnimento da un'app freezata",
      description:
        'Quando un programma smette di rispondere durante lo spegnimento, Windows aspetta e mostra la schermata "Questa app impedisce l\'arresto" finché qualcuno non clicca. Questo chiude da solo le app bloccate, così un programma piantato non può lasciare il PC acceso (HKCU, nessuna elevazione richiesta).',
    },
    instant_folder_loading: {
      name: "Apri ogni cartella all'istante",
      description:
        "Esplora file analizza il contenuto di una cartella per indovinare se è Immagini, Musica o Documenti, e una cartella con migliaia di file multimediali può restare bloccata per secondi mentre decide. Questo fissa tutte le cartelle sul layout generale, così si aprono subito (HKCU, nessuna elevazione richiesta).",
    },
    tcp_congestion_bbr: {
      name: "Ping stabile anche con la linea occupata (BBR2)",
      description:
        "Windows usa CUBIC, che accelera finché un buffer da qualche parte non trabocca: è il motivo per cui il ping sale appena qualcun altro in casa scarica qualcosa. BBR2 misura la banda reale e il tempo di andata e ritorno della linea e regola il ritmo di conseguenza, così il tubo si riempie senza riempire la coda. Microsoft include BBR2 in Windows 11; questo passa il profilo Internet a BBR2 e sa tornare esattamente a com'era (richiede diritti di amministratore).",
    },
    taskbar_align_left: {
      name: "Allinea la barra delle applicazioni a sinistra",
      description:
        "Riporta le icone della taskbar allineate a sinistra (stile Windows 10) invece che al centro (HKCU, nessuna elevazione richiesta).",
    },
    hide_taskbar_chat: {
      name: "Nascondi Chat/Teams dalla barra delle applicazioni",
      description:
        "Rimuove l'icona Chat (Microsoft Teams) dalla taskbar (HKCU, nessuna elevazione richiesta).",
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
      description:
        "Sposta nel Cestino i pacchetti di Windows Update già installati (richiede privilegi di amministratore).",
    },
  },
};

const en: Strings = {
  appName: "PC Tweaker",
  appliedCount: "{applied} of {total} tweaks active",
  headerNote:
    "Every tweak backs up the original value before it's applied. Tweaks that need elevated rights ask for an explicit UAC prompt, only for that action.",
  advisor: {
    eyebrow: "Recommended for your PC",
    applyButton: "Apply",
    confidenceHigh: "High confidence — based on this PC's hardware",
    confidenceStandard: "Recommended for this machine type",
    reversible: "Reversible — the original value is saved before any change.",
    empty: "Nothing to recommend right now — your setup already matches our advice.",
  },
  drift: {
    titleAfterUpdate: "Windows changed your settings back",
    titleNoUpdate: "Some settings are no longer in effect",
    afterUpdateOne:
      "After updating to {patch}, one tweak you had applied is no longer in effect on the system.",
    afterUpdateMany:
      "After updating to {patch}, {count} tweaks you had applied are no longer in effect on the system.",
    noUpdateOne:
      "One tweak you had applied is no longer in effect on the system. No Windows update happened in between, so something else changed it.",
    noUpdateMany:
      "{count} tweaks you had applied are no longer in effect on the system. No Windows update happened in between, so something else changed them.",
    reapplyOne: "Re-apply the tweak",
    reapplyMany: "Re-apply {count} tweaks",
    reapplying: "Re-applying...",
    reappliedOne: "Tweak re-applied.",
    reappliedMany: "{count} tweaks re-applied.",
  },
  crashes: {
    title: "Unexpected shutdowns",
    subtitle:
      "The app closed on its own. The report stays on this PC: copy it and send it over on Discord or GitHub if you want it fixed.",
    copy: "Copy report",
    copied: "Report copied to the clipboard.",
    clear: "Clear",
    cleared: "Reports cleared.",
    processApp: "main window",
    processElevated: "admin-rights operation",
  },
  ledger: {
    title: "Change Ledger",
    subtitle:
      "Everything this app changed on this PC, newest first. Stored locally, never uploaded.",
    empty: "No changes recorded yet. Apply your first tweak and it will appear here.",
    clear: "Clear history",
    clearing: "Clearing...",
    cleared: "History cleared.",
    revert: "Revert",
    elevated: "with admin rights",
    failed: "failed",
    actions: {
      applied: "Tweak applied",
      reverted: "Tweak reverted",
      cleanup: "Cleanup",
      filesDeleted: "Files deleted",
      diskOptimize: "Disk optimization",
      startupChange: "Startup change",
      restorePoint: "Restore point",
    },
  },
  tabs: {
    groupMonitor: "Monitor",
    groupOptimize: "Optimize",
    groupManage: "Manage",
    scan: "Scan",
    health: "PC Health",
    hardware: "Hardware",
    performance: "Performance",
    privacy: "Privacy",
    ui: "UI",
    manutenzione: "Maintenance",
    gaming: "Gaming",
    startup: "Startup",
    profiles: "Configurations",
    pricing: "Plans & pricing",
    ledger: "History",
  },
  healthPanel: {
    title: "PC Health",
    subtitle: "An explainable score: every number shows the facts it was computed from.",
    why: "Why {score}?",
    refresh: "Recompute",
    compute: "Compute health score",
    showMore: "Show more",
    showLess: "Show less",
    stageProfile: "Reading system profile",
    stageTweaks: "Checking applied tweaks",
    stageSecurity: "Reading security state",
    stageScoring: "Scoring",
    verdictExcellent: "EXCELLENT",
    verdictGood: "GOOD",
    verdictFair: "FAIR",
    verdictNeedsWork: "NEEDS WORK",
    computing: "Analyzing...",
    idleHint:
      "Nothing runs in the background: the score is computed only when you ask, entirely on this PC.",
    baselineTitle: "Baseline",
    baselineHint: "Quick, repeatable measurements — only comparable to previous runs on this PC.",
    baselineRun: "Run baseline",
    baselineRunning: "Measuring (~5 s)...",
    baselineEmpty: "No baselines yet. Run one before applying changes, and one after.",
    changeSinceLast: "since your last check",
    changeNone: "No change since your last check.",
    changeFirstRun: "First measurement recorded. Run it again after a change to see what moved.",
    changeWhyTitle: "Why the score changed",
    changeContributes: "Contribution to the overall score:",
    changeStructural:
      "An app update changed which categories are scored — part of this difference did not come from your PC.",
    changeTrend: "Trend",
    categories: {
      performance: "Performance",
      gaming: "Gaming",
      responsiveness: "Responsiveness",
      memory: "Memory",
      storage: "Storage",
      startup: "Startup",
      maintenance: "Maintenance",
      privacy: "Privacy",
      security: "Security",
    },
  },
  transparency: {
    title: "What this changes, exactly",
    key: "Key",
    value: "Value",
    setsTo: "Sets to",
    note: "The previous value is saved before writing, so rollback restores it exactly as it was.",
    kindRegistry: "Registry",
    kindCommand: "Command",
    kindService: "Service",
    copy: "Copy",
    copied: "Copied",
  },
  command: {
    statusQuiet: "All systems quiet",
    statusScanning: "Scanning...",
    statusFindings: "{count} recommendations ready",
    domainsLine: "Startup · Storage · Memory · Privacy · Performance · Updates",
    consent: "Nothing changes without your approval.",
    runScan: "Run system scan",
    reviewFindings: "Review {count} recommendations",
    memTitle: "Memory pressure",
    pressureLow: "Low",
    pressureElevated: "Elevated",
    pressureHigh: "High",
    memReview: "Review memory use",
    memTopTitle: "Top processes",
    trimTitle: "Trim working sets",
    trimExplainer:
      "Asks Windows to move idle pages out of app working sets (EmptyWorkingSet). Useful under high pressure; apps may briefly reload pages on next use. No data is lost.",
    trimButton: "Trim now",
    autoTitle: "Automatic trim",
    profilesTitle: "Session profiles",
    profileGame: "Game Session",
    profileGameDesc: "Prepares the PC for play: power, priority and DVR capture.",
    profileFocus: "Focus",
    profileFocusDesc: "Fewer distractions, non-essential activity under control.",
    profileQuiet: "Quiet Session",
    profileQuietDesc: "Efficiency, battery and low noise first.",
    profileDownload: "Download Session",
    profileDownloadDesc: "Controls bandwidth and background activity.",
    previewBtn: "Preview changes",
    gameChange1: "Turns off Game DVR (background capture)",
    gameChange2: "Switches to the High performance power plan",
    gameChange3: "Optimizes CPU priority for games (Win32PrioritySeparation)",
    previewReq: "Requires administrator rights · Pro feature",
    previewCost: "Potential cost: higher power draw and heat while active.",
    previewRevert: "One-click reversible: every original value is saved first.",
    applySession: "Start session",
    restoreSession: "Restore",
    statusActive: "Active",
    statusOff: "Not active",
    soon: "Coming soon",
  },
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
    refresh: "Refresh",
    refreshing: "Rescanning...",
    hiddenOrphans: "{count} entries hidden: the program is no longer installed.",
  },
  search: {
    placeholder: "Search a tweak...",
    noResults: 'No results for "{query}".',
    clear: "Clear",
  },
  pricing: {
    eyebrow: "Unlock everything",
    title: "Choose how hard you push",
    subtitle:
      "Every change snapshots what was there first, so anything you try here is one click from undone. Free covers the essentials; Pro opens the rest.",
    monthly: "Monthly",
    annual: "Yearly",
    lifetime: "Lifetime",
    saveBadge: "SAVE {percent}%",
    perMonth: "/month",
    perYear: "/year",
    once: "one-time",
    lifetimeDetail:
      "Paid once, yours for good. It pays for itself in {months} months against the annual plan, and costs nothing after that",
    annualDetail: "That’s {monthly} a month, charged {yearly} once a year",
    annualNudge: "On the yearly plan it would be {price} a month",
    mostChosen: "MOST CHOSEN",
    freeName: "Free",
    freeTagline: "Everything you need for a cleaner, snappier PC.",
    freePriceNote: "Free forever, no expiry",
    freeCta: "You’re on the Free plan",
    freeCurrent: "Current plan",
    proName: "Pro",
    proTagline:
      "Every tweak, including the ones that need admin rights and the ones you'd otherwise apply by hand in the registry.",
    proCta: "Go Pro",
    proCurrent: "Your plan",
    manageBilling: "Manage subscription",
    everythingInFree: "Everything in Free, plus:",
    reassurance:
      "Cancel anytime. Every change stays one click away from being undone, even after you cancel.",
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
  driverBooster: {
    title: "Driver Booster",
    subtitle: "Pick the drivers that are falling behind and open all their download pages at once.",
    scan: "Scan drivers",
    scanning: "Scanning...",
    selectAll: "Select all",
    selectNone: "Clear selection",
    selectedCount: "{selected} of {total} selected",
    pagesForSelection: "{pages} pages to open",
    openSelected: "Open download pages ({count})",
    opened: "{count} pages opened",
    openedCapped:
      "Opened {opened} of {total} pages: the rest stay selected, run it again to open them.",
    allCurrent: "No driver is showing its age.",
    nothingActionable: "No ageing driver has a vendor page to open.",
    note: "PC Tweaker does not download driver packages on its own: there is no vendor API that says which version is right for your exact device, and installing the wrong display driver is one of the few mistakes that can leave you with no screen. This automates the tedious part — finding the pages — not the choice. For drivers Windows Update genuinely knows about, use the button above.",
  },
  secureDefrag: {
    title: "Secure Defragmentation",
    willDefrag: "This drive is mechanical: a real defragmentation pass will run.",
    willRetrim:
      "This drive is not confirmed mechanical: the whole volume is analysed, then a retrim runs instead of a defragmentation. The retrim takes seconds and only concerns free space — that is what it is: it tells the controller which blocks are no longer in use so it can reuse them without slowing down. Defragmenting an SSD does not speed it up, it only wears it out.",
    start: "Start",
    running: "Running...",
    working: "Working...",
    phaseAnalyze: "Analysing",
    phaseOptimize: "Optimising",
    analysisTitle: "Analysis report",
    doneDefrag: "Defragmentation complete.",
    doneRetrim: "Retrim complete.",
    note: "A System Restore point is taken first. The percentage comes from Windows itself, not from a timer.",
  },
  zeroTrace: {
    title: "Zero-Trace Cleaner",
    subtitle:
      "Clears what closed programs leave behind in memory, and destroys files beyond recovery.",
    purgeTitle: "Memory purge",
    purgeBody:
      "Windows keeps the pages of closed programs in RAM as cache. This releases them, so fragments left by a process that exited are genuinely gone from physical memory.",
    purgeButton: "Purge memory",
    purging: "Purging...",
    purgeResult: "Freed {freed} MB — {after} MB now free",
    purgeLimit:
      "It does not touch the pagefile or hibernation file: those are on disk, and Windows offers no runtime API to scrub them.",
    shredTitle: "Secure file shredder",
    shredBody:
      "Overwrites the file’s contents in three passes before deleting it, putting it beyond ordinary undelete tools.",
    shredButton: "Choose files...",
    shredding: "Shredding...",
    shredDone: "{count} files destroyed ({size})",
    shredSummary: "{shredded} destroyed, {skipped} skipped",
    shredWarning: "Permanent: no Recycle Bin, no recovery.",
    ssdCaveat:
      "On an SSD, wear levelling almost always writes to different cells than the original. The old cells are freed, not rewritten — only the drive’s own secure-erase can guarantee more.",
  },
  hud: {
    title: "Gaming overlay",
    subtitle:
      "A transparent panel over your game: CPU/GPU load, temperatures, VRAM, the active process with its scheduling priority, and a bottleneck indicator.",
    fpsAbout:
      "Frame rate is counted from the present events Windows emits for every frame — the same source PresentMon reads, with nothing hooked into the game. It needs administrator, because opening a trace session is a privileged operation.",
    fpsLowExplained:
      "Beside the average there is DROP: the rate of the worst one percent of frames, the figure elsewhere called the 1% low. It is the number that moves when a game stutters, while the average stays high and says nothing. The closer DROP sits to the average, the smoother the game.",
    fpsStart: "Measure FPS",
    fpsStop: "Stop measuring",
    fpsNeedsAdmin: "Measuring frame rate needs PC Tweaker started as administrator.",
    fpsRunning:
      "Measuring: the frame rate appears in the overlay as soon as a game starts drawing.",
    show: "Show",
    hide: "Hide",
    lock: "Lock",
    unlock: "Unlock",
    dragHint: "Drag the overlay where you want it, then lock it before starting the game.",
    lockedHint: "Locked: clicks pass through it to the game. Unlock it to move it again.",
    sizeCompact: "Compact",
    sizeNormal: "Normal",
  },
  updater: {
    title: "Update available: v{version}",
    body: "Downloads and installs in one step; the app restarts itself when done.",
    install: "Install and restart",
    later: "Later",
    downloading: "Downloading... {percent}%",
    installing: "Installing...",
    error: "Update failed: {message}",
    checkFailed: "Update check failed: {message}",
  },
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
    loadLabel: "CPU LOAD",
    stageReading: "Reading the power plan",
    stageRaising: "Raising the boost ceiling",
    stageApplying: "Applying to the system",
    modeAggressive: "Aggressive mode",
    modeDefault: "Default mode",
    stageMeasuringBefore: "Measuring before",
    stageMeasuringAfter: "Measuring again",
    gainMeasured: "{factor}x faster",
    gainSlight: "{factor}x faster - a modest gain",
    gainAtCeiling: "Already at full speed: this CPU had no headroom left to unlock",
    ceilingLocked: "Boost ceiling locked",
    ceilingUnlocked: "Boost ceiling unlocked",
  },
  profiles: {
    title: "Configurations",
    subtitle: "Save how you set this PC up, reapply it in one click, or hand it to someone else.",
    saveHeading: "Save the current one",
    namePlaceholder: "Name (e.g. Gaming)",
    saveButton: "Save",
    savedHeading: "Saved",
    empty: "No saved configurations yet.",
    tweakCount: "{count} tweaks",
    apply: "Apply",
    applying: "Applying...",
    exportButton: "Export",
    importButton: "Import from file",
    deleteButton: "Delete",
    savedToast: 'Configuration "{name}" saved',
    appliedToast: "{count} tweaks applied",
    exportedToast: "File exported",
    importedToast: "Imported: {count} tweaks ready to review",
    droppedWarning: "{count} entries this version doesn't recognise were dropped",
    nameRequired: "Give the configuration a name",
    reviewNotice: "An imported configuration is never applied on its own — you review it first.",
    signInRequired: "Sign in or create an account to save configurations.",
  },
  scan: {
    title: "Quick scan",
    subtitle:
      "Checks your PC's status and finds optimizations that aren't active yet, in one click.",
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
    verdictRecommended: "Recommended on this PC",
    verdictNotRecommended: "Not recommended on this PC",
    verdictUnsupported: "Not supported",
    reasons: {
      laptop_battery: "this PC is a laptop: it costs more battery than it gives back",
      hdd_index_cost: "the system disk is mechanical, so background indexing is genuinely felt",
      fast_disk_no_gain: "the system disk is NVMe, fast enough to make the saving negligible",
      needs_win10_2004: "requires Windows 10 version 2004 or newer",
      weak_gpu: "integrated graphics: transparency costs performance they could use",
    },
    thisPc: "This PC",
    dashDrivesTitle: "Storage",
    dashFreeOf: "{free} free of {total}",
    dashAlmostFull: "Almost full",
    dashStartupTitle: "Startup apps",
    dashStartupCount: "{on} of {total} enabled",
    dashManage: "Manage",
    dashUptimeTitle: "Up for",
    dashUptimeDh: "{days}d {hours}h",
    dashUptimeHm: "{hours}h {minutes}min",
    dashUptimeLongHint:
      "This PC hasn't restarted in a while. A restart applies pending updates and releases held memory.",
    dashHistoryTitle: "Recent actions",
    dashHistoryEmpty: "Nothing yet. Actions you take will show up here.",
    dashActTweakApplied: "Tweak applied",
    dashActTweakReverted: "Tweak reverted",
    dashActCleanup: "Cleanup",
    dashActFilesDeleted: "Files deleted",
    dashActStartupChange: "Startup changed",
    dashActDiskOptimize: "Disk optimized",
    dashActRestorePoint: "Restore point",
    profileUnknown: "Not detected",
    diskHdd: "HDD",
    diskSsd: "SSD",
    diskNvme: "NVMe",
    formDesktop: "Desktop",
    formLaptop: "Laptop",
    groupRecommended: "Recommended for this PC",
    groupOptional: "Optional",
    groupNotRecommended: "Not recommended here",
    tailoredNote: "Each item is judged against the hardware above, not against a fixed list.",
    fixRecommended: "Apply the {count} recommended",
    fixEverything: "Apply selected ({count})",
    nothingSelected: "Nothing selected",
    foundHeadline: "{count} worth fixing on this PC",
    foundNone: "Nothing to fix",
    doneTitle: "Done!",
    doneBody: "{count} optimizations applied. Your PC is all set.",
    fixHeading: "Ready to apply",
  },
  ram: {
    title: "Free up RAM",
    subtitle:
      "Asks Windows to release memory that programs are holding but not using. Run it as often as you like.",
    button: "Free now",
    cleaning: "Cleaning up...",
    freed: "Freed {amount}",
    freedNothing: "Memory was already optimized",
    inUse: "{used} of {total} in use",
    autoLabel: "Automatic cleanup",
    autoOff: "Off",
    autoEvery: "Every {interval}",
    autoHint:
      "With automatic cleanup on, PC Tweaker frees RAM by itself at a regular interval for as long as the app stays open.",
    autoNext: "Next cleanup at {time}",
    autoDue: "Cleanup due now...",
    autoLast: "Last at {time}: {amount} freed",
    autoNoneYet: "No automatic cleanup has run yet.",
    autoFailed: "The last attempt failed: {detail}",
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
    previewLoading: "Working out what will move to the Recycle Bin...",
    previewEmpty: "Nothing to clean - the folder is already empty.",
    previewNotAccessible:
      "The contents can't be read without administrator rights; the authorized process will list and remove them.",
    previewTruncated: "Showing the 500 largest items; totals include everything.",
    selectedSummary: "{count} items selected · {size}",
    confirmSelected: "Clean selected",
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
    description:
      "Runs Windows' own built-in optimizer: defragmentation on an HDD, or TRIM on an SSD (never a full defrag, which would only wear it out for no benefit).",
    button: "Optimize now",
    running: "Optimizing... this can take a few minutes",
    resultToast: "Drive ({media}) optimized successfully.",
  },
  dnsFlush: {
    title: "Flush DNS cache",
    description:
      "Clears cached DNS lookups. Useful if a site changed servers and your browser keeps showing the old version.",
    button: "Flush now",
    running: "Flushing...",
    resultToast: "DNS cache flushed.",
  },
  browserCleanup: {
    title: "Browser cleanup",
    description:
      "Clears cache and cookies for Chrome, Edge and Firefox. The browser rebuilds them on its own next launch, so nothing is lost for good.",
    noneFound: "No supported browser found on this PC.",
    cache: "Cache",
    cookies: "Cookies",
    clearButton: "Clear",
    clearing: "Clearing...",
    runningWarning: "Close {browser} to clear it.",
    clearedToast: "{browser}: {freed} freed.",
  },
  redaxaPromo: {
    title: "Redaxa",
    description:
      "You've cut telemetry and tracking — but what do you paste into AI chats? Redaxa catches personal data and credentials before a prompt reaches any model. Same family, same rule: nothing gets stored.",
    button: "Try it on the web",
  },
  uninstallerPromo: {
    title: "PC Tweaker Uninstaller",
    description:
      "Remove entire programs safely: automatic restore point, verified command, honest report. From the same family as PC Tweaker.",
    button: "Learn more",
  },
  largeFiles: {
    title: "Find large files",
    description:
      "Scans a folder for its biggest files (over 100 MB), so you can quickly free up space by removing the ones you no longer need.",
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
    description:
      "Pick a folder: find identical files and choose which ones to move to the Recycle Bin.",
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
    licenseNeedsRefresh:
      "We can't verify your Pro subscription after this long offline. Reconnect to the internet and try again.",
    accountRefreshFailed:
      "We couldn't verify your account status. What's shown here may be out of date — check your connection or try again later.",
  },
  titlebar: {
    applied: "{applied}/{total} active",
    cpu: "CPU",
    ram: "RAM",
    minimize: "Minimise",
    maximize: "Maximise",
    restore: "Restore",
    close: "Close",
  },
  x3d: {
    title: "3D V-Cache die aligner",
    subtitle:
      "On a two-die Ryzen X3D only one die carries the stacked cache. Windows does not know which, and spreads a game across both - every access that crosses the dies pays an Infinity Fabric round trip.",
    cpuLabel: "Processor",
    readyHeadline: "V-Cache die found: {cores} threads",
    readyBody: "Pin a game to this die and every one of its threads stays where the cache is.",
    singleDie:
      "This processor has a single die: every core already sees the same cache, so there is nothing to align. The feature appears on its own on a two-die CPU with an asymmetric cache.",
    uniformCache:
      "This processor has several dies, all with the same amount of cache. Moving a game between them would change nothing, so the feature stays off.",
    unavailable: "Windows did not return a cache map for this processor.",
    dieLabel: "Die {index}",
    dieCache: "{mb} MB L3",
    dieThreads: "{count} threads",
    vcacheBadge: "V-Cache",
    processesTitle: "Running processes",
    processesHint: "Busiest first. Pick the game and pin it to the cache die.",
    refresh: "Refresh",
    refreshing: "Reading...",
    align: "Align",
    reset: "Reset",
    alignedBadge: "Aligned",
    noProcesses: "No process large enough to be worth listing.",
    persistenceNote:
      "Affinity belongs to the running process: it is gone when the game closes and has to be set again on the next launch. No system setting is changed.",
    alignedToast: "{name} pinned to the V-Cache die.",
    resetToast: "{name} returned to every core.",
  },
  hardware: {
    intro:
      "Read straight from your hardware's own sensors. Where a sensor doesn't exist we say so, instead of showing a number nobody can verify.",
    gpuLabel: "Graphics card",
    cpuLabel: "Processor",
    liveBadge: "Live",
    gpuDriver: "Driver {version}",
    load: "GPU usage",
    vram: "Video memory",
    fan: "Fan",
    power: "Power draw",
    fanIdle: "stopped: not needed below 50°",
    powerLimit: "{limit} W limit",
    tempCool: "cool",
    tempGood: "healthy",
    tempWarm: "warm",
    tempHot: "running hot",
    traceLabel: "This session",
    traceRange: "min {min}° · max {max}°",
    noTempSensor: "This card exposes no temperature sensor.",
    cpuAcpiSource: "read from the ACPI thermal zone",
    cpuNoSensor:
      "This PC's firmware exposes no ACPI thermal zone, so Windows has no CPU temperature to read. Tools that always show one install a kernel-level driver to read the processor's registers directly: PC Tweaker doesn't, and would rather tell you that than show you a number it made up.",
    noGpuTool:
      "No NVIDIA card detected. AMD and Intel ship no equivalent query tool, so their temperatures can't be read without the vendor's own software.",
    thermalsUnavailable: "We can't read the sensors on this system.",
    driversTitle: "Driver age",
    driversSubtitle:
      "How old your vendor-supplied drivers are. Windows knows what's installed, not what's available: this reports the age it can prove, never a fake update notice.",
    driversRescan: "Rescan",
    driversScanning: "Scanning...",
    driversCounted: "{count} vendor drivers",
    driversAging: "{count} over 2 years",
    driversStale: "{count} over 4 years",
    driversAllCurrent: "All recent",
    driversNone: "No third-party vendor drivers in these categories.",
    driversShowAll: "Show {count} more",
    driversShowLess: "Show less",
    driversInboxNote:
      "{count} Microsoft inbox drivers excluded: Windows Update services them and their date is a fixed placeholder, so counting them as old would be a false alarm.",
    ageYears: "{years} years",
    ageYear: "{years} year",
    ageMonths: "{months} months",
    ageMonth: "{months} month",
    vendorSite: "Vendor site",
    watchLabel: "Watching for",
    peakLabel: "Peak",
    verdictRisky: "Risky",
    verdictNormal: "Normal",
    verdictBetter: "Better than expected",
    verdictIdle: "Idle",
    verdictRiskyHint:
      "The card passed 84°, the point where it starts cutting its own performance to protect itself. Check airflow, or switch to the Silent profile.",
    verdictNormalHint: "Temperatures in the usual range for a card under load: nothing alarming.",
    verdictBetterHint: "It stayed under 65° while genuinely working: better cooling than most.",
    verdictIdleHint:
      "It hasn't worked hard enough yet to judge. An idle card runs cool regardless, so that would prove nothing.",
    profilesTitle: "Thermal profiles",
    profilesSubtitle:
      "These set the card's power limit, the lever that actually governs heat and fan noise. Every value comes from the limits the card itself reports.",
    currentLimit: "Now: {watts} W",
    modeSilent: "Silent",
    modeSilentHint:
      "For work, streaming and long sessions: the fan stays close to silent and the card runs far cooler, at the cost of a few frames.",
    modeStandard: "Standard",
    modeStandardHint:
      "A balanced cap a little under the card's ceiling: quieter fan and lower temperatures, for a frame cost in the low single digits.",
    modeGaming: "Gaming",
    modeGamingHint:
      "For competitive sessions: watts at maximum and a raised clock ceiling, to hold your 1% lows steadier when it matters.",
    modeApplying: "Applying...",
    profileStageReading: "Reading the card's limits",
    profileStageApplying: "Applying the limit",
    profileStageSettling: "Waiting for the fans to respond",
    profileApplied: "Limit set to {watts} W.",
    profileNote:
      "Needs administrator rights and resets on reboot. This is not a fan curve: NVIDIA exposes no direct fan control in nvidia-smi, and the tools that offer one use private, undocumented APIs this app does not touch.",
    profileDefaultIsMax:
      "On this card the factory power limit already equals the maximum, so Silent is the only profile that changes the wattage: Gaming differs by raising the clock ceiling instead.",
    driverInstalled: "installed v{version} on {date}",
    driversNoUpdateCheck:
      "This screen contacts no vendor and cannot know whether a newer version exists: it shows the installed version and its age, and takes you to the official page to check for yourself.",
    driversCheckedAt: "Read at {time}",
    modeClockLocked: "clock up to {mhz} MHz",
    modeClockAuto: "automatic clock",
    profileApply: "Apply profile",
    profileActive: "Profile active",
    profileWillSet: "Will set {watts} W, {clock}",
    scanStarting: "Starting scan...",
    scanReading: "Reading class {class}",
    scanCount: "{done}/{total} · {pct}%",
    driversScannedAll: "{total} drivers examined across {classes} categories",
    winUpdateLabel: "Windows Update",
    winUpdateButton: "Check Windows Update",
    winUpdateNote:
      "This only checks Windows Update's own catalogue, not the specific drivers listed above: many vendors - onboard audio and chipset ones especially - never publish updates there, only on their own site. PC Tweaker does not download driver packages itself: there is no vendor API for what is current for your exact device, and installing the wrong display driver is one of the few mistakes that can leave you without a screen.",
    winUpdateOpened: "Windows Update opened.",
    winUpdateSearching: "Searching...",
    winUpdateTakesAWhile: "This can take a minute - it queries Microsoft's catalogue.",
    winUpdateInstall: "Download and install ({count})",
    winUpdateInstalling: "Downloading and installing...",
    winUpdateNone:
      "Windows Update has nothing newer to offer, even for drivers shown as old above: many vendors publish updates their own way, not through Windows Update.",
    winUpdateFailed: "Search failed: {detail}",
    winUpdateDone: "Installed {installed}, failed {failed}.",
    rebootTitle: "Windows is asking for a restart",
    rebootBody:
      "Windows reports that an installation only finishes after a restart. You can do it now or whenever suits you.",
    rebootNow: "Restart now",
    rebootLater: "Later",
  },
  menu: {
    account: "Account",
    plan: "Plan",
    planFree: "Free",
    planPro: "Pro",
    viewPlan: "View your plan",
    upgradeButton: "Upgrade to Pro",
    language: "Language",
    theme: "Themes",
    about: "About",
    errorReports: "Anonymous error reports",
    errorReportsBody:
      "When something fails, send only the error message (never personal data) to help us fix bugs. Off by default.",
    changePhoto: "Change profile photo",
    removePhoto: "Remove photo",
    photoFailed: "Could not use that image as a profile photo.",
    support: "Support",
    reportIssue: "Report an issue",
    aboutBody: "PC Tweaker — system tweaks with automatic backup and rollback.",
    close: "Close",
  },
  auth: {
    login: "Log in",
    register: "Sign up",
    email: "Email",
    password: "Password",
    loginButton: "Log in",
    rememberMe: "Keep me signed in",
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
    network_latency: {
      name: "Cut network delay (Nagle's algorithm)",
      description:
        "Windows holds small packets back for a few milliseconds to bundle them together, and delays acknowledgements on top. That is a good trade for downloads and a bad one for games, where every packet is small and late is the same as lost. This turns both off on your active adapter (HKLM, requires administrator rights).",
    },
    disable_window_animations: {
      name: "Instant window animations",
      description:
        "Removes the slide/fade animation Windows plays every time a window opens, closes or minimizes. The animation is pure waiting time - cutting it makes the desktop respond the moment you click, and frees the GPU work behind it (HKCU, no elevation required).",
    },
    disable_drag_full_windows: {
      name: "Lighter window dragging",
      description:
        "Draws an outline while you drag a window instead of repainting its whole contents every frame. Barely noticeable on a fast GPU, a clear difference on integrated graphics or an older machine (HKCU, no elevation required).",
    },
    mouse_hover_delay: {
      name: "Instant mouse hover response",
      description:
        "Windows waits 400 ms before reacting to the pointer resting on something - taskbar previews, tooltips, menu hovers. This drops that wait to almost nothing, so the interface follows the mouse instead of trailing it (HKCU, no elevation required).",
    },
    disable_background_apps: {
      name: "Stop apps running in the background",
      description:
        "Stops Store apps from running, refreshing and polling the network while you are not using them. This is real CPU, RAM and battery spent on apps you did not open (HKCU, no elevation required).",
    },
    disable_delivery_optimization: {
      name: "Stop sharing Windows updates with strangers",
      description:
        "Windows uploads downloaded update files to other PCs over your connection by default. This limits Delivery Optimization to your own machine, which stops that upload eating bandwidth mid-game (HKLM, requires administrator rights).",
    },
    disable_copilot: {
      name: "Disable Windows Copilot",
      description:
        "Removes the Copilot assistant from the taskbar and stops it running in the background. Windows ships it enabled and there is no permanent off switch in Settings — this sets the system policy that turns it off for good (HKCU, no elevation required).",
    },
    disable_suggested_apps: {
      name: "Stop Windows installing apps by itself",
      description:
        "Windows quietly installs “suggested” apps and games into your Start menu without asking, on a fresh install and again after big updates. This turns that off, so nothing lands on your machine that you didn't choose (HKCU, no elevation required).",
    },
    disable_mouse_acceleration: {
      name: "Disable mouse acceleration",
      description:
        "Turns off “Enhance pointer precision”, which makes the cursor travel further when you move the mouse faster. That variable response is exactly what you don't want when aiming: the same physical flick should always cover the same distance on screen (HKCU, no elevation required).",
    },
    disable_sticky_keys_prompt: {
      name: "Stop the Sticky Keys popup",
      description:
        "Tapping Shift five times normally opens the Sticky Keys dialog — which in a game means an alt-tab out of fullscreen at the worst possible moment, usually mid-fight. This disables the shortcut and its prompt; Sticky Keys itself stays available in Settings (HKCU, no elevation required).",
    },
    disable_recall: {
      name: "Disable Recall (AI screen snapshots)",
      description:
        "Recall takes a screenshot of your desktop every few seconds and builds a searchable, AI-indexed history of everything you have looked at — passwords and private messages included, since it captures whatever is on screen. This sets the system policy that stops it analysing or storing anything (HKLM, requires administrator rights).",
    },
    disable_memory_integrity: {
      name: "Disable Memory Integrity (VBS)",
      description:
        "Memory Integrity runs parts of Windows inside a hardware-virtualised container, which costs CPU on every kernel transition — the reason it is the single biggest free frame-rate gain on most gaming machines. Be clear about the trade: it is a real security feature, and turning it off removes protection against malicious drivers. Worth it on a dedicated gaming PC, not on a work machine. Takes effect after a restart (HKLM, requires administrator rights).",
    },
    disable_typing_personalization: {
      name: "Stop Windows learning how you type",
      description:
        "Windows builds a personal dictionary from what you type and handwrite — including in password managers, chat windows and search boxes — and syncs it to your Microsoft account to improve its suggestions. This turns off both the text and the handwriting collection (HKCU, no elevation required).",
    },
    classic_context_menu: {
      name: "Bring back the full right-click menu",
      description:
        "Windows 11 hides most of the right-click menu behind “Show more options”, turning one click into two for things you do all day. This restores the complete Windows 10 menu everywhere in File Explorer and on the desktop. Explorer restarts to apply it, so open windows will flicker once (HKCU, no elevation required).",
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
      description:
        "Tunes Win32PrioritySeparation (0x26) so the foreground app gets short, variable CPU time slices with a 3x priority boost — the classic desktop/gaming responsiveness value (HKLM, requires administrator rights).",
    },
    disable_game_dvr: {
      name: "Disable Xbox Game Bar / Game DVR",
      description:
        "Turns off Xbox Game Bar's background recording, which eats CPU/GPU while gaming (HKCU, no elevation required).",
    },
    disable_telemetry_tasks: {
      name: "Reduce diagnostic data collection",
      description:
        "Sets Windows' diagnostic data level to the minimum allowed (HKLM, requires administrator rights).",
    },
    reset_advertising_id: {
      name: "Disable advertising ID",
      description:
        "Stops apps from using your advertising ID for profiling (HKCU, no elevation required).",
    },
    disable_location_tracking: {
      name: "Disable location tracking",
      description:
        "Blocks location access for all apps via system policy (HKLM, requires administrator rights).",
    },
    disable_bing_search: {
      name: "Disable Bing search in the Start menu",
      description:
        "Stops your Start menu searches from being sent to Bing (HKCU, no elevation required).",
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
    keep_kernel_in_ram: {
      name: "Keep the kernel and drivers in RAM",
      description:
        "Windows may page parts of the kernel and driver code out to disk even when memory is plentiful, and paging them back in is a stall you feel as a stutter. This keeps them resident. Worth it on machines with RAM to spare; on a low-memory PC leave it off (HKLM, requires administrator rights).",
    },
    auto_end_frozen_tasks: {
      name: "Don't let a frozen app block shutdown",
      description:
        'When an application stops responding during shutdown, Windows waits and shows the "This app is preventing shutdown" screen until someone clicks it. This closes unresponsive apps automatically instead, so a hung program cannot leave the machine sitting powered on (HKCU, no elevation required).',
    },
    instant_folder_loading: {
      name: "Open every folder instantly",
      description:
        "Explorer inspects a folder's contents to guess whether it is Pictures, Music or Documents, and a folder holding thousands of media files can hang for seconds while it decides. This pins every folder to the general layout so it opens at once (HKCU, no elevation required).",
    },
    tcp_congestion_bbr: {
      name: "Keep latency low when the line is busy (BBR2)",
      description:
        "Windows uses CUBIC, which speeds up until a buffer somewhere overflows - which is why your ping climbs the moment someone else in the house starts a download. BBR2 measures the line's real bandwidth and round trip instead and paces traffic to fit, so the pipe fills without the queue filling. Microsoft ships BBR2 in Windows 11; this switches the Internet template over to it, and switches back to exactly what was there before (requires administrator rights).",
    },
    taskbar_align_left: {
      name: "Align the taskbar to the left",
      description:
        "Moves taskbar icons back to the left (Windows 10 style) instead of centered (HKCU, no elevation required).",
    },
    hide_taskbar_chat: {
      name: "Hide Chat/Teams from the taskbar",
      description:
        "Removes the Chat (Microsoft Teams) icon from the taskbar (HKCU, no elevation required).",
    },
    disable_start_suggestions: {
      name: "Disable Start menu suggestions and recommended apps",
      description:
        "Stops Windows from showing recommended apps, ads, and suggestions in the Start menu (HKCU, no elevation required).",
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
      description:
        "Moves the contents of %TEMP% to the Recycle Bin: you can recover it any time, it's not a permanent delete.",
    },
    winupdate_cache_cleanup: {
      name: "Clear Windows Update cache",
      description:
        "Moves already-installed Windows Update packages to the Recycle Bin (requires administrator rights).",
    },
  },
};

const fr: Strings = {
  appName: "PC Tweaker",
  appliedCount: "{applied} sur {total} optimisations actives",
  headerNote:
    "Chaque optimisation sauvegarde la valeur d'origine avant d'être appliquée. Celles qui nécessitent des droits élevés demandent un consentement UAC explicite, uniquement pour cette action.",
  advisor: {
    eyebrow: "Recommandé pour votre PC",
    applyButton: "Appliquer",
    confidenceHigh: "Confiance élevée — basé sur le matériel de ce PC",
    confidenceStandard: "Recommandé pour ce type de machine",
    reversible: "Réversible — la valeur d'origine est enregistrée avant toute modification.",
    empty: "Rien à recommander pour l'instant — votre configuration suit déjà nos conseils.",
  },
  drift: {
    titleAfterUpdate: "Windows a modifié vos réglages",
    titleNoUpdate: "Certains réglages ne sont plus actifs",
    afterUpdateOne:
      "Après la mise à jour vers {patch}, un réglage que vous aviez appliqué n’est plus actif sur le système.",
    afterUpdateMany:
      "Après la mise à jour vers {patch}, {count} réglages que vous aviez appliqués ne sont plus actifs sur le système.",
    noUpdateOne:
      "Un réglage que vous aviez appliqué n’est plus actif sur le système. Aucune mise à jour de Windows entre-temps : autre chose l’a modifié.",
    noUpdateMany:
      "{count} réglages que vous aviez appliqués ne sont plus actifs sur le système. Aucune mise à jour de Windows entre-temps : autre chose les a modifiés.",
    reapplyOne: "Réappliquer le réglage",
    reapplyMany: "Réappliquer {count} réglages",
    reapplying: "Réapplication...",
    reappliedOne: "Réglage réappliqué.",
    reappliedMany: "{count} réglages réappliqués.",
  },
  crashes: {
    title: "Fermetures inattendues",
    subtitle:
      "L'application s'est fermée toute seule. Le rapport reste sur ce PC : copiez-le et envoyez-le sur Discord ou GitHub si vous voulez que ce soit corrigé.",
    copy: "Copier le rapport",
    copied: "Rapport copié dans le presse-papiers.",
    clear: "Effacer",
    cleared: "Rapports effacés.",
    processApp: "fenêtre principale",
    processElevated: "opération avec droits admin",
  },
  ledger: {
    title: "Registre des modifications",
    subtitle:
      "Tout ce que cette application a modifié sur ce PC, du plus récent au plus ancien. Conservé en local, jamais envoyé en ligne.",
    empty: "Aucune modification enregistrée. Appliquez votre premier réglage et il apparaîtra ici.",
    clear: "Effacer l'historique",
    clearing: "Effacement...",
    cleared: "Historique effacé.",
    revert: "Rétablir",
    elevated: "avec droits admin",
    failed: "échec",
    actions: {
      applied: "Réglage appliqué",
      reverted: "Réglage rétabli",
      cleanup: "Nettoyage",
      filesDeleted: "Fichiers supprimés",
      diskOptimize: "Optimisation du disque",
      startupChange: "Modification du démarrage",
      restorePoint: "Point de restauration",
    },
  },
  tabs: {
    groupMonitor: "Surveiller",
    groupOptimize: "Optimiser",
    groupManage: "Gérer",
    scan: "Analyse",
    health: "Santé du PC",
    hardware: "Matériel",
    performance: "Performances",
    privacy: "Confidentialité",
    ui: "Interface",
    manutenzione: "Entretien",
    gaming: "Gaming",
    startup: "Démarrage",
    profiles: "Configurations",
    pricing: "Offres et tarifs",
    ledger: "Historique",
  },
  healthPanel: {
    title: "Santé du PC",
    subtitle: "Un score explicable : chaque nombre montre les faits dont il est calculé.",
    why: "Pourquoi {score} ?",
    refresh: "Recalculer",
    compute: "Calculer le score",
    showMore: "Voir les détails",
    showLess: "Masquer les détails",
    stageProfile: "Lecture du profil système",
    stageTweaks: "Vérification des tweaks appliqués",
    stageSecurity: "Lecture de l'état de sécurité",
    stageScoring: "Calcul du score",
    verdictExcellent: "EXCELLENT",
    verdictGood: "BON",
    verdictFair: "CORRECT",
    verdictNeedsWork: "À AMÉLIORER",
    computing: "Analyse en cours...",
    idleHint:
      "Rien ne tourne en arrière-plan : le score n'est calculé que lorsque vous le demandez, entièrement sur ce PC.",
    baselineTitle: "Référence",
    baselineHint:
      "Mesures rapides et répétables — comparables uniquement aux exécutions précédentes sur ce PC.",
    baselineRun: "Lancer la référence",
    baselineRunning: "Mesure en cours (~5 s)...",
    baselineEmpty: "Aucune référence. Lancez-en une avant vos modifications, puis une après.",
    changeSinceLast: "depuis votre dernier contrôle",
    changeNone: "Aucun changement depuis votre dernier contrôle.",
    changeFirstRun:
      "Première mesure enregistrée. Relancez-la après une modification pour voir ce qui a bougé.",
    changeWhyTitle: "Pourquoi le score a changé",
    changeContributes: "Contribution au score global :",
    changeStructural:
      "Une mise à jour de l'application a changé les catégories évaluées : une partie de cet écart ne vient pas de votre PC.",
    changeTrend: "Tendance",
    categories: {
      performance: "Performances",
      gaming: "Gaming",
      responsiveness: "Réactivité",
      memory: "Mémoire",
      storage: "Stockage",
      startup: "Démarrage",
      maintenance: "Maintenance",
      privacy: "Confidentialité",
      security: "Sécurité",
    },
  },
  transparency: {
    title: "Ce que cela modifie, exactement",
    key: "Clé",
    value: "Valeur",
    setsTo: "Définit sur",
    note: "L'ancienne valeur est sauvegardée avant l'écriture : la restauration la remet exactement telle qu'elle était.",
    kindRegistry: "Registre",
    kindCommand: "Commande",
    kindService: "Service",
    copy: "Copier",
    copied: "Copié",
  },
  command: {
    statusQuiet: "Tout est calme",
    statusScanning: "Analyse en cours...",
    statusFindings: "{count} recommandations prêtes",
    domainsLine: "Démarrage · Stockage · Mémoire · Confidentialité · Performances · Mises à jour",
    consent: "Rien ne change sans votre approbation.",
    runScan: "Lancer l'analyse du système",
    reviewFindings: "Voir {count} recommandations",
    memTitle: "Pression mémoire",
    pressureLow: "Faible",
    pressureElevated: "Élevée",
    pressureHigh: "Forte",
    memReview: "Examiner l'utilisation mémoire",
    memTopTitle: "Processus principaux",
    trimTitle: "Réduire les working sets",
    trimExplainer:
      "Demande à Windows de déplacer les pages inactives hors des working sets des applications (EmptyWorkingSet). Utile en cas de forte pression ; les applications peuvent recharger brièvement des pages. Aucune donnée n'est perdue.",
    trimButton: "Réduire maintenant",
    autoTitle: "Réduction automatique",
    profilesTitle: "Profils de session",
    profileGame: "Session de jeu",
    profileGameDesc: "Prépare le PC pour jouer : énergie, priorité et capture DVR.",
    profileFocus: "Concentration",
    profileFocusDesc: "Moins de distractions, activité non essentielle maîtrisée.",
    profileQuiet: "Session silencieuse",
    profileQuietDesc: "Efficacité, batterie et bruit réduit d'abord.",
    profileDownload: "Session téléchargement",
    profileDownloadDesc: "Contrôle la bande passante et l'activité en arrière-plan.",
    previewBtn: "Aperçu des modifications",
    gameChange1: "Désactive Game DVR (capture en arrière-plan)",
    gameChange2: "Bascule sur le mode d'alimentation Performances élevées",
    gameChange3: "Optimise la priorité CPU pour les jeux (Win32PrioritySeparation)",
    previewReq: "Droits administrateur requis · Fonction Pro",
    previewCost: "Coût potentiel : consommation et chaleur accrues pendant l'activation.",
    previewRevert: "Réversible en un clic : chaque valeur d'origine est sauvegardée avant.",
    applySession: "Démarrer la session",
    restoreSession: "Restaurer",
    statusActive: "Active",
    statusOff: "Inactive",
    soon: "Bientôt",
  },
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
    refresh: "Actualiser",
    refreshing: "Nouvelle analyse...",
    hiddenOrphans: "{count} entrées masquées : le programme n'est plus installé.",
  },
  search: {
    placeholder: "Rechercher une optimisation...",
    noResults: 'Aucun résultat pour "{query}".',
    clear: "Effacer",
  },
  pricing: {
    eyebrow: "Tout débloquer",
    title: "Choisissez jusqu’où pousser",
    subtitle:
      "Chaque modification enregistre l'état précédent : tout ce que vous essayez ici s'annule en un clic. Le gratuit couvre l'essentiel, Pro ouvre le reste.",
    monthly: "Mensuel",
    annual: "Annuel",
    lifetime: "À vie",
    saveBadge: "ÉCONOMISEZ {percent}%",
    perMonth: "/mois",
    perYear: "/an",
    once: "paiement unique",
    lifetimeDetail:
      "Payé une fois, à vous pour toujours. Rentabilisé en {months} mois par rapport à l’abonnement annuel, et plus rien ensuite",
    annualDetail: "Soit {monthly} par mois, prélevés {yearly} une fois par an",
    annualNudge: "Avec l’offre annuelle, ce serait {price} par mois",
    mostChosen: "LE PLUS CHOISI",
    freeName: "Free",
    freeTagline: "Tout le nécessaire pour un PC plus propre et plus réactif.",
    freePriceNote: "Gratuit pour toujours, sans expiration",
    freeCta: "Vous êtes sur l’offre Free",
    freeCurrent: "Offre actuelle",
    proName: "Pro",
    proTagline:
      "Tous les réglages, y compris ceux qui exigent des droits administrateur et ceux que vous feriez sinon à la main dans le registre.",
    proCta: "Passer à Pro",
    proCurrent: "Votre offre",
    manageBilling: "Gérer l'abonnement",
    everythingInFree: "Tout ce que contient Free, plus :",
    reassurance:
      "Résiliable à tout moment. Chaque modification reste annulable en un clic, même après la résiliation.",
    freeFeatures: [
      "{count} optimisations réelles, chacune sauvegardée et réversible",
      "Moniteur système en temps réel (processeur, mémoire, disque)",
      "Gestion des programmes au démarrage",
      "Vérification des fuites de mot de passe",
      "Analyse et correction du PC en un clic",
      "Nettoyage des fichiers temporaires",
    ],
    proFeatures: [
      "Game Sessions : le turbo s’active seul au lancement d’un jeu",
      "Préréglage Turbo Gaming et priorité maximale aux jeux",
      "Confidentialité avancée : télémétrie et historique d’activité",
      "Trouve et supprime les fichiers en double",
      "Vide le cache de Windows Update",
      "Désactive l’indexation qui occupe le disque",
      "Toutes les optimisations et fonctionnalités à venir, incluses",
    ],
  },
  toggle: { on: "Activé", off: "Désactivé" },
  driverBooster: {
    title: "Driver Booster",
    subtitle:
      "Sélectionnez les pilotes qui prennent de l’âge et ouvrez toutes leurs pages de téléchargement d’un coup.",
    scan: "Analyser les pilotes",
    scanning: "Analyse...",
    selectAll: "Tout sélectionner",
    selectNone: "Tout désélectionner",
    selectedCount: "{selected} sur {total} sélectionnés",
    pagesForSelection: "{pages} pages à ouvrir",
    openSelected: "Ouvrir les pages de téléchargement ({count})",
    opened: "{count} pages ouvertes",
    openedCapped:
      "{opened} pages ouvertes sur {total} : les autres restent sélectionnées, relancez pour les ouvrir.",
    allCurrent: "Aucun pilote ne montre son âge.",
    nothingActionable: "Aucun pilote vieillissant n’a de page constructeur à ouvrir.",
    note: "PC Tweaker ne télécharge pas les pilotes lui-même : aucune API constructeur ne dit quelle version convient à votre appareil exact, et installer le mauvais pilote graphique est l’une des rares erreurs qui peut vous laisser sans écran. Ceci automatise la partie fastidieuse — trouver les pages — pas le choix. Pour les pilotes que Windows Update connaît vraiment, utilisez le bouton ci-dessus.",
  },
  secureDefrag: {
    title: "Défragmentation sécurisée",
    willDefrag: "Ce disque est mécanique : une véritable défragmentation sera lancée.",
    willRetrim:
      "Ce disque n’est pas confirmé mécanique : le volume entier est analysé, puis un retrim est lancé au lieu d’une défragmentation. Le retrim dure quelques secondes et ne concerne que l’espace libre — c’est son rôle : indiquer au contrôleur quels blocs ne servent plus. Défragmenter un SSD ne l’accélère pas, cela l’use.",
    start: "Démarrer",
    running: "En cours...",
    working: "Traitement...",
    phaseAnalyze: "Analyse",
    phaseOptimize: "Optimisation",
    analysisTitle: "Rapport d’analyse",
    doneDefrag: "Défragmentation terminée.",
    doneRetrim: "Retrim terminé.",
    note: "Un point de restauration est créé avant. Le pourcentage vient de Windows lui-même, pas d’un minuteur.",
  },
  zeroTrace: {
    title: "Zero-Trace Cleaner",
    subtitle:
      "Efface ce que les programmes fermés laissent en mémoire et détruit les fichiers sans retour possible.",
    purgeTitle: "Purge mémoire",
    purgeBody:
      "Windows conserve en RAM les pages des programmes fermés, en cache. Ceci les libère : les fragments laissés par un processus terminé disparaissent réellement de la mémoire physique.",
    purgeButton: "Purger la mémoire",
    purging: "Purge...",
    purgeResult: "{freed} Mo libérés — {after} Mo libres maintenant",
    purgeLimit:
      "Cela ne touche ni le fichier d’échange ni celui d’hibernation : ils sont sur le disque et Windows n’offre aucune API pour les nettoyer à chaud.",
    shredTitle: "Destruction sécurisée de fichiers",
    shredBody:
      "Écrase le contenu du fichier en trois passes avant de le supprimer, le mettant hors de portée des outils de récupération courants.",
    shredButton: "Choisir des fichiers...",
    shredding: "Destruction...",
    shredDone: "{count} fichiers détruits ({size})",
    shredSummary: "{shredded} détruits, {skipped} ignorés",
    shredWarning: "Définitif : pas de Corbeille, aucune récupération.",
    ssdCaveat:
      "Sur un SSD, le nivellement d’usure écrit presque toujours sur d’autres cellules que l’original. Les anciennes sont libérées, pas réécrites — seul l’effacement sécurisé du disque peut garantir davantage.",
  },
  hud: {
    title: "Overlay de jeu",
    subtitle:
      "Un panneau transparent au-dessus du jeu : charge CPU/GPU, températures, VRAM, processus actif avec sa priorité, et indicateur de goulot d’étranglement.",
    fpsAbout:
      "Les FPS sont comptés à partir des événements de présentation que Windows émet à chaque image — la source que lit PresentMon, sans rien accrocher au jeu. Nécessite un lancement en administrateur, car ouvrir une session de traçage est une opération privilégiée.",
    fpsLowExplained:
      "À côté de la moyenne s’affiche DROP : la vitesse du pire pour cent des images, ce qu’ailleurs on appelle le « 1% low ». C’est le chiffre qui bouge quand le jeu saccade, alors que la moyenne reste haute et n’en dit rien. Plus DROP est proche de la moyenne, plus le jeu est fluide.",
    fpsStart: "Mesurer les FPS",
    fpsStop: "Arrêter la mesure",
    fpsNeedsAdmin: "Mesurer les FPS demande de lancer PC Tweaker en tant qu’administrateur.",
    fpsRunning:
      "Mesure en cours : les FPS apparaissent dans l’overlay dès qu’un jeu commence à dessiner.",
    show: "Afficher",
    hide: "Masquer",
    lock: "Verrouiller",
    unlock: "Déverrouiller",
    dragHint:
      "Faites glisser l’overlay où vous voulez, puis verrouillez-le avant de lancer le jeu.",
    lockedHint:
      "Verrouillé : les clics le traversent et atteignent le jeu. Déverrouillez-le pour le déplacer.",
    sizeCompact: "Compact",
    sizeNormal: "Normal",
  },
  updater: {
    title: "Mise à jour disponible : v{version}",
    body: "Téléchargée et installée en une seule étape ; l'application redémarre toute seule à la fin.",
    install: "Installer et redémarrer",
    later: "Plus tard",
    downloading: "Téléchargement... {percent}%",
    installing: "Installation...",
    error: "Échec de la mise à jour : {message}",
    checkFailed: "Échec de la vérification des mises à jour : {message}",
  },
  badges: { admin: "Admin", pro: "PRO", soon: "BIENTÔT" },
  emptyCategory: "Aucune optimisation disponible dans cette catégorie pour l'instant — à venir.",
  gameSessions: {
    title: "Game Sessions",
    subtitle:
      "Détecte automatiquement vos jeux et applique/annule le préréglage Turbo Gaming tout seul.",
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
    loadLabel: "CHARGE CPU",
    stageReading: "Lecture du mode d'alimentation",
    stageRaising: "Augmentation de la limite de boost",
    stageApplying: "Application au système",
    modeAggressive: "Mode agressif",
    modeDefault: "Mode par defaut",
    stageMeasuringBefore: "Mesure avant",
    stageMeasuringAfter: "Nouvelle mesure",
    gainMeasured: "{factor}x plus rapide",
    gainSlight: "{factor}x plus rapide - gain modeste",
    gainAtCeiling: "Déjà au maximum : ce processeur n'avait plus de marge à libérer",
    ceilingLocked: "Limite de boost verrouillee",
    ceilingUnlocked: "Limite de boost debloquee",
  },
  profiles: {
    title: "Configurations",
    subtitle: "Enregistrez votre réglage, réappliquez-le en un clic, ou transmettez-le.",
    saveHeading: "Enregistrer l'actuelle",
    namePlaceholder: "Nom (ex. Gaming)",
    saveButton: "Enregistrer",
    savedHeading: "Enregistrees",
    empty: "Aucune configuration enregistree.",
    tweakCount: "{count} reglages",
    apply: "Appliquer",
    applying: "Application...",
    exportButton: "Exporter",
    importButton: "Importer un fichier",
    deleteButton: "Supprimer",
    savedToast: 'Configuration "{name}" enregistree',
    appliedToast: "{count} reglages appliques",
    exportedToast: "Fichier exporte",
    importedToast: "Importee : {count} reglages a verifier",
    droppedWarning: "{count} entrees non reconnues par cette version ont ete ignorees",
    nameRequired: "Donnez un nom a la configuration",
    reviewNotice:
      "Une configuration importee n'est jamais appliquee toute seule : vous la verifiez d'abord.",
    signInRequired: "Connectez-vous ou creez un compte pour enregistrer des configurations.",
  },
  scan: {
    title: "Analyse rapide",
    subtitle:
      "Vérifie l'état de votre PC et trouve les optimisations pas encore actives, en un clic.",
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
    verdictRecommended: "Recommandé sur ce PC",
    verdictNotRecommended: "Déconseillé sur ce PC",
    verdictUnsupported: "Non pris en charge",
    reasons: {
      laptop_battery: "ce PC est un portable : cela coûte plus d'autonomie que cela n'apporte",
      hdd_index_cost:
        "le disque système est mécanique, l'indexation en arrière-plan se ressent vraiment",
      fast_disk_no_gain:
        "le disque système est en NVMe, assez rapide pour rendre le gain négligeable",
      needs_win10_2004: "nécessite Windows 10 version 2004 ou ultérieure",
      weak_gpu: "graphiques intégrés : la transparence leur coûte des performances utiles",
    },
    thisPc: "Ce PC",
    dashDrivesTitle: "Stockage",
    dashFreeOf: "{free} libres sur {total}",
    dashAlmostFull: "Presque plein",
    dashStartupTitle: "Applis au démarrage",
    dashStartupCount: "{on} actives sur {total}",
    dashManage: "Gérer",
    dashUptimeTitle: "Allumé depuis",
    dashUptimeDh: "{days}j {hours}h",
    dashUptimeHm: "{hours}h {minutes}min",
    dashUptimeLongHint:
      "Ce PC n'a pas redémarré depuis un moment. Un redémarrage applique les mises à jour en attente et libère la mémoire retenue.",
    dashHistoryTitle: "Actions récentes",
    dashHistoryEmpty: "Rien pour l'instant. Vos actions apparaîtront ici.",
    dashActTweakApplied: "Tweak appliqué",
    dashActTweakReverted: "Tweak annulé",
    dashActCleanup: "Nettoyage",
    dashActFilesDeleted: "Fichiers supprimés",
    dashActStartupChange: "Démarrage modifié",
    dashActDiskOptimize: "Disque optimisé",
    dashActRestorePoint: "Point de restauration",
    profileUnknown: "Non detecte",
    diskHdd: "HDD",
    diskSsd: "SSD",
    diskNvme: "NVMe",
    formDesktop: "Ordinateur de bureau",
    formLaptop: "Portable",
    groupRecommended: "Recommande pour ce PC",
    groupOptional: "Facultatif",
    groupNotRecommended: "Deconseille ici",
    tailoredNote:
      "Chaque element est evalue selon le materiel ci-dessus, pas selon une liste figee.",
    fixRecommended: "Appliquer les {count} recommandees",
    fixEverything: "Appliquer la selection ({count})",
    nothingSelected: "Rien de selectionne",
    foundHeadline: "{count} a corriger sur ce PC",
    foundNone: "Rien a corriger",
    doneTitle: "Terminé !",
    doneBody: "{count} optimisations appliquées. Votre PC est prêt.",
    fixHeading: "Prêtes à appliquer",
  },
  ram: {
    title: "Libérer la RAM",
    subtitle:
      "Demande à Windows de libérer la mémoire que les programmes occupent sans l'utiliser. À lancer aussi souvent que vous voulez.",
    button: "Libérer maintenant",
    cleaning: "Nettoyage en cours...",
    freed: "{amount} libérés",
    freedNothing: "La mémoire était déjà optimisée",
    inUse: "{used} sur {total} utilises",
    autoLabel: "Nettoyage automatique",
    autoOff: "Désactivé",
    autoEvery: "Toutes les {interval}",
    autoHint:
      "Avec le nettoyage automatique, PC Tweaker libère la RAM tout seul à intervalle régulier tant que l'application reste ouverte.",
    autoNext: "Prochain nettoyage à {time}",
    autoDue: "Nettoyage imminent...",
    autoLast: "Dernier à {time} : {amount} libérés",
    autoNoneYet: "Aucun nettoyage automatique n'a encore eu lieu.",
    autoFailed: "La dernière tentative a échoué : {detail}",
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
    breached:
      "Trouvé dans {count} fuites connues. Changez-le immédiatement, partout où vous l'utilisez.",
    error: "Impossible de vérifier pour le moment : vérifiez votre connexion et réessayez.",
  },
  paywall: {
    title: "Fonction Pro",
    body: "« {feature} » fait partie de PC Tweaker Pro, avec Game Sessions, les préréglages gaming et toutes les fonctionnalités à venir.",
    unlock: "Voir les offres et tarifs",
    notNow: "Pas maintenant",
    notConnectedToast:
      "Le paiement Pro n'est pas encore connecté dans cette version de développement.",
  },
  cleanupConfirm: {
    previewLoading: "Calcul de ce qui sera déplacé vers la Corbeille...",
    previewEmpty: "Rien à nettoyer : le dossier est déjà vide.",
    previewNotAccessible:
      "Le contenu ne peut pas être lu sans droits d'administrateur ; le processus autorisé le listera et le supprimera.",
    previewTruncated: "Affichage des 500 éléments les plus volumineux ; les totaux incluent tout.",
    selectedSummary: "{count} éléments sélectionnés · {size}",
    confirmSelected: "Nettoyer la sélection",
    title: "Confirmer le nettoyage ?",
    body: "« {name} » déplacera les fichiers correspondants vers la Corbeille de Windows. Vous pourrez les récupérer tant qu'elle n'est pas vidée.",
    confirm: "Déplacer vers la Corbeille",
    cancel: "Annuler",
  },
  cleanupButton: "Nettoyer",
  cleanupRunning: "...",
  cleanupResultToast: "{deleted} éléments déplacés vers la Corbeille, {freed} libérés",
  cleanupResultToastSkipped: " ({skipped} en cours d'utilisation, ignorés).",
  diskOptimize: {
    title: "Optimiser le disque",
    description:
      "Lance l'optimiseur integre de Windows : defragmentation sur un HDD, ou TRIM sur un SSD (jamais une defragmentation complete, qui ne ferait que l'user inutilement).",
    button: "Optimiser maintenant",
    running: "Optimisation en cours... cela peut prendre quelques minutes",
    resultToast: "Disque ({media}) optimise avec succes.",
  },
  dnsFlush: {
    title: "Vider le cache DNS",
    description:
      "Efface les adresses DNS mises en cache. Utile si un site a changé de serveur et que votre navigateur continue d'afficher l'ancienne version.",
    button: "Vider maintenant",
    running: "Vidage...",
    resultToast: "Cache DNS vidé.",
  },
  browserCleanup: {
    title: "Nettoyage du navigateur",
    description:
      "Vide le cache et les cookies de Chrome, Edge et Firefox. Le navigateur les reconstruit tout seul au prochain démarrage, rien n'est perdu pour de bon.",
    noneFound: "Aucun navigateur pris en charge trouvé sur ce PC.",
    cache: "Cache",
    cookies: "Cookies",
    clearButton: "Vider",
    clearing: "Vidage...",
    runningWarning: "Fermez {browser} pour le vider.",
    clearedToast: "{browser} : {freed} libérés.",
  },
  redaxaPromo: {
    title: "Redaxa",
    description:
      "Vous avez coupé télémétrie et pistage — mais que collez-vous dans les chats IA ? Redaxa intercepte données personnelles et identifiants avant qu'un prompt n'atteigne un modèle. Même famille, même règle : rien n'est conservé.",
    button: "Essayer sur le web",
  },
  uninstallerPromo: {
    title: "PC Tweaker Uninstaller",
    description:
      "Supprimez des programmes entiers en toute sécurité : point de restauration automatique, commande vérifiée, rapport honnête. De la même famille que PC Tweaker.",
    button: "En savoir plus",
  },
  largeFiles: {
    title: "Trouver les gros fichiers",
    description:
      "Recherche dans un dossier les fichiers les plus volumineux (plus de 100 Mo), pour libérer rapidement de l'espace en supprimant ceux dont vous n'avez plus besoin.",
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
    description:
      "Choisissez un dossier : repère les fichiers identiques et laisse choisir lesquels déplacer vers la Corbeille.",
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
    licenseNeedsRefresh:
      "Impossible de vérifier votre abonnement Pro après une si longue période hors ligne. Reconnectez-vous à internet et réessayez.",
    accountRefreshFailed:
      "Impossible de vérifier l'état de votre compte. Les informations affichées ici peuvent être obsolètes — vérifiez votre connexion ou réessayez plus tard.",
  },
  titlebar: {
    applied: "{applied}/{total} actifs",
    cpu: "Processeur",
    ram: "Mémoire",
    minimize: "Réduire",
    maximize: "Agrandir",
    restore: "Restaurer",
    close: "Fermer",
  },
  x3d: {
    title: "Aligneur de die 3D V-Cache",
    subtitle:
      "Sur un Ryzen X3D à deux dies, un seul porte le cache empilé. Windows ignore lequel et répartit le jeu sur les deux : chaque accès qui traverse les dies paie un aller-retour sur l'Infinity Fabric.",
    cpuLabel: "Processeur",
    readyHeadline: "Die V-Cache trouvé : {cores} threads",
    readyBody:
      "Épinglez un jeu sur ce die et tous ses threads restent là où le cache est le plus grand.",
    singleDie:
      "Ce processeur n'a qu'un seul die : tous les cœurs voient déjà le même cache, il n'y a donc rien à aligner. La fonction apparaît d'elle-même sur un processeur à deux dies au cache asymétrique.",
    uniformCache:
      "Ce processeur a plusieurs dies, tous avec la même quantité de cache. Déplacer un jeu de l'un à l'autre ne changerait rien, la fonction reste donc désactivée.",
    unavailable: "Windows n'a pas renvoyé de carte des caches pour ce processeur.",
    dieLabel: "Die {index}",
    dieCache: "{mb} Mo L3",
    dieThreads: "{count} threads",
    vcacheBadge: "V-Cache",
    processesTitle: "Processus en cours",
    processesHint: "Les plus actifs en tête. Choisissez le jeu et épinglez-le sur le die du cache.",
    refresh: "Actualiser",
    refreshing: "Lecture...",
    align: "Aligner",
    reset: "Réinitialiser",
    alignedBadge: "Aligné",
    noProcesses: "Aucun processus assez important à lister.",
    persistenceNote:
      "L'affinité appartient au processus en cours : elle disparaît à la fermeture du jeu et doit être refaite au lancement suivant. Aucun réglage système n'est modifié.",
    alignedToast: "{name} épinglé sur le die V-Cache.",
    resetToast: "{name} rendu à tous les cœurs.",
  },
  hardware: {
    intro:
      "Lu directement sur les capteurs de votre matériel. Là où un capteur n'existe pas, nous le disons, au lieu d'afficher un chiffre que personne ne peut vérifier.",
    gpuLabel: "Carte graphique",
    cpuLabel: "Processeur",
    liveBadge: "En direct",
    gpuDriver: "Pilote {version}",
    load: "Utilisation GPU",
    vram: "Mémoire vidéo",
    fan: "Ventilateur",
    power: "Consommation",
    fanIdle: "à l'arrêt : inutile sous 50°",
    powerLimit: "limite {limit} W",
    tempCool: "fraîche",
    tempGood: "optimale",
    tempWarm: "chaude",
    tempHot: "très chaude",
    traceLabel: "Cette session",
    traceRange: "min {min}° · max {max}°",
    noTempSensor: "Cette carte n'expose aucun capteur de température.",
    cpuAcpiSource: "lue depuis la zone thermique ACPI",
    cpuNoSensor:
      "Le micrologiciel de ce PC n'expose aucune zone thermique ACPI : Windows n'a donc aucune température de processeur à lire. Les outils qui en affichent toujours une installent un pilote noyau pour lire directement les registres du processeur. PC Tweaker ne le fait pas, et préfère vous le dire plutôt que d'inventer une valeur.",
    noGpuTool:
      "Aucune carte NVIDIA détectée. AMD et Intel ne fournissent pas d'outil équivalent, leurs températures sont donc illisibles sans le logiciel du fabricant.",
    thermalsUnavailable: "Impossible de lire les capteurs de ce système.",
    driversTitle: "Ancienneté des pilotes",
    driversSubtitle:
      "L'âge des pilotes fournis par les fabricants. Windows sait ce qui est installé, pas ce qui est disponible : voici l'âge réel, jamais une fausse alerte de mise à jour.",
    driversRescan: "Réanalyser",
    driversScanning: "Analyse...",
    driversCounted: "{count} pilotes de fabricants",
    driversAging: "{count} de plus de 2 ans",
    driversStale: "{count} de plus de 4 ans",
    driversAllCurrent: "Tous récents",
    driversNone: "Aucun pilote tiers dans ces catégories.",
    driversShowAll: "Afficher les {count} autres",
    driversShowLess: "Afficher moins",
    driversInboxNote:
      "{count} pilotes Microsoft intégrés exclus : Windows Update s'en charge et leur date est un marqueur fixe, les compter comme anciens serait une fausse alerte.",
    ageYears: "{years} ans",
    ageYear: "{years} an",
    ageMonths: "{months} mois",
    ageMonth: "{months} mois",
    vendorSite: "Site du fabricant",
    watchLabel: "Sous surveillance depuis",
    peakLabel: "Pic",
    verdictRisky: "Risqué",
    verdictNormal: "Normal",
    verdictBetter: "Mieux que prévu",
    verdictIdle: "Au repos",
    verdictRiskyHint:
      "La carte a dépassé 84°, le seuil à partir duquel elle réduit elle-même ses performances pour se protéger. Vérifiez la circulation d'air ou passez au profil Silencieux.",
    verdictNormalHint: "Températures habituelles pour une carte en charge : rien d'inquiétant.",
    verdictBetterHint:
      "Elle est restée sous 65° tout en travaillant vraiment : refroidissement meilleur que la moyenne.",
    verdictIdleHint:
      "Elle n'a pas encore assez travaillé pour juger. Une carte au repos reste fraîche de toute façon, cela ne prouverait rien.",
    profilesTitle: "Profils thermiques",
    profilesSubtitle:
      "Ils ajustent la limite de puissance de la carte, le levier qui gouverne réellement la chaleur et le bruit du ventilateur. Chaque valeur provient des limites déclarées par la carte elle-même.",
    currentLimit: "Actuel : {watts} W",
    modeSilent: "Silencieux",
    modeSilentHint:
      "Pour le travail, le streaming et les longues sessions : le ventilateur reste presque muet et la carte chauffe bien moins, au prix de quelques images.",
    modeStandard: "Standard",
    modeStandardHint:
      "Une limite équilibrée un peu sous le plafond de la carte : ventilateur plus discret et températures plus basses, pour un coût en images de quelques pour cent.",
    modeGaming: "Gaming",
    modeGamingHint:
      "Pour les sessions compétitives : watts au maximum et plafond d'horloge relevé, pour tenir vos 1% low plus stables quand ça compte.",
    modeApplying: "Application...",
    profileStageReading: "Lecture des limites de la carte",
    profileStageApplying: "Application de la limite",
    profileStageSettling: "Attente de la réponse des ventilateurs",
    profileApplied: "Limite réglée sur {watts} W.",
    profileNote:
      "Nécessite les droits administrateur et se réinitialise au redémarrage. Ce n'est pas une courbe de ventilateur : NVIDIA n'expose aucun contrôle direct du ventilateur dans nvidia-smi, et les outils qui en proposent un utilisent des API privées non documentées auxquelles cette application ne touche pas.",
    profileDefaultIsMax:
      "Sur cette carte, la limite de puissance d'usine égale déjà le maximum : Silencieux est donc le seul profil qui change les watts, Gaming se distingue en relevant le plafond d'horloge.",
    driverInstalled: "installé v{version} le {date}",
    driversNoUpdateCheck:
      "Cet écran ne contacte aucun fabricant et ne peut pas savoir s'il existe une version plus récente : il affiche la version installée et son âge, et vous conduit à la page officielle pour vérifier vous-même.",
    driversCheckedAt: "Lu le {time}",
    modeClockLocked: "horloge jusqu'à {mhz} MHz",
    modeClockAuto: "horloge automatique",
    profileApply: "Appliquer le profil",
    profileActive: "Profil actif",
    profileWillSet: "Réglera {watts} W, {clock}",
    scanStarting: "Démarrage de l'analyse...",
    scanReading: "Lecture de la classe {class}",
    scanCount: "{done}/{total} · {pct}%",
    driversScannedAll: "{total} pilotes examinés dans {classes} catégories",
    winUpdateLabel: "Windows Update",
    winUpdateButton: "Rechercher sur Windows Update",
    winUpdateNote:
      "Ceci vérifie uniquement le catalogue de Windows Update, pas les pilotes précis listés ci-dessus : de nombreux fabricants - surtout pour l'audio et le chipset intégrés - ne publient jamais leurs mises à jour là, seulement sur leur propre site. PC Tweaker ne télécharge pas de paquets de pilotes lui-même : il n'existe aucune API constructeur indiquant la version correcte pour votre appareil précis, et installer le mauvais pilote graphique est l'une des rares erreurs qui peut vous laisser sans écran.",
    winUpdateOpened: "Windows Update ouvert.",
    winUpdateSearching: "Recherche...",
    winUpdateTakesAWhile: "Cela peut prendre une minute : interrogation du catalogue Microsoft.",
    winUpdateInstall: "Télécharger et installer ({count})",
    winUpdateInstalling: "Téléchargement et installation...",
    winUpdateNone:
      "Windows Update n'a rien de plus récent à proposer, même pour les pilotes signalés comme anciens ci-dessus : de nombreux fabricants publient leurs mises à jour à leur façon, pas via Windows Update.",
    winUpdateFailed: "Échec de la recherche : {detail}",
    winUpdateDone: "Installés {installed}, échoués {failed}.",
    rebootTitle: "Windows demande un redémarrage",
    rebootBody:
      "Windows signale qu'une installation ne se termine qu'après un redémarrage. Vous pouvez le faire maintenant ou quand vous voulez.",
    rebootNow: "Redémarrer",
    rebootLater: "Plus tard",
  },
  menu: {
    account: "Compte",
    plan: "Forfait",
    planFree: "Gratuit",
    planPro: "Pro",
    viewPlan: "Voir votre forfait",
    upgradeButton: "Passer à Pro",
    language: "Langue",
    theme: "Thèmes",
    about: "À propos",
    errorReports: "Rapports d'erreur anonymes",
    errorReportsBody:
      "En cas d'échec, envoie uniquement le message d'erreur (jamais de données personnelles) pour nous aider à corriger les bugs. Désactivé par défaut.",
    changePhoto: "Changer la photo de profil",
    removePhoto: "Retirer la photo",
    photoFailed: "Impossible d'utiliser cette image comme photo de profil.",
    support: "Assistance",
    reportIssue: "Signaler un problème",
    aboutBody: "PC Tweaker — optimisations système avec sauvegarde et restauration automatiques.",
    close: "Fermer",
  },
  auth: {
    login: "Connexion",
    register: "Inscription",
    email: "E-mail",
    password: "Mot de passe",
    loginButton: "Se connecter",
    rememberMe: "Rester connecte sur ce PC",
    registerButton: "Créer un compte",
    working: "...",
    logout: "Se déconnecter",
    loggedInAs: "Connecté en tant que {email}",
    backendNotConfigured:
      "Aucun serveur connecté pour l'instant : définissez API_BASE_URL une fois le backend déployé.",
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
    network_latency: {
      name: "Reduire le delai reseau (algorithme de Nagle)",
      description:
        "Windows retient les petits paquets quelques millisecondes pour les regrouper, et retarde en plus les accusés de réception. Bon compromis pour les téléchargements, mauvais pour les jeux, où chaque paquet est petit et arriver en retard équivaut à ne pas arriver. Ceci désactive les deux sur votre carte réseau active (HKLM, nécessite des droits administrateur).",
    },
    disable_window_animations: {
      name: "Animations de fenetres instantanees",
      description:
        "Supprime l'animation jouée à chaque ouverture, fermeture ou réduction d'une fenêtre. Cette animation n'est que du temps d'attente : la retirer fait répondre le bureau à l'instant du clic et libère le travail GPU correspondant (HKCU, aucune élévation requise).",
    },
    disable_drag_full_windows: {
      name: "Deplacement de fenetres allege",
      description:
        "Dessine un contour pendant que vous deplacez une fenetre au lieu de redessiner tout son contenu a chaque image. A peine perceptible sur un GPU rapide, nettement visible sur un circuit graphique integre ou une machine ancienne (HKCU, aucune elevation requise).",
    },
    mouse_hover_delay: {
      name: "Reaction immediate au survol de la souris",
      description:
        "Windows attend 400 ms avant de reagir au pointeur pose sur un element : apercus de la barre des taches, info-bulles, survol des menus. Ce delai tombe presque a zero, l'interface suit la souris au lieu de la suivre en retard (HKCU, aucune elevation requise).",
    },
    disable_background_apps: {
      name: "Arreter les applications en arriere-plan",
      description:
        "Empêche les applications du Store de s'exécuter, de s'actualiser et d'interroger le réseau pendant que vous ne les utilisez pas. C'est du processeur, de la mémoire et de la batterie dépensés pour des applications que vous n'avez pas ouvertes (HKCU, aucune élévation requise).",
    },
    disable_delivery_optimization: {
      name: "Ne plus partager les mises a jour Windows",
      description:
        "Par defaut, Windows envoie les fichiers de mise a jour telecharges vers d'autres PC via votre connexion. Ceci limite Delivery Optimization a votre seule machine, pour que cet envoi ne consomme plus votre bande passante en pleine partie (HKLM, necessite des droits administrateur).",
    },
    disable_copilot: {
      name: "Désactiver Windows Copilot",
      description:
        "Retire l'assistant Copilot de la barre des tâches et l'empêche de s'exécuter en arrière-plan. Windows l'active par défaut et aucun interrupteur définitif n'existe dans les Paramètres : ceci applique la stratégie système qui le désactive pour de bon (HKCU, aucune élévation requise).",
    },
    disable_suggested_apps: {
      name: "Empêcher Windows d'installer des applications tout seul",
      description:
        "Windows installe discrètement des applications et des jeux « suggérés » dans votre menu Démarrer sans rien demander, à l'installation puis après chaque grosse mise à jour. Ceci désactive ce comportement : plus rien n'arrive sur votre machine sans votre accord (HKCU, aucune élévation requise).",
    },
    disable_mouse_acceleration: {
      name: "Désactiver l'accélération de la souris",
      description:
        "Désactive « Améliorer la précision du pointeur », qui fait parcourir au curseur une distance plus grande quand vous bougez vite. C'est exactement la réponse variable dont vous ne voulez pas pour viser : un même geste doit toujours couvrir la même distance à l'écran (HKCU, aucune élévation requise).",
    },
    disable_sticky_keys_prompt: {
      name: "Supprimer la fenêtre des touches rémanentes",
      description:
        "Appuyer cinq fois sur Maj ouvre la boîte de dialogue des touches rémanentes, ce qui en jeu signifie sortir du plein écran au pire moment, généralement en plein combat. Ceci désactive le raccourci et son avertissement ; les touches rémanentes restent disponibles dans les Paramètres (HKCU, aucune élévation requise).",
    },
    disable_recall: {
      name: "Désactiver Recall (captures d'écran par IA)",
      description:
        "Recall capture votre écran toutes les quelques secondes et construit un historique indexé par IA de tout ce que vous avez consulté — mots de passe et messages privés compris, puisqu'il enregistre tout ce qui s'affiche. Ceci applique la stratégie système qui l'empêche d'analyser ou de conserver quoi que ce soit (HKLM, nécessite des droits administrateur).",
    },
    disable_memory_integrity: {
      name: "Désactiver l'intégrité de la mémoire (VBS)",
      description:
        "L'intégrité de la mémoire exécute des parties de Windows dans un conteneur virtualisé, ce qui coûte du processeur à chaque transition vers le noyau — la raison pour laquelle la désactiver est le plus gros gain d'images par seconde disponible gratuitement. Le compromis doit être clair : c'est une vraie fonction de sécurité, et la couper retire la protection contre les pilotes malveillants. Justifié sur un PC dédié au jeu, pas sur une machine de travail. Effectif après redémarrage (HKLM, nécessite des droits administrateur).",
    },
    disable_typing_personalization: {
      name: "Empêcher Windows d'apprendre votre façon d'écrire",
      description:
        "Windows constitue un dictionnaire personnel à partir de ce que vous tapez et écrivez à la main — y compris dans les gestionnaires de mots de passe, les fenêtres de discussion et les champs de recherche — et le synchronise avec votre compte Microsoft pour améliorer ses suggestions. Ceci désactive la collecte du texte et celle de l'écriture manuscrite (HKCU, aucune élévation requise).",
    },
    classic_context_menu: {
      name: "Rétablir le menu clic droit complet",
      description:
        "Windows 11 cache la majeure partie du menu contextuel derrière « Afficher d'autres options », transformant un clic en deux pour des gestes quotidiens. Ceci rétablit le menu complet de Windows 10 partout, dans l'Explorateur et sur le bureau. L'Explorateur redémarre pour l'appliquer, les fenêtres ouvertes clignoteront donc une fois (HKCU, aucune élévation requise).",
    },
    disable_transparency: {
      name: "Désactiver les effets de transparence",
      description:
        "Désactive les effets de flou/acrylique de la barre des tâches et des menus. Une économie de GPU modeste mais réelle, qui rend plus fluides les PC anciens ou à carte graphique intégrée (HKCU, aucune élévation requise).",
    },
    dark_mode: {
      name: "Mode sombre",
      description:
        "Active le thème sombre pour les applications et le système (HKCU, aucune élévation requise).",
    },
    show_hidden_files: {
      name: "Afficher les fichiers cachés",
      description:
        "Affiche les fichiers et dossiers cachés dans l'Explorateur (HKCU, aucune élévation requise).",
    },
    priority_separation: {
      name: "Optimiser la priorité du processeur",
      description:
        "Ajuste Win32PrioritySeparation (0x26) pour donner à l'application au premier plan des quanta CPU courts et variables avec une priorité 3x — la valeur classique de réactivité bureau/jeu (HKLM, droits administrateur requis).",
    },
    disable_game_dvr: {
      name: "Désactiver Xbox Game Bar / Game DVR",
      description:
        "Désactive l'enregistrement en arrière-plan de Xbox Game Bar, gourmand en CPU/GPU pendant le jeu (HKCU, aucune élévation requise).",
    },
    disable_telemetry_tasks: {
      name: "Réduire la collecte de données de diagnostic",
      description:
        "Règle le niveau de diagnostic de Windows au minimum autorisé (HKLM, droits administrateur requis).",
    },
    reset_advertising_id: {
      name: "Désactiver l'ID publicitaire",
      description:
        "Empêche les applications d'utiliser votre ID publicitaire à des fins de profilage (HKCU, aucune élévation requise).",
    },
    disable_location_tracking: {
      name: "Désactiver le suivi de localisation",
      description:
        "Bloque l'accès à la localisation pour toutes les applications via une stratégie système (HKLM, droits administrateur requis).",
    },
    disable_bing_search: {
      name: "Désactiver la recherche Bing dans le menu Démarrer",
      description:
        "Empêche l'envoi de vos recherches du menu Démarrer à Bing (HKCU, aucune élévation requise).",
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
    keep_kernel_in_ram: {
      name: "Garder le noyau et les pilotes en RAM",
      description:
        "Windows peut déplacer sur le disque des parties du noyau et du code des pilotes même quand la mémoire est abondante, et les relire est une pause que vous ressentez comme un à-coup. Ceci les garde en mémoire. Utile si vous avez de la RAM à revendre ; sur un PC peu doté, laissez désactivé (HKLM, droits administrateur requis).",
    },
    auto_end_frozen_tasks: {
      name: "Empêcher une application figée de bloquer l'arrêt",
      description:
        "Quand une application cesse de répondre pendant l'arrêt, Windows attend et affiche l'écran \"Cette application empêche l'arrêt\" jusqu'à ce que quelqu'un clique. Ceci ferme automatiquement les applications qui ne répondent plus, pour qu'un programme figé ne laisse pas la machine allumée (HKCU, aucune élévation requise).",
    },
    instant_folder_loading: {
      name: "Ouvrir chaque dossier instantanément",
      description:
        "L'Explorateur inspecte le contenu d'un dossier pour deviner s'il s'agit d'Images, Musique ou Documents, et un dossier contenant des milliers de fichiers multimédias peut se figer plusieurs secondes pendant qu'il décide. Ceci fixe tous les dossiers sur la disposition générale, pour qu'ils s'ouvrent aussitôt (HKCU, aucune élévation requise).",
    },
    tcp_congestion_bbr: {
      name: "Un ping stable même quand la ligne est chargée (BBR2)",
      description:
        "Windows utilise CUBIC, qui accélère jusqu'à ce qu'un tampon déborde quelque part : c'est pourquoi votre ping grimpe dès que quelqu'un d'autre lance un téléchargement. BBR2 mesure la bande passante réelle et le temps d'aller-retour de la ligne, et cadence le trafic en conséquence : le tuyau se remplit sans remplir la file. Microsoft fournit BBR2 dans Windows 11 ; ceci bascule le profil Internet dessus et sait revenir exactement à l'état précédent (droits administrateur requis).",
    },
    taskbar_align_left: {
      name: "Aligner la barre des tâches à gauche",
      description:
        "Replace les icônes de la barre des tâches à gauche (style Windows 10) au lieu du centre (HKCU, aucune élévation requise).",
    },
    hide_taskbar_chat: {
      name: "Masquer Chat/Teams de la barre des tâches",
      description:
        "Retire l'icône Chat (Microsoft Teams) de la barre des tâches (HKCU, aucune élévation requise).",
    },
    disable_start_suggestions: {
      name: "Désactiver les suggestions et apps recommandées du menu Démarrer",
      description:
        "Empêche Windows d'afficher des apps recommandées, publicités et suggestions dans le menu Démarrer (HKCU, aucune élévation requise).",
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
      description:
        "Déplace le contenu de %TEMP% vers la Corbeille : récupérable à tout moment, ce n'est pas une suppression définitive.",
    },
    winupdate_cache_cleanup: {
      name: "Vider le cache de Windows Update",
      description:
        "Déplace vers la Corbeille les paquets Windows Update déjà installés (droits administrateur requis).",
    },
  },
};

const es: Strings = {
  appName: "PC Tweaker",
  appliedCount: "{applied} de {total} ajustes activos",
  headerNote:
    "Cada ajuste guarda una copia del valor original antes de aplicarse. Los ajustes que requieren privilegios elevados piden un consentimiento UAC explícito, solo para esa acción.",
  advisor: {
    eyebrow: "Recomendado para tu PC",
    applyButton: "Aplicar",
    confidenceHigh: "Confianza alta — basado en el hardware de este PC",
    confidenceStandard: "Recomendado para este tipo de equipo",
    reversible: "Reversible: el valor original se guarda antes de cada cambio.",
    empty: "Nada que recomendar ahora mismo: tu configuración ya sigue nuestros consejos.",
  },
  drift: {
    titleAfterUpdate: "Windows volvió a cambiar tus ajustes",
    titleNoUpdate: "Algunos ajustes ya no están activos",
    afterUpdateOne:
      "Tras actualizar a {patch}, un ajuste que habías aplicado ya no está activo en el sistema.",
    afterUpdateMany:
      "Tras actualizar a {patch}, {count} ajustes que habías aplicado ya no están activos en el sistema.",
    noUpdateOne:
      "Un ajuste que habías aplicado ya no está activo en el sistema. No hubo ninguna actualización de Windows entretanto, así que lo cambió otra cosa.",
    noUpdateMany:
      "{count} ajustes que habías aplicado ya no están activos en el sistema. No hubo ninguna actualización de Windows entretanto, así que los cambió otra cosa.",
    reapplyOne: "Volver a aplicar el ajuste",
    reapplyMany: "Volver a aplicar {count} ajustes",
    reapplying: "Aplicando...",
    reappliedOne: "Ajuste aplicado de nuevo.",
    reappliedMany: "{count} ajustes aplicados de nuevo.",
  },
  crashes: {
    title: "Cierres inesperados",
    subtitle:
      "La aplicación se cerró sola. El informe se queda en este PC: cópialo y envíalo por Discord o GitHub si quieres que lo arregle.",
    copy: "Copiar informe",
    copied: "Informe copiado al portapapeles.",
    clear: "Borrar",
    cleared: "Informes borrados.",
    processApp: "ventana principal",
    processElevated: "operación con permisos de administrador",
  },
  ledger: {
    title: "Registro de cambios",
    subtitle:
      "Todo lo que esta aplicación cambió en este PC, de más reciente a más antiguo. Guardado en local, nunca se sube.",
    empty: "Aún no hay cambios registrados. Aplica tu primer ajuste y aparecerá aquí.",
    clear: "Borrar historial",
    clearing: "Borrando...",
    cleared: "Historial borrado.",
    revert: "Revertir",
    elevated: "con permisos de admin",
    failed: "falló",
    actions: {
      applied: "Ajuste aplicado",
      reverted: "Ajuste revertido",
      cleanup: "Limpieza",
      filesDeleted: "Archivos eliminados",
      diskOptimize: "Optimización del disco",
      startupChange: "Cambio de inicio",
      restorePoint: "Punto de restauración",
    },
  },
  tabs: {
    groupMonitor: "Supervisar",
    groupOptimize: "Optimizar",
    groupManage: "Gestionar",
    scan: "Análisis",
    health: "Salud del PC",
    hardware: "Hardware",
    performance: "Rendimiento",
    privacy: "Privacidad",
    ui: "Interfaz",
    manutenzione: "Mantenimiento",
    gaming: "Gaming",
    startup: "Inicio",
    profiles: "Configuraciones",
    pricing: "Planes y precios",
    ledger: "Historial",
  },
  healthPanel: {
    title: "Salud del PC",
    subtitle: "Una puntuación explicable: cada número muestra los hechos de los que se calcula.",
    why: "¿Por qué {score}?",
    refresh: "Recalcular",
    compute: "Calcular la puntuación",
    showMore: "Ver detalles",
    showLess: "Ocultar detalles",
    stageProfile: "Leyendo el perfil del sistema",
    stageTweaks: "Comprobando tweaks aplicados",
    stageSecurity: "Leyendo el estado de seguridad",
    stageScoring: "Calculando la puntuación",
    verdictExcellent: "EXCELENTE",
    verdictGood: "BUENO",
    verdictFair: "ACEPTABLE",
    verdictNeedsWork: "MEJORABLE",
    computing: "Analizando...",
    idleHint:
      "Nada se ejecuta en segundo plano: la puntuación se calcula solo cuando lo pides, íntegramente en este PC.",
    baselineTitle: "Línea base",
    baselineHint:
      "Mediciones rápidas y repetibles — solo comparables con ejecuciones previas en este PC.",
    baselineRun: "Ejecutar línea base",
    baselineRunning: "Midiendo (~5 s)...",
    baselineEmpty: "Aún no hay líneas base. Ejecuta una antes de aplicar cambios, y otra después.",
    changeSinceLast: "desde tu última comprobación",
    changeNone: "Sin cambios desde tu última comprobación.",
    changeFirstRun:
      "Primera medición registrada. Vuelve a ejecutarla tras un cambio para ver qué se movió.",
    changeWhyTitle: "Por qué cambió la puntuación",
    changeContributes: "Contribución a la puntuación global:",
    changeStructural:
      "Una actualización de la aplicación cambió qué categorías se evalúan: parte de esta diferencia no viene de tu PC.",
    changeTrend: "Evolución",
    categories: {
      performance: "Rendimiento",
      gaming: "Gaming",
      responsiveness: "Capacidad de respuesta",
      memory: "Memoria",
      storage: "Almacenamiento",
      startup: "Inicio",
      maintenance: "Mantenimiento",
      privacy: "Privacidad",
      security: "Seguridad",
    },
  },
  transparency: {
    title: "Qué modifica exactamente",
    key: "Clave",
    value: "Valor",
    setsTo: "Lo establece en",
    note: "El valor anterior se guarda antes de escribir, así que la reversión lo restaura exactamente como estaba.",
    kindRegistry: "Registro",
    kindCommand: "Comando",
    kindService: "Servicio",
    copy: "Copiar",
    copied: "Copiado",
  },
  command: {
    statusQuiet: "Todo en calma",
    statusScanning: "Analizando...",
    statusFindings: "{count} recomendaciones listas",
    domainsLine: "Inicio · Almacenamiento · Memoria · Privacidad · Rendimiento · Actualizaciones",
    consent: "Nada cambia sin tu aprobación.",
    runScan: "Iniciar análisis del sistema",
    reviewFindings: "Revisar {count} recomendaciones",
    memTitle: "Presión de memoria",
    pressureLow: "Baja",
    pressureElevated: "Elevada",
    pressureHigh: "Alta",
    memReview: "Revisar uso de memoria",
    memTopTitle: "Procesos principales",
    trimTitle: "Recortar working sets",
    trimExplainer:
      "Pide a Windows mover las páginas inactivas fuera de los working sets de las apps (EmptyWorkingSet). Útil con presión alta; las apps pueden recargar páginas brevemente. No se pierde ningún dato.",
    trimButton: "Recortar ahora",
    autoTitle: "Recorte automático",
    profilesTitle: "Perfiles de sesión",
    profileGame: "Sesión de juego",
    profileGameDesc: "Prepara el PC para jugar: energía, prioridad y captura DVR.",
    profileFocus: "Concentración",
    profileFocusDesc: "Menos distracciones y actividad no esencial bajo control.",
    profileQuiet: "Sesión silenciosa",
    profileQuietDesc: "Eficiencia, batería y bajo ruido primero.",
    profileDownload: "Sesión de descarga",
    profileDownloadDesc: "Controla el ancho de banda y la actividad en segundo plano.",
    previewBtn: "Vista previa de cambios",
    gameChange1: "Desactiva Game DVR (captura en segundo plano)",
    gameChange2: "Cambia al plan de energía Alto rendimiento",
    gameChange3: "Optimiza la prioridad de CPU para juegos (Win32PrioritySeparation)",
    previewReq: "Requiere derechos de administrador · Función Pro",
    previewCost: "Coste potencial: mayor consumo y calor mientras está activa.",
    previewRevert: "Reversible con un clic: cada valor original se guarda antes.",
    applySession: "Iniciar sesión",
    restoreSession: "Restaurar",
    statusActive: "Activa",
    statusOff: "No activa",
    soon: "Próximamente",
  },
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
    refresh: "Actualizar",
    refreshing: "Reanalizando...",
    hiddenOrphans: "{count} entradas ocultas: el programa ya no está instalado.",
  },
  search: {
    placeholder: "Buscar un ajuste...",
    noResults: 'Sin resultados para "{query}".',
    clear: "Borrar",
  },
  pricing: {
    eyebrow: "Desbloquea todo",
    title: "Elige cuánto quieres exprimirlo",
    subtitle:
      "Cada cambio guarda antes cómo estaba: lo que pruebes aquí se deshace en un clic. El gratuito cubre lo esencial; Pro abre el resto.",
    monthly: "Mensual",
    annual: "Anual",
    lifetime: "De por vida",
    saveBadge: "AHORRAS UN {percent}%",
    perMonth: "/mes",
    perYear: "/año",
    once: "pago único",
    lifetimeDetail:
      "Pagas una vez y es tuyo. Se amortiza en {months} meses frente al plan anual, y a partir de ahí no pagas nada más",
    annualDetail: "Son {monthly} al mes, con un cargo de {yearly} una vez al año",
    annualNudge: "Con el plan anual serían {price} al mes",
    mostChosen: "EL MÁS ELEGIDO",
    freeName: "Free",
    freeTagline: "Todo lo necesario para un PC más limpio y ágil.",
    freePriceNote: "Gratis para siempre, sin caducidad",
    freeCta: "Estás en el plan Free",
    freeCurrent: "Plan actual",
    proName: "Pro",
    proTagline:
      "Todos los ajustes, incluidos los que piden permisos de administrador y los que si no harías a mano en el registro.",
    proCta: "Pasar a Pro",
    proCurrent: "Tu plan",
    manageBilling: "Gestionar suscripción",
    everythingInFree: "Todo lo que incluye Free, y además:",
    reassurance:
      "Cancela cuando quieras. Cada cambio sigue siendo reversible con un clic, incluso tras cancelar.",
    freeFeatures: [
      "{count} ajustes reales, cada uno con copia de seguridad y reversible",
      "Monitor del sistema en tiempo real (CPU, memoria, disco)",
      "Gestión de los programas de inicio",
      "Comprobación de filtraciones de contraseñas",
      "Análisis del PC y corrección en un clic",
      "Limpieza de archivos temporales",
    ],
    proFeatures: [
      "Game Sessions: el turbo se activa solo al abrir un juego",
      "Preset Turbo Gaming y prioridad máxima para los juegos",
      "Privacidad avanzada: telemetría e historial de actividad",
      "Encuentra y elimina archivos duplicados",
      "Vacía la caché de Windows Update",
      "Desactiva la indexación que mantiene ocupado el disco",
      "Todos los ajustes y funciones futuras, incluidos",
    ],
  },
  toggle: { on: "Activado", off: "Desactivado" },
  driverBooster: {
    title: "Driver Booster",
    subtitle:
      "Elige los controladores que se están quedando atrás y abre todas sus páginas de descarga de una vez.",
    scan: "Analizar controladores",
    scanning: "Analizando...",
    selectAll: "Seleccionar todo",
    selectNone: "Quitar selección",
    selectedCount: "{selected} de {total} seleccionados",
    pagesForSelection: "{pages} páginas por abrir",
    openSelected: "Abrir páginas de descarga ({count})",
    opened: "{count} páginas abiertas",
    openedCapped:
      "Abiertas {opened} de {total} páginas: las demás siguen seleccionadas, vuelve a ejecutarlo.",
    allCurrent: "Ningún controlador aparenta su edad.",
    nothingActionable: "Ningún controlador antiguo tiene una página del fabricante que abrir.",
    note: "PC Tweaker no descarga paquetes de controladores por su cuenta: no existe una API del fabricante que diga cuál es la versión correcta para tu dispositivo exacto, e instalar el controlador de vídeo equivocado es uno de los pocos errores que puede dejarte sin pantalla. Esto automatiza la parte tediosa — encontrar las páginas — no la elección. Para los controladores que Windows Update sí conoce, usa el botón de arriba.",
  },
  secureDefrag: {
    title: "Desfragmentación segura",
    willDefrag: "Este disco es mecánico: se ejecutará una desfragmentación real.",
    willRetrim:
      "Este disco no está confirmado como mecánico: se analiza el volumen completo y luego se ejecuta un retrim en vez de una desfragmentación. El retrim dura segundos y solo afecta al espacio libre — eso es lo que hace: indica al controlador qué bloques ya no se usan. Desfragmentar un SSD no lo acelera, solo lo desgasta.",
    start: "Iniciar",
    running: "En curso...",
    working: "Procesando...",
    phaseAnalyze: "Analizando",
    phaseOptimize: "Optimizando",
    analysisTitle: "Informe de análisis",
    doneDefrag: "Desfragmentación completada.",
    doneRetrim: "Retrim completado.",
    note: "Antes se crea un punto de restauración. El porcentaje viene de Windows, no de un temporizador.",
  },
  zeroTrace: {
    title: "Zero-Trace Cleaner",
    subtitle:
      "Borra lo que los programas cerrados dejan en memoria y destruye archivos sin posible recuperación.",
    purgeTitle: "Purga de memoria",
    purgeBody:
      "Windows mantiene en RAM las páginas de los programas cerrados como caché. Esto las libera: los fragmentos que deja un proceso terminado desaparecen de verdad de la memoria física.",
    purgeButton: "Purgar memoria",
    purging: "Purgando...",
    purgeResult: "Liberados {freed} MB — ahora {after} MB libres",
    purgeLimit:
      "No toca el archivo de paginación ni el de hibernación: están en disco y Windows no ofrece ninguna API para limpiarlos en caliente.",
    shredTitle: "Destrucción segura de archivos",
    shredBody:
      "Sobrescribe el contenido del archivo en tres pasadas antes de eliminarlo, dejándolo fuera del alcance de las herramientas de recuperación habituales.",
    shredButton: "Elegir archivos...",
    shredding: "Destruyendo...",
    shredDone: "{count} archivos destruidos ({size})",
    shredSummary: "{shredded} destruidos, {skipped} omitidos",
    shredWarning: "Definitivo: sin Papelera, sin recuperación.",
    ssdCaveat:
      "En un SSD, el nivelado de desgaste casi siempre escribe en celdas distintas del original. Las antiguas se liberan, no se reescriben: solo el borrado seguro del disco puede garantizar más.",
  },
  hud: {
    title: "Overlay de juego",
    subtitle:
      "Un panel transparente sobre el juego: carga de CPU/GPU, temperaturas, VRAM, proceso activo con su prioridad e indicador de cuello de botella.",
    fpsAbout:
      "Los FPS se cuentan a partir de los eventos de presentación que Windows emite en cada fotograma: la misma fuente que lee PresentMon, sin enganchar nada al juego. Requiere iniciar como administrador, porque abrir una sesión de rastreo es una operación privilegiada.",
    fpsLowExplained:
      "Junto al promedio aparece DROP: la velocidad del uno por ciento peor de fotogramas, lo que en otros sitios llaman «1% low». Es la cifra que se mueve cuando el juego tironea, mientras el promedio sigue alto y no lo cuenta. Cuanto más cerca esté DROP del promedio, más fluido va el juego.",
    fpsStart: "Medir FPS",
    fpsStop: "Detener medición",
    fpsNeedsAdmin: "Para medir los FPS hay que iniciar PC Tweaker como administrador.",
    fpsRunning: "Midiendo: los FPS aparecen en el overlay en cuanto un juego empieza a dibujar.",
    show: "Mostrar",
    hide: "Ocultar",
    lock: "Bloquear",
    unlock: "Desbloquear",
    dragHint: "Arrastra la superposición donde quieras y bloquéala antes de iniciar el juego.",
    lockedHint: "Bloqueada: los clics la atraviesan y llegan al juego. Desbloquéala para moverla.",
    sizeCompact: "Compacto",
    sizeNormal: "Normal",
  },
  updater: {
    title: "Actualización disponible: v{version}",
    body: "Se descarga e instala en un solo paso; la aplicación se reinicia sola al terminar.",
    install: "Instalar y reiniciar",
    later: "Más tarde",
    downloading: "Descargando... {percent}%",
    installing: "Instalando...",
    error: "Error al actualizar: {message}",
    checkFailed: "Error al comprobar actualizaciones: {message}",
  },
  badges: { admin: "Admin", pro: "PRO", soon: "PRÓXIMAMENTE" },
  emptyCategory: "Todavía no hay ajustes disponibles en esta categoría — próximamente.",
  gameSessions: {
    title: "Game Sessions",
    subtitle:
      "Detecta automáticamente tus juegos y aplica/revierte el preset Turbo Gaming por sí solo.",
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
    loadLabel: "CARGA CPU",
    stageReading: "Leyendo el plan de energia",
    stageRaising: "Elevando el limite de boost",
    stageApplying: "Aplicando al sistema",
    modeAggressive: "Modo agresivo",
    modeDefault: "Modo predeterminado",
    stageMeasuringBefore: "Midiendo antes",
    stageMeasuringAfter: "Midiendo de nuevo",
    gainMeasured: "{factor}x mas rapido",
    gainSlight: "{factor}x mas rapido - ganancia modesta",
    gainAtCeiling: "Ya al maximo: esta CPU no tenia mas margen que liberar",
    ceilingLocked: "Limite de boost bloqueado",
    ceilingUnlocked: "Limite de boost desbloqueado",
  },
  profiles: {
    title: "Configuraciones",
    subtitle: "Guarda como has dejado el PC, vuelve a aplicarlo en un clic o pasaselo a alguien.",
    saveHeading: "Guardar la actual",
    namePlaceholder: "Nombre (p. ej. Gaming)",
    saveButton: "Guardar",
    savedHeading: "Guardadas",
    empty: "Todavia no hay configuraciones guardadas.",
    tweakCount: "{count} ajustes",
    apply: "Aplicar",
    applying: "Aplicando...",
    exportButton: "Exportar",
    importButton: "Importar de archivo",
    deleteButton: "Eliminar",
    savedToast: 'Configuración "{name}" guardada',
    appliedToast: "{count} ajustes aplicados",
    exportedToast: "Archivo exportado",
    importedToast: "Importada: {count} ajustes listos para revisar",
    droppedWarning: "Se descartaron {count} entradas que esta version no reconoce",
    nameRequired: "Ponle un nombre a la configuración",
    reviewNotice: "Una configuración importada nunca se aplica sola: la revisas tú antes.",
    signInRequired: "Inicia sesión o crea una cuenta para guardar configuraciones.",
  },
  scan: {
    title: "Análisis rápido",
    subtitle:
      "Comprueba el estado de tu PC y encuentra optimizaciones que aún no están activas, en un clic.",
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
    verdictRecommended: "Recomendado en este PC",
    verdictNotRecommended: "No recomendado en este PC",
    verdictUnsupported: "No compatible",
    reasons: {
      laptop_battery: "este PC es un portátil: cuesta más batería de lo que aporta",
      hdd_index_cost:
        "el disco del sistema es mecánico, así que la indexación en segundo plano se nota",
      fast_disk_no_gain:
        "el disco del sistema es NVMe, lo bastante rápido para que la mejora sea insignificante",
      needs_win10_2004: "requiere Windows 10 versión 2004 o posterior",
      weak_gpu: "gráficos integrados: la transparencia les cuesta rendimiento aprovechable",
    },
    thisPc: "Este PC",
    dashDrivesTitle: "Almacenamiento",
    dashFreeOf: "{free} libres de {total}",
    dashAlmostFull: "Casi lleno",
    dashStartupTitle: "Apps de inicio",
    dashStartupCount: "{on} de {total} activas",
    dashManage: "Gestionar",
    dashUptimeTitle: "Encendido desde hace",
    dashUptimeDh: "{days}d {hours}h",
    dashUptimeHm: "{hours}h {minutes}min",
    dashUptimeLongHint:
      "Este PC no se reinicia desde hace tiempo. Un reinicio aplica las actualizaciones pendientes y libera la memoria retenida.",
    dashHistoryTitle: "Acciones recientes",
    dashHistoryEmpty: "Nada todavía. Tus acciones aparecerán aquí.",
    dashActTweakApplied: "Tweak aplicado",
    dashActTweakReverted: "Tweak revertido",
    dashActCleanup: "Limpieza",
    dashActFilesDeleted: "Archivos eliminados",
    dashActStartupChange: "Inicio modificado",
    dashActDiskOptimize: "Disco optimizado",
    dashActRestorePoint: "Punto de restauración",
    profileUnknown: "No detectado",
    diskHdd: "HDD",
    diskSsd: "SSD",
    diskNvme: "NVMe",
    formDesktop: "Sobremesa",
    formLaptop: "Portatil",
    groupRecommended: "Recomendado para este PC",
    groupOptional: "Opcional",
    groupNotRecommended: "No recomendado aqui",
    tailoredNote: "Cada elemento se evalua segun el hardware de arriba, no segun una lista fija.",
    fixRecommended: "Aplicar las {count} recomendadas",
    fixEverything: "Aplicar lo seleccionado ({count})",
    nothingSelected: "Nada seleccionado",
    foundHeadline: "{count} por corregir en este PC",
    foundNone: "Nada que corregir",
    doneTitle: "¡Listo!",
    doneBody: "{count} optimizaciones aplicadas. Tu PC está a punto.",
    fixHeading: "Listas para aplicar",
  },
  ram: {
    title: "Liberar RAM",
    subtitle:
      "Pide a Windows que libere la memoria que los programas ocupan sin usarla. Puedes hacerlo tantas veces como quieras.",
    button: "Liberar ahora",
    cleaning: "Limpiando...",
    freed: "{amount} liberados",
    freedNothing: "La memoria ya estaba optimizada",
    inUse: "{used} de {total} en uso",
    autoLabel: "Limpieza automática",
    autoOff: "Desactivada",
    autoEvery: "Cada {interval}",
    autoHint:
      "Con la limpieza automática activada, PC Tweaker libera la RAM por sí solo a intervalos regulares mientras la app siga abierta.",
    autoNext: "Próxima limpieza a las {time}",
    autoDue: "Limpieza inminente...",
    autoLast: "Última a las {time}: {amount} liberados",
    autoNoneYet: "Aún no se ha ejecutado ninguna limpieza automática.",
    autoFailed: "El último intento falló: {detail}",
  },
  restore: {
    button: "Restaurar todo",
    title: "¿Restaurar todos los cambios?",
    body: "Se desactivarán las {count} optimizaciones activas y cada valor volverá exactamente a como estaba. No se pierde nada.",
    confirm: "Sí, restaurar todo",
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
    breached:
      "Encontrada en {count} filtraciones conocidas. Cámbiala ya, en todos los sitios donde la uses.",
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
    previewLoading: "Calculando qué se moverá a la Papelera...",
    previewEmpty: "No hay nada que limpiar: la carpeta ya está vacía.",
    previewNotAccessible:
      "El contenido no se puede leer sin permisos de administrador; el proceso autorizado lo listará y eliminará.",
    previewTruncated: "Se muestran los 500 elementos más grandes; los totales lo incluyen todo.",
    selectedSummary: "{count} elementos seleccionados · {size}",
    confirmSelected: "Limpiar seleccionados",
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
    description:
      "Ejecuta el optimizador integrado de Windows: desfragmentacion en un HDD, o TRIM en un SSD (nunca una desfragmentacion completa, que solo lo desgastaria sin beneficio).",
    button: "Optimizar ahora",
    running: "Optimizando... puede tardar unos minutos",
    resultToast: "Disco ({media}) optimizado correctamente.",
  },
  dnsFlush: {
    title: "Vaciar caché DNS",
    description:
      "Borra las direcciones DNS guardadas en memoria. Útil si un sitio cambió de servidor y tu navegador sigue mostrando la versión antigua.",
    button: "Vaciar ahora",
    running: "Vaciando...",
    resultToast: "Caché DNS vaciada.",
  },
  browserCleanup: {
    title: "Limpieza del navegador",
    description:
      "Vacía la caché y las cookies de Chrome, Edge y Firefox. El navegador los reconstruye solo en el próximo inicio, así que no se pierde nada para siempre.",
    noneFound: "No se encontró ningún navegador compatible en este PC.",
    cache: "Caché",
    cookies: "Cookies",
    clearButton: "Vaciar",
    clearing: "Vaciando...",
    runningWarning: "Cierra {browser} para poder vaciarlo.",
    clearedToast: "{browser}: {freed} liberados.",
  },
  redaxaPromo: {
    title: "Redaxa",
    description:
      "Has cortado telemetría y rastreo — pero ¿qué pegas en los chats de IA? Redaxa intercepta datos personales y credenciales antes de que un prompt llegue a cualquier modelo. Misma familia, misma regla: nada se guarda.",
    button: "Pruébalo en la web",
  },
  uninstallerPromo: {
    title: "PC Tweaker Uninstaller",
    description:
      "Elimina programas enteros de forma segura: punto de restauracion automatico, comando verificado, informe honesto. De la misma familia que PC Tweaker.",
    button: "Saber mas",
  },
  largeFiles: {
    title: "Buscar archivos grandes",
    description:
      "Busca en una carpeta los archivos mas pesados (mas de 100 MB), para que puedas liberar espacio rapidamente eliminando los que ya no necesitas.",
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
    description:
      "Elige una carpeta: encuentra archivos idénticos y te deja elegir cuáles mover a la Papelera.",
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
    licenseNeedsRefresh:
      "No podemos verificar tu suscripción Pro tras tanto tiempo sin conexión. Reconectate a internet e inténtalo de nuevo.",
    accountRefreshFailed:
      "No pudimos verificar el estado de tu cuenta. Lo que se muestra aquí puede estar desactualizado: revisa tu conexión o inténtalo más tarde.",
  },
  titlebar: {
    applied: "{applied}/{total} activos",
    cpu: "CPU",
    ram: "RAM",
    minimize: "Minimizar",
    maximize: "Maximizar",
    restore: "Restaurar",
    close: "Cerrar",
  },
  x3d: {
    title: "Alineador de die 3D V-Cache",
    subtitle:
      "En un Ryzen X3D de dos dies solo uno lleva la caché apilada. Windows no sabe cuál es y reparte el juego entre ambos: cada acceso que cruza los dies paga un viaje por el Infinity Fabric.",
    cpuLabel: "Procesador",
    readyHeadline: "Die con V-Cache encontrado: {cores} hilos",
    readyBody: "Fija un juego a este die y todos sus hilos se quedan donde está la caché grande.",
    singleDie:
      "Este procesador tiene un solo die: todos los núcleos ya ven la misma caché, así que no hay nada que alinear. La función aparece sola en una CPU de dos dies con caché asimétrica.",
    uniformCache:
      "Este procesador tiene varios dies, todos con la misma cantidad de caché. Mover un juego de uno a otro no cambiaría nada, así que la función sigue desactivada.",
    unavailable: "Windows no devolvió un mapa de cachés para este procesador.",
    dieLabel: "Die {index}",
    dieCache: "{mb} MB L3",
    dieThreads: "{count} hilos",
    vcacheBadge: "V-Cache",
    processesTitle: "Procesos en ejecución",
    processesHint: "Los más activos arriba. Elige el juego y fíjalo al die de la caché.",
    refresh: "Actualizar",
    refreshing: "Leyendo...",
    align: "Alinear",
    reset: "Restablecer",
    alignedBadge: "Alineado",
    noProcesses: "Ningún proceso lo bastante grande como para listarlo.",
    persistenceNote:
      "La afinidad pertenece al proceso en ejecución: desaparece al cerrar el juego y hay que volver a fijarla en el siguiente arranque. No se cambia ningún ajuste del sistema.",
    alignedToast: "{name} fijado al die con V-Cache.",
    resetToast: "{name} devuelto a todos los núcleos.",
  },
  hardware: {
    intro:
      "Leído directamente de los sensores de tu hardware. Donde no existe un sensor te lo decimos, en lugar de mostrar un número que nadie puede verificar.",
    gpuLabel: "Tarjeta gráfica",
    cpuLabel: "Procesador",
    liveBadge: "En directo",
    gpuDriver: "Controlador {version}",
    load: "Uso de GPU",
    vram: "Memoria de vídeo",
    fan: "Ventilador",
    power: "Consumo",
    fanIdle: "parado: no hace falta bajo 50°",
    powerLimit: "límite {limit} W",
    tempCool: "fría",
    tempGood: "óptima",
    tempWarm: "caliente",
    tempHot: "muy caliente",
    traceLabel: "Esta sesión",
    traceRange: "mín {min}° · máx {max}°",
    noTempSensor: "Esta tarjeta no expone ningún sensor de temperatura.",
    cpuAcpiSource: "leída de la zona térmica ACPI",
    cpuNoSensor:
      "El firmware de este PC no expone una zona térmica ACPI, así que Windows no tiene ninguna temperatura de CPU que leer. Las herramientas que siempre muestran una instalan un controlador a nivel de kernel para leer los registros del procesador: PC Tweaker no lo hace, y prefiere decírtelo antes que mostrarte un valor inventado.",
    noGpuTool:
      "No se detectó ninguna tarjeta NVIDIA. AMD e Intel no ofrecen una herramienta equivalente, por lo que sus temperaturas no se pueden leer sin el software del fabricante.",
    thermalsUnavailable: "No podemos leer los sensores de este sistema.",
    driversTitle: "Antigüedad de los controladores",
    driversSubtitle:
      "Cuántos años tienen los controladores del fabricante. Windows sabe qué está instalado, no qué está disponible: aquí ves la antigüedad real, nunca un aviso falso de actualización.",
    driversRescan: "Volver a analizar",
    driversScanning: "Analizando...",
    driversCounted: "{count} controladores de fabricantes",
    driversAging: "{count} de más de 2 años",
    driversStale: "{count} de más de 4 años",
    driversAllCurrent: "Todos recientes",
    driversNone: "No hay controladores de terceros en estas categorías.",
    driversShowAll: "Mostrar {count} más",
    driversShowLess: "Mostrar menos",
    driversInboxNote:
      "{count} controladores integrados de Microsoft excluidos: los mantiene Windows Update y su fecha es un marcador fijo, contarlos como antiguos sería una falsa alarma.",
    ageYears: "{years} años",
    ageYear: "{years} año",
    ageMonths: "{months} meses",
    ageMonth: "{months} mes",
    vendorSite: "Sitio del fabricante",
    watchLabel: "En observación desde hace",
    peakLabel: "Pico",
    verdictRisky: "Arriesgado",
    verdictNormal: "Normal",
    verdictBetter: "Mejor de lo esperado",
    verdictIdle: "En reposo",
    verdictRiskyHint:
      "La tarjeta superó los 84°, el punto en el que empieza a recortar su propio rendimiento para protegerse. Revisa el flujo de aire o cambia al perfil Silencioso.",
    verdictNormalHint: "Temperaturas habituales para una tarjeta bajo carga: nada preocupante.",
    verdictBetterHint:
      "Se mantuvo por debajo de 65° mientras trabajaba de verdad: mejor refrigeración que la media.",
    verdictIdleHint:
      "Todavía no ha trabajado lo suficiente para juzgar. Una tarjeta en reposo se mantiene fresca igualmente, así que no probaría nada.",
    profilesTitle: "Perfiles térmicos",
    profilesSubtitle:
      "Ajustan el límite de potencia de la tarjeta, la palanca que realmente gobierna el calor y el ruido del ventilador. Cada valor procede de los límites que declara la propia tarjeta.",
    currentLimit: "Ahora: {watts} W",
    modeSilent: "Silencioso",
    modeSilentHint:
      "Para trabajar, transmitir y sesiones largas: el ventilador queda casi mudo y la tarjeta calienta mucho menos, a cambio de unos fotogramas.",
    modeStandard: "Estándar",
    modeStandardHint:
      "Un límite equilibrado algo por debajo del techo de la tarjeta: ventilador más silencioso y temperaturas más bajas, con un coste en fotogramas de pocos puntos.",
    modeGaming: "Gaming",
    modeGamingHint:
      "Para sesiones competitivas: vatios al máximo y techo de reloj elevado, para mantener más estables los FPS mínimos cuando importa.",
    modeApplying: "Aplicando...",
    profileStageReading: "Leyendo los límites de la tarjeta",
    profileStageApplying: "Aplicando el límite",
    profileStageSettling: "Esperando la respuesta de los ventiladores",
    profileApplied: "Límite fijado en {watts} W.",
    profileNote:
      "Requiere permisos de administrador y se restablece al reiniciar. No es una curva de ventilador: NVIDIA no expone control directo del ventilador en nvidia-smi, y las herramientas que lo ofrecen usan API privadas no documentadas que esta aplicación no toca.",
    profileDefaultIsMax:
      "En esta tarjeta el límite de potencia de fábrica ya coincide con el máximo, así que Silencioso es el único perfil que cambia los vatios: Gaming se distingue subiendo el techo del reloj.",
    driverInstalled: "instalado v{version} el {date}",
    driversNoUpdateCheck:
      "Esta pantalla no contacta con ningún fabricante y no puede saber si existe una versión más reciente: muestra la versión instalada y su antigüedad, y te lleva a la página oficial para que lo compruebes tú.",
    driversCheckedAt: "Leído el {time}",
    modeClockLocked: "reloj hasta {mhz} MHz",
    modeClockAuto: "reloj automático",
    profileApply: "Aplicar perfil",
    profileActive: "Perfil activo",
    profileWillSet: "Fijará {watts} W, {clock}",
    scanStarting: "Iniciando análisis...",
    scanReading: "Leyendo la clase {class}",
    scanCount: "{done}/{total} · {pct}%",
    driversScannedAll: "{total} controladores examinados en {classes} categorías",
    winUpdateLabel: "Windows Update",
    winUpdateButton: "Buscar en Windows Update",
    winUpdateNote:
      "Esto solo revisa el catálogo propio de Windows Update, no los controladores concretos listados arriba: muchos fabricantes -sobre todo de audio y chipset integrados- nunca publican sus actualizaciones ahí, solo en su propio sitio. PC Tweaker no descarga paquetes de controladores por su cuenta: no existe una API del fabricante que diga cuál es la versión correcta para tu dispositivo exacto, e instalar el controlador de vídeo equivocado es uno de los pocos errores que puede dejarte sin pantalla.",
    winUpdateOpened: "Windows Update abierto.",
    winUpdateSearching: "Buscando...",
    winUpdateTakesAWhile: "Puede tardar un minuto: consulta el catálogo de Microsoft.",
    winUpdateInstall: "Descargar e instalar ({count})",
    winUpdateInstalling: "Descargando e instalando...",
    winUpdateNone:
      "Windows Update no tiene nada más reciente que ofrecer, incluso para los controladores marcados como antiguos arriba: muchos fabricantes publican sus actualizaciones a su manera, no a través de Windows Update.",
    winUpdateFailed: "La búsqueda falló: {detail}",
    winUpdateDone: "Instalados {installed}, fallidos {failed}.",
    rebootTitle: "Windows pide reiniciar",
    rebootBody:
      "Windows indica que una instalación solo se completa tras reiniciar. Puedes hacerlo ahora o cuando prefieras.",
    rebootNow: "Reiniciar ahora",
    rebootLater: "Más tarde",
  },
  menu: {
    account: "Cuenta",
    plan: "Plan",
    planFree: "Gratis",
    planPro: "Pro",
    viewPlan: "Ver tu plan",
    upgradeButton: "Pasar a Pro",
    language: "Idioma",
    theme: "Temas",
    about: "Acerca de",
    errorReports: "Informes de error anónimos",
    errorReportsBody:
      "Si algo falla, envía solo el mensaje de error (nunca datos personales) para ayudarnos a corregir errores. Desactivado por defecto.",
    changePhoto: "Cambiar foto de perfil",
    removePhoto: "Quitar foto",
    photoFailed: "No se pudo usar esa imagen como foto de perfil.",
    support: "Soporte",
    reportIssue: "Notificar un problema",
    aboutBody:
      "PC Tweaker — ajustes del sistema con copia de seguridad y restauración automáticas.",
    close: "Cerrar",
  },
  auth: {
    login: "Iniciar sesión",
    register: "Registrarse",
    email: "Correo electrónico",
    password: "Contraseña",
    loginButton: "Iniciar sesión",
    rememberMe: "Mantener la sesión iniciada",
    registerButton: "Crear cuenta",
    working: "...",
    logout: "Cerrar sesión",
    loggedInAs: "Sesión iniciada como {email}",
    backendNotConfigured:
      "Todavía no hay servidor conectado: configura API_BASE_URL cuando despliegues el backend.",
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
    forgotPasswordSent:
      "Si ese correo está registrado, recibirás un enlace para restablecer la contraseña.",
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
    network_latency: {
      name: "Reducir el retardo de red (algoritmo de Nagle)",
      description:
        "Windows retiene los paquetes pequenos unos milisegundos para agruparlos, y ademas retrasa los acuses de recibo. Es un buen compromiso para las descargas y malo para los juegos, donde cada paquete es pequeno y llegar tarde equivale a no llegar. Esto desactiva ambos en tu adaptador de red activo (HKLM, requiere derechos de administrador).",
    },
    disable_window_animations: {
      name: "Animaciones de ventana instantaneas",
      description:
        "Elimina la animacion que Windows reproduce al abrir, cerrar o minimizar una ventana. Esa animacion es puro tiempo de espera: quitarla hace que el escritorio responda en el instante del clic y libera el trabajo de GPU asociado (HKCU, no requiere elevacion).",
    },
    disable_drag_full_windows: {
      name: "Arrastre de ventanas mas ligero",
      description:
        "Dibuja solo el contorno mientras arrastras una ventana en lugar de repintar todo su contenido en cada fotograma. Apenas se nota en una GPU rapida, se nota claramente en graficos integrados o en un equipo antiguo (HKCU, no requiere elevacion).",
    },
    mouse_hover_delay: {
      name: "Respuesta inmediata al pasar el raton",
      description:
        "Windows espera 400 ms antes de reaccionar al puntero detenido sobre algo: vistas previas de la barra de tareas, descripciones emergentes, menus. Esto reduce la espera casi a cero, asi la interfaz sigue al raton en vez de ir por detras (HKCU, no requiere elevacion).",
    },
    disable_background_apps: {
      name: "Detener las apps en segundo plano",
      description:
        "Impide que las aplicaciones de la Store se ejecuten, se actualicen y consulten la red mientras no las usas. Es CPU, RAM y bateria reales gastadas en aplicaciones que no has abierto (HKCU, no requiere elevacion).",
    },
    disable_delivery_optimization: {
      name: "Dejar de compartir las actualizaciones de Windows",
      description:
        "De forma predeterminada Windows sube los archivos de actualizacion descargados a otros PC usando tu conexion. Esto limita Delivery Optimization a tu propio equipo, para que esa subida no consuma ancho de banda mientras juegas (HKLM, requiere derechos de administrador).",
    },
    disable_copilot: {
      name: "Desactivar Windows Copilot",
      description:
        "Quita el asistente Copilot de la barra de tareas e impide que se ejecute en segundo plano. Windows lo activa por defecto y en Configuración no hay un interruptor definitivo: esto aplica la directiva del sistema que lo apaga para siempre (HKCU, no requiere elevación).",
    },
    disable_suggested_apps: {
      name: "Impedir que Windows instale aplicaciones por su cuenta",
      description:
        "Windows instala en silencio aplicaciones y juegos «sugeridos» en tu menú Inicio sin preguntarte, al instalar y de nuevo tras las actualizaciones grandes. Esto lo desactiva: en tu equipo ya no aparece nada que no hayas elegido tú (HKCU, no requiere elevación).",
    },
    disable_mouse_acceleration: {
      name: "Desactivar la aceleración del ratón",
      description:
        "Desactiva «Mejorar la precisión del puntero», que hace que el cursor recorra más distancia cuando mueves el ratón deprisa. Esa respuesta variable es justo lo que no quieres al apuntar: el mismo gesto debe cubrir siempre la misma distancia en pantalla (HKCU, no requiere elevación).",
    },
    disable_sticky_keys_prompt: {
      name: "Eliminar el aviso de Teclas especiales",
      description:
        "Pulsar Mayús cinco veces abre el cuadro de Teclas especiales, lo que en un juego significa salir de pantalla completa en el peor momento, normalmente en pleno combate. Esto desactiva el atajo y su aviso; las Teclas especiales siguen disponibles en Configuración (HKCU, no requiere elevación).",
    },
    disable_recall: {
      name: "Desactivar Recall (capturas de pantalla con IA)",
      description:
        "Recall captura tu pantalla cada pocos segundos y construye un historial indexado por IA de todo lo que has mirado: contraseñas y mensajes privados incluidos, porque graba lo que haya en pantalla. Esto aplica la directiva del sistema que le impide analizar o guardar nada (HKLM, requiere derechos de administrador).",
    },
    disable_memory_integrity: {
      name: "Desactivar Integridad de memoria (VBS)",
      description:
        "La Integridad de memoria ejecuta partes de Windows dentro de un contenedor virtualizado, y eso cuesta CPU en cada transición al kernel: por eso desactivarla es la mayor ganancia de fotogramas disponible sin pagar nada. El compromiso debe quedar claro: es una función de seguridad real, y apagarla elimina la protección frente a controladores maliciosos. Tiene sentido en un PC dedicado al juego, no en uno de trabajo. Surte efecto tras reiniciar (HKLM, requiere derechos de administrador).",
    },
    disable_typing_personalization: {
      name: "Impedir que Windows aprenda cómo escribes",
      description:
        "Windows crea un diccionario personal a partir de lo que escribes con el teclado y a mano —también en gestores de contraseñas, chats y cuadros de búsqueda— y lo sincroniza con tu cuenta de Microsoft para mejorar sus sugerencias. Esto desactiva tanto la recopilación de texto como la de escritura a mano (HKCU, no requiere elevación).",
    },
    classic_context_menu: {
      name: "Recuperar el menú contextual completo",
      description:
        "Windows 11 esconde la mayor parte del menú del botón derecho tras «Mostrar más opciones», convirtiendo un clic en dos para cosas que haces todo el día. Esto restaura el menú completo de Windows 10 en todas partes, en el Explorador y en el escritorio. El Explorador se reinicia para aplicarlo, así que las ventanas abiertas parpadearán una vez (HKCU, no requiere elevación).",
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
      description:
        "Muestra archivos y carpetas ocultos en el Explorador de archivos (HKCU, sin elevación requerida).",
    },
    priority_separation: {
      name: "Optimizar prioridad del procesador",
      description:
        "Ajusta Win32PrioritySeparation (0x26) para dar a la aplicación en primer plano cuantos de CPU cortos y variables con prioridad 3x — el valor clásico de capacidad de respuesta para escritorio/juegos (HKLM, requiere privilegios de administrador).",
    },
    disable_game_dvr: {
      name: "Desactivar Xbox Game Bar / Game DVR",
      description:
        "Desactiva la grabación en segundo plano de Xbox Game Bar, que consume CPU/GPU durante el juego (HKCU, sin elevación requerida).",
    },
    disable_telemetry_tasks: {
      name: "Reducir la recopilación de datos de diagnóstico",
      description:
        "Establece el nivel de diagnóstico de Windows al mínimo permitido (HKLM, requiere privilegios de administrador).",
    },
    reset_advertising_id: {
      name: "Desactivar ID de publicidad",
      description:
        "Impide que las apps usen tu ID de publicidad para elaborar perfiles (HKCU, sin elevación requerida).",
    },
    disable_location_tracking: {
      name: "Desactivar seguimiento de ubicación",
      description:
        "Bloquea el acceso a la ubicación para todas las apps mediante directiva del sistema (HKLM, requiere privilegios de administrador).",
    },
    disable_bing_search: {
      name: "Desactivar la búsqueda de Bing en el menú Inicio",
      description:
        "Impide que tus búsquedas del menú Inicio se envíen a Bing (HKCU, sin elevación requerida).",
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
    keep_kernel_in_ram: {
      name: "Mantener el kernel y los controladores en la RAM",
      description:
        "Windows puede pasar al disco partes del kernel y del código de los controladores incluso cuando sobra memoria, y volver a leerlas es una pausa que notas como un tirón. Esto los mantiene en memoria. Merece la pena si te sobra RAM; en un PC con poca memoria déjalo desactivado (HKLM, requiere permisos de administrador).",
    },
    auto_end_frozen_tasks: {
      name: "Que una app colgada no bloquee el apagado",
      description:
        'Cuando una aplicación deja de responder durante el apagado, Windows espera y muestra la pantalla "Esta aplicación impide el apagado" hasta que alguien hace clic. Esto cierra solo las aplicaciones que no responden, para que un programa colgado no deje el equipo encendido (HKCU, sin elevación).',
    },
    instant_folder_loading: {
      name: "Abrir cada carpeta al instante",
      description:
        "El Explorador inspecciona el contenido de una carpeta para adivinar si es Imágenes, Música o Documentos, y una carpeta con miles de archivos multimedia puede quedarse bloqueada varios segundos mientras decide. Esto fija todas las carpetas al diseño general, para que se abran de inmediato (HKCU, sin elevación).",
    },
    tcp_congestion_bbr: {
      name: "Ping estable aunque la línea esté ocupada (BBR2)",
      description:
        "Windows usa CUBIC, que acelera hasta que algún búfer se desborda: por eso el ping sube en cuanto otra persona de la casa empieza una descarga. BBR2 mide el ancho de banda real y el tiempo de ida y vuelta de la línea y marca el ritmo en consecuencia, de modo que la tubería se llena sin llenar la cola. Microsoft incluye BBR2 en Windows 11; esto pasa la plantilla de Internet a BBR2 y sabe volver exactamente a como estaba (requiere permisos de administrador).",
    },
    taskbar_align_left: {
      name: "Alinear la barra de tareas a la izquierda",
      description:
        "Vuelve a alinear los iconos de la barra de tareas a la izquierda (estilo Windows 10) en vez de al centro (HKCU, no requiere elevación).",
    },
    hide_taskbar_chat: {
      name: "Ocultar Chat/Teams de la barra de tareas",
      description:
        "Elimina el icono de Chat (Microsoft Teams) de la barra de tareas (HKCU, no requiere elevación).",
    },
    disable_start_suggestions: {
      name: "Desactivar sugerencias y apps recomendadas en el menú Inicio",
      description:
        "Evita que Windows muestre apps recomendadas, anuncios y sugerencias en el menú Inicio (HKCU, no requiere elevación).",
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
      description:
        "Mueve el contenido de %TEMP% a la Papelera: puedes recuperarlo en cualquier momento, no es un borrado definitivo.",
    },
    winupdate_cache_cleanup: {
      name: "Vaciar la caché de Windows Update",
      description:
        "Mueve a la Papelera los paquetes de Windows Update ya instalados (requiere privilegios de administrador).",
    },
  },
};

const de: Strings = {
  appName: "PC Tweaker",
  appliedCount: "{applied} von {total} Optimierungen aktiv",
  headerNote:
    "Jede Optimierung sichert den ursprünglichen Wert, bevor sie angewendet wird. Optimierungen mit erhöhten Rechten fragen gezielt per UAC nach, nur für diese Aktion.",
  advisor: {
    eyebrow: "Für deinen PC empfohlen",
    applyButton: "Anwenden",
    confidenceHigh: "Hohe Zuverlässigkeit — basierend auf der Hardware dieses PCs",
    confidenceStandard: "Empfohlen für diesen Gerätetyp",
    reversible: "Umkehrbar — der ursprüngliche Wert wird vor jeder Änderung gespeichert.",
    empty:
      "Derzeit nichts zu empfehlen — deine Konfiguration entspricht bereits unseren Empfehlungen.",
  },
  drift: {
    titleAfterUpdate: "Windows hat Ihre Einstellungen zurückgesetzt",
    titleNoUpdate: "Einige Einstellungen sind nicht mehr aktiv",
    afterUpdateOne:
      "Nach dem Update auf {patch} ist eine von Ihnen angewendete Optimierung im System nicht mehr aktiv.",
    afterUpdateMany:
      "Nach dem Update auf {patch} sind {count} von Ihnen angewendete Optimierungen im System nicht mehr aktiv.",
    noUpdateOne:
      "Eine von Ihnen angewendete Optimierung ist im System nicht mehr aktiv. Zwischenzeitlich gab es kein Windows-Update, also hat etwas anderes sie geändert.",
    noUpdateMany:
      "{count} von Ihnen angewendete Optimierungen sind im System nicht mehr aktiv. Zwischenzeitlich gab es kein Windows-Update, also hat etwas anderes sie geändert.",
    reapplyOne: "Optimierung erneut anwenden",
    reapplyMany: "{count} Optimierungen erneut anwenden",
    reapplying: "Wird angewendet...",
    reappliedOne: "Optimierung erneut angewendet.",
    reappliedMany: "{count} Optimierungen erneut angewendet.",
  },
  crashes: {
    title: "Unerwartete Abstürze",
    subtitle:
      "Die App hat sich von selbst beendet. Der Bericht bleibt auf diesem PC: Kopieren Sie ihn und schicken Sie ihn über Discord oder GitHub, wenn er behoben werden soll.",
    copy: "Bericht kopieren",
    copied: "Bericht in die Zwischenablage kopiert.",
    clear: "Löschen",
    cleared: "Berichte gelöscht.",
    processApp: "Hauptfenster",
    processElevated: "Vorgang mit Administratorrechten",
  },
  ledger: {
    title: "Änderungsprotokoll",
    subtitle:
      "Alles, was diese App auf diesem PC geändert hat, neueste zuerst. Lokal gespeichert, nie hochgeladen.",
    empty:
      "Noch keine Änderungen aufgezeichnet. Wende deinen ersten Tweak an und er erscheint hier.",
    clear: "Verlauf löschen",
    clearing: "Wird gelöscht...",
    cleared: "Verlauf gelöscht.",
    revert: "Zurücksetzen",
    elevated: "mit Adminrechten",
    failed: "fehlgeschlagen",
    actions: {
      applied: "Tweak angewendet",
      reverted: "Tweak zurückgesetzt",
      cleanup: "Bereinigung",
      filesDeleted: "Dateien gelöscht",
      diskOptimize: "Datenträgeroptimierung",
      startupChange: "Autostart-Änderung",
      restorePoint: "Wiederherstellungspunkt",
    },
  },
  tabs: {
    groupMonitor: "Überwachen",
    groupOptimize: "Optimieren",
    groupManage: "Verwalten",
    scan: "Systemscan",
    health: "PC-Zustand",
    hardware: "Hardware",
    performance: "Leistung",
    privacy: "Datenschutz",
    ui: "Oberfläche",
    manutenzione: "Wartung",
    gaming: "Gaming",
    startup: "Autostart",
    profiles: "Konfigurationen",
    pricing: "Tarife & Preise",
    ledger: "Verlauf",
  },
  healthPanel: {
    title: "PC-Zustand",
    subtitle: "Ein erklärbarer Wert: jede Zahl zeigt die Fakten, aus denen sie berechnet wurde.",
    why: "Warum {score}?",
    refresh: "Neu berechnen",
    compute: "Wert berechnen",
    showMore: "Details anzeigen",
    showLess: "Details ausblenden",
    stageProfile: "Systemprofil wird gelesen",
    stageTweaks: "Angewendete Tweaks werden geprüft",
    stageSecurity: "Sicherheitsstatus wird gelesen",
    stageScoring: "Bewertung läuft",
    verdictExcellent: "AUSGEZEICHNET",
    verdictGood: "GUT",
    verdictFair: "ORDENTLICH",
    verdictNeedsWork: "VERBESSERUNGSWÜRDIG",
    computing: "Analyse läuft...",
    idleHint:
      "Nichts läuft im Hintergrund: Der Wert wird nur auf Ihre Anfrage berechnet, vollständig auf diesem PC.",
    baselineTitle: "Basiswert",
    baselineHint:
      "Schnelle, wiederholbare Messungen — nur mit früheren Läufen auf diesem PC vergleichbar.",
    baselineRun: "Basiswert messen",
    baselineRunning: "Messung läuft (~5 s)...",
    baselineEmpty: "Noch keine Basiswerte. Einen vor den Änderungen messen, einen danach.",
    changeSinceLast: "seit Ihrer letzten Prüfung",
    changeNone: "Keine Änderung seit Ihrer letzten Prüfung.",
    changeFirstRun:
      "Erste Messung gespeichert. Führen Sie sie nach einer Änderung erneut aus, um zu sehen, was sich bewegt hat.",
    changeWhyTitle: "Warum sich der Wert geändert hat",
    changeContributes: "Beitrag zum Gesamtwert:",
    changeStructural:
      "Ein App-Update hat geändert, welche Kategorien bewertet werden - ein Teil dieser Differenz stammt nicht von Ihrem PC.",
    changeTrend: "Verlauf",
    categories: {
      performance: "Leistung",
      gaming: "Gaming",
      responsiveness: "Reaktionsschnelligkeit",
      memory: "Arbeitsspeicher",
      storage: "Speicherplatz",
      startup: "Autostart",
      maintenance: "Wartung",
      privacy: "Datenschutz",
      security: "Sicherheit",
    },
  },
  transparency: {
    title: "Was genau geändert wird",
    key: "Schlüssel",
    value: "Wert",
    setsTo: "Setzt auf",
    note: "Der vorherige Wert wird vor dem Schreiben gesichert - die Wiederherstellung setzt ihn exakt zurück.",
    kindRegistry: "Registrierung",
    kindCommand: "Befehl",
    kindService: "Dienst",
    copy: "Kopieren",
    copied: "Kopiert",
  },
  command: {
    statusQuiet: "Alles ruhig",
    statusScanning: "Analyse läuft...",
    statusFindings: "{count} Empfehlungen bereit",
    domainsLine: "Autostart · Speicherplatz · Arbeitsspeicher · Datenschutz · Leistung · Updates",
    consent: "Nichts ändert sich ohne deine Zustimmung.",
    runScan: "Systemanalyse starten",
    reviewFindings: "{count} Empfehlungen ansehen",
    memTitle: "Speicherdruck",
    pressureLow: "Niedrig",
    pressureElevated: "Erhöht",
    pressureHigh: "Hoch",
    memReview: "Speichernutzung prüfen",
    memTopTitle: "Top-Prozesse",
    trimTitle: "Working Sets trimmen",
    trimExplainer:
      "Bittet Windows, inaktive Seiten aus den Working Sets der Apps zu verschieben (EmptyWorkingSet). Nützlich bei hohem Druck; Apps laden Seiten beim nächsten Zugriff kurz nach. Es gehen keine Daten verloren.",
    trimButton: "Jetzt trimmen",
    autoTitle: "Automatisches Trimmen",
    profilesTitle: "Sitzungsprofile",
    profileGame: "Spielsitzung",
    profileGameDesc: "Bereitet den PC aufs Spielen vor: Energie, Priorität und DVR-Aufnahme.",
    profileFocus: "Fokus",
    profileFocusDesc: "Weniger Ablenkung, unwichtige Aktivität unter Kontrolle.",
    profileQuiet: "Leise Sitzung",
    profileQuietDesc: "Effizienz, Akku und wenig Lärm zuerst.",
    profileDownload: "Download-Sitzung",
    profileDownloadDesc: "Steuert Bandbreite und Hintergrundaktivität.",
    previewBtn: "Änderungen ansehen",
    gameChange1: "Deaktiviert Game DVR (Hintergrundaufnahme)",
    gameChange2: "Wechselt zum Energiesparplan Höchstleistung",
    gameChange3: "Optimiert die CPU-Priorität für Spiele (Win32PrioritySeparation)",
    previewReq: "Erfordert Administratorrechte · Pro-Funktion",
    previewCost: "Möglicher Preis: mehr Verbrauch und Wärme, solange aktiv.",
    previewRevert: "Mit einem Klick umkehrbar: jeder Originalwert wird vorher gesichert.",
    applySession: "Sitzung starten",
    restoreSession: "Wiederherstellen",
    statusActive: "Aktiv",
    statusOff: "Nicht aktiv",
    soon: "Bald verfügbar",
  },
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
    refresh: "Aktualisieren",
    refreshing: "Neu einlesen...",
    hiddenOrphans: "{count} Einträge ausgeblendet: das Programm ist nicht mehr installiert.",
  },
  search: {
    placeholder: "Tweak suchen...",
    noResults: 'Keine Treffer für "{query}".',
    clear: "Löschen",
  },
  pricing: {
    eyebrow: "Alles freischalten",
    title: "Entscheide, wie weit du gehst",
    subtitle:
      "Jede Änderung sichert zuerst den vorherigen Stand - alles hier ist einen Klick vom Rückgängig entfernt. Kostenlos deckt das Wesentliche ab, Pro öffnet den Rest.",
    monthly: "Monatlich",
    annual: "Jährlich",
    lifetime: "Lebenslang",
    saveBadge: "{percent}% SPAREN",
    perMonth: "/Monat",
    perYear: "/Jahr",
    once: "einmalig",
    lifetimeDetail:
      "Einmal bezahlt, für immer Ihres. Nach {months} Monaten ist es gegenüber dem Jahresplan bezahlt, danach kostet es nichts mehr",
    annualDetail: "Das sind {monthly} pro Monat, einmal jährlich mit {yearly} abgebucht",
    annualNudge: "Im Jahrestarif wären es {price} pro Monat",
    mostChosen: "AM HÄUFIGSTEN GEWÄHLT",
    freeName: "Free",
    freeTagline: "Alles für einen saubereren, flotteren PC.",
    freePriceNote: "Für immer kostenlos, ohne Ablauf",
    freeCta: "Du nutzt den Free-Tarif",
    freeCurrent: "Aktueller Tarif",
    proName: "Pro",
    proTagline:
      "Alle Tweaks, auch die mit Administratorrechten und die, die du sonst von Hand in der Registry setzen würdest.",
    proCta: "Zu Pro wechseln",
    proCurrent: "Dein Tarif",
    manageBilling: "Abo verwalten",
    everythingInFree: "Alles aus Free, dazu:",
    reassurance:
      "Jederzeit kündbar. Jede Änderung bleibt mit einem Klick rückgängig zu machen, auch nach der Kündigung.",
    freeFeatures: [
      "{count} echte Tweaks, jeder gesichert und umkehrbar",
      "Live-Systemmonitor (CPU, Arbeitsspeicher, Datenträger)",
      "Verwaltung der Autostart-Programme",
      "Passwort-Datenleck-Prüfung",
      "PC-Scan und Behebung mit einem Klick",
      "Bereinigung temporärer Dateien",
    ],
    proFeatures: [
      "Game Sessions: Turbo aktiviert sich beim Spielstart von selbst",
      "Turbo-Gaming-Preset und höchste Priorität für Spiele",
      "Erweiterter Datenschutz: Telemetrie und Aktivitätsverlauf",
      "Findet und entfernt doppelte Dateien",
      "Leert den Windows-Update-Cache",
      "Deaktiviert die Indizierung, die den Datenträger belastet",
      "Jeder Tweak und jede künftige Funktion inklusive",
    ],
  },
  toggle: { on: "Ein", off: "Aus" },
  driverBooster: {
    title: "Driver Booster",
    subtitle:
      "Wähle die Treiber, die in die Jahre kommen, und öffne alle ihre Download-Seiten auf einmal.",
    scan: "Treiber prüfen",
    scanning: "Wird geprüft...",
    selectAll: "Alle auswählen",
    selectNone: "Auswahl aufheben",
    selectedCount: "{selected} von {total} ausgewählt",
    pagesForSelection: "{pages} Seiten zu öffnen",
    openSelected: "Download-Seiten öffnen ({count})",
    opened: "{count} Seiten geöffnet",
    openedCapped:
      "{opened} von {total} Seiten geöffnet: der Rest bleibt ausgewählt, einfach erneut ausführen.",
    allCurrent: "Kein Treiber zeigt sein Alter.",
    nothingActionable: "Kein alternder Treiber hat eine Herstellerseite zum Öffnen.",
    note: "PC Tweaker lädt Treiberpakete nicht selbst herunter: es gibt keine Hersteller-API, die sagt, welche Version für genau dein Gerät richtig ist, und den falschen Grafiktreiber zu installieren ist einer der wenigen Fehler, der dich ohne Bildschirm zurücklassen kann. Das hier automatisiert den mühsamen Teil — die Seiten zu finden — nicht die Entscheidung. Für Treiber, die Windows Update wirklich kennt, nimm die Schaltfläche oben.",
  },
  secureDefrag: {
    title: "Sichere Defragmentierung",
    willDefrag: "Dieses Laufwerk ist mechanisch: eine echte Defragmentierung wird ausgeführt.",
    willRetrim:
      "Dieses Laufwerk ist nicht bestätigt mechanisch: das gesamte Volume wird analysiert, dann läuft ein Retrim statt einer Defragmentierung. Das Retrim dauert Sekunden und betrifft nur den freien Speicher — genau das ist seine Aufgabe: dem Controller mitzuteilen, welche Blöcke nicht mehr belegt sind. Eine SSD zu defragmentieren macht sie nicht schneller, nur älter.",
    start: "Starten",
    running: "Läuft...",
    working: "Wird bearbeitet...",
    phaseAnalyze: "Analyse",
    phaseOptimize: "Optimierung",
    analysisTitle: "Analysebericht",
    doneDefrag: "Defragmentierung abgeschlossen.",
    doneRetrim: "Retrim abgeschlossen.",
    note: "Zuvor wird ein Wiederherstellungspunkt erstellt. Der Prozentwert kommt von Windows selbst, nicht von einem Timer.",
  },
  zeroTrace: {
    title: "Zero-Trace Cleaner",
    subtitle:
      "Entfernt, was geschlossene Programme im Speicher hinterlassen, und vernichtet Dateien unwiederbringlich.",
    purgeTitle: "Speicherbereinigung",
    purgeBody:
      "Windows behält die Seiten geschlossener Programme als Cache im RAM. Dies gibt sie frei: Fragmente eines beendeten Prozesses verschwinden wirklich aus dem physischen Speicher.",
    purgeButton: "Speicher leeren",
    purging: "Wird geleert...",
    purgeResult: "{freed} MB freigegeben — jetzt {after} MB frei",
    purgeLimit:
      "Auslagerungs- und Ruhezustandsdatei bleiben unberührt: sie liegen auf der Platte, und Windows bietet keine Laufzeit-API, um sie zu bereinigen.",
    shredTitle: "Sicheres Dateischreddern",
    shredBody:
      "Überschreibt den Dateiinhalt in drei Durchläufen vor dem Löschen — außer Reichweite üblicher Wiederherstellungswerkzeuge.",
    shredButton: "Dateien wählen...",
    shredding: "Wird vernichtet...",
    shredDone: "{count} Dateien vernichtet ({size})",
    shredSummary: "{shredded} vernichtet, {skipped} übersprungen",
    shredWarning: "Endgültig: kein Papierkorb, keine Wiederherstellung.",
    ssdCaveat:
      "Auf einer SSD schreibt Wear-Levelling fast immer in andere Zellen als das Original. Die alten werden freigegeben, nicht überschrieben — mehr garantiert nur das Secure-Erase des Laufwerks.",
  },
  hud: {
    title: "Spiel-Overlay",
    subtitle:
      "Ein transparentes Panel über dem Spiel: CPU-/GPU-Last, Temperaturen, VRAM, aktiver Prozess samt Priorität und ein Engpass-Indikator.",
    fpsAbout:
      "Die Bildrate wird aus den Present-Ereignissen gezählt, die Windows für jedes Bild ausgibt — dieselbe Quelle, die PresentMon liest, ohne etwas im Spiel einzuklinken. Erfordert den Start als Administrator, denn eine Ablaufverfolgungssitzung zu öffnen ist ein privilegierter Vorgang.",
    fpsLowExplained:
      "Neben dem Durchschnitt steht DROP: die Rate des schlechtesten Prozents der Bilder, andernorts 1% Low genannt. Das ist die Zahl, die sich bewegt, wenn ein Spiel stockt, während der Durchschnitt hoch bleibt und nichts davon verrät. Je näher DROP am Durchschnitt liegt, desto flüssiger läuft es.",
    fpsStart: "FPS messen",
    fpsStop: "Messung beenden",
    fpsNeedsAdmin: "Zum Messen der Bildrate muss PC Tweaker als Administrator gestartet werden.",
    fpsRunning:
      "Messung läuft: Die Bildrate erscheint im Overlay, sobald ein Spiel zu zeichnen beginnt.",
    show: "Anzeigen",
    hide: "Ausblenden",
    lock: "Sperren",
    unlock: "Entsperren",
    dragHint:
      "Ziehen Sie das Overlay an die gewünschte Stelle und sperren Sie es vor dem Spielstart.",
    lockedHint: "Gesperrt: Klicks gehen hindurch zum Spiel. Zum Verschieben entsperren.",
    sizeCompact: "Kompakt",
    sizeNormal: "Normal",
  },
  updater: {
    title: "Update verfügbar: v{version}",
    body: "Wird in einem Schritt heruntergeladen und installiert; die App startet danach von selbst neu.",
    install: "Installieren und neu starten",
    later: "Später",
    downloading: "Wird heruntergeladen... {percent}%",
    installing: "Wird installiert...",
    error: "Update fehlgeschlagen: {message}",
    checkFailed: "Update-Prüfung fehlgeschlagen: {message}",
  },
  badges: { admin: "Admin", pro: "PRO", soon: "DEMNÄCHST" },
  emptyCategory: "In dieser Kategorie sind noch keine Optimierungen verfügbar — bald verfügbar.",
  gameSessions: {
    title: "Game Sessions",
    subtitle:
      "Erkennt deine Spiele automatisch und wendet das Turbo-Gaming-Preset selbstständig an/rückgängig.",
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
    loadLabel: "CPU-LAST",
    stageReading: "Energieplan wird gelesen",
    stageRaising: "Boost-Grenze wird angehoben",
    stageApplying: "Wird auf das System angewendet",
    modeAggressive: "Aggressiver Modus",
    modeDefault: "Standardmodus",
    stageMeasuringBefore: "Messung vorher",
    stageMeasuringAfter: "Erneute Messung",
    gainMeasured: "{factor}x schneller",
    gainSlight: "{factor}x schneller - moderater Gewinn",
    gainAtCeiling: "Bereits am Maximum: Diese CPU hatte keinen Spielraum mehr",
    ceilingLocked: "Boost-Grenze gesperrt",
    ceilingUnlocked: "Boost-Grenze freigegeben",
  },
  profiles: {
    title: "Konfigurationen",
    subtitle:
      "Sichern Sie Ihre Einstellungen, stellen Sie sie mit einem Klick wieder her, oder geben Sie sie weiter.",
    saveHeading: "Aktuelle sichern",
    namePlaceholder: "Name (z. B. Gaming)",
    saveButton: "Sichern",
    savedHeading: "Gesichert",
    empty: "Noch keine gesicherten Konfigurationen.",
    tweakCount: "{count} Optimierungen",
    apply: "Anwenden",
    applying: "Wird angewendet...",
    exportButton: "Exportieren",
    importButton: "Aus Datei importieren",
    deleteButton: "Loeschen",
    savedToast: 'Konfiguration "{name}" gesichert',
    appliedToast: "{count} Optimierungen angewendet",
    exportedToast: "Datei exportiert",
    importedToast: "Importiert: {count} Optimierungen zur Pruefung",
    droppedWarning: "{count} von dieser Version nicht erkannte Eintraege wurden verworfen",
    nameRequired: "Geben Sie der Konfiguration einen Namen",
    reviewNotice:
      "Eine importierte Konfiguration wird nie von selbst angewendet - Sie pruefen sie zuerst.",
    signInRequired:
      "Melden Sie sich an oder erstellen Sie ein Konto, um Konfigurationen zu speichern.",
  },
  scan: {
    title: "Schnellscan",
    subtitle:
      "Prüft den Zustand deines PCs und findet noch nicht aktive Optimierungen, mit einem Klick.",
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
    verdictRecommended: "Auf diesem PC empfohlen",
    verdictNotRecommended: "Auf diesem PC nicht empfohlen",
    verdictUnsupported: "Nicht unterstützt",
    reasons: {
      laptop_battery: "dieser PC ist ein Notebook: Es kostet mehr Akkulaufzeit, als es bringt",
      hdd_index_cost: "die Systemfestplatte ist mechanisch, die Hintergrundindizierung ist spürbar",
      fast_disk_no_gain:
        "die Systemplatte ist NVMe und schnell genug, dass der Gewinn vernachlässigbar ist",
      needs_win10_2004: "erfordert Windows 10 Version 2004 oder neuer",
      weak_gpu: "integrierte Grafik: Transparenz kostet sie nutzbare Leistung",
    },
    thisPc: "Dieser PC",
    dashDrivesTitle: "Speicher",
    dashFreeOf: "{free} frei von {total}",
    dashAlmostFull: "Fast voll",
    dashStartupTitle: "Autostart-Apps",
    dashStartupCount: "{on} von {total} aktiv",
    dashManage: "Verwalten",
    dashUptimeTitle: "Eingeschaltet seit",
    dashUptimeDh: "{days}T {hours}h",
    dashUptimeHm: "{hours}h {minutes}min",
    dashUptimeLongHint:
      "Dieser PC wurde länger nicht neu gestartet. Ein Neustart wendet ausstehende Updates an und gibt zurückgehaltenen Speicher frei.",
    dashHistoryTitle: "Letzte Aktionen",
    dashHistoryEmpty: "Noch nichts. Deine Aktionen erscheinen hier.",
    dashActTweakApplied: "Tweak angewendet",
    dashActTweakReverted: "Tweak zurückgesetzt",
    dashActCleanup: "Bereinigung",
    dashActFilesDeleted: "Dateien gelöscht",
    dashActStartupChange: "Autostart geändert",
    dashActDiskOptimize: "Laufwerk optimiert",
    dashActRestorePoint: "Wiederherstellungspunkt",
    profileUnknown: "Nicht erkannt",
    diskHdd: "HDD",
    diskSsd: "SSD",
    diskNvme: "NVMe",
    formDesktop: "Desktop",
    formLaptop: "Notebook",
    groupRecommended: "Fuer diesen PC empfohlen",
    groupOptional: "Optional",
    groupNotRecommended: "Hier nicht empfohlen",
    tailoredNote: "Jeder Punkt wird an der Hardware oben gemessen, nicht an einer festen Liste.",
    fixRecommended: "Die {count} empfohlenen anwenden",
    fixEverything: "Auswahl anwenden ({count})",
    nothingSelected: "Nichts ausgewaehlt",
    foundHeadline: "{count} auf diesem PC verbesserbar",
    foundNone: "Nichts zu tun",
    doneTitle: "Fertig!",
    doneBody: "{count} Optimierungen angewendet. Dein PC ist bereit.",
    fixHeading: "Bereit zum Anwenden",
  },
  ram: {
    title: "RAM freigeben",
    subtitle:
      "Fordert Windows auf, Speicher freizugeben, den Programme belegen, aber nicht nutzen. So oft ausführbar, wie du willst.",
    button: "Jetzt freigeben",
    cleaning: "Wird bereinigt...",
    freed: "{amount} freigegeben",
    freedNothing: "Der Speicher war bereits optimiert",
    inUse: "{used} von {total} belegt",
    autoLabel: "Automatische Bereinigung",
    autoOff: "Aus",
    autoEvery: "Alle {interval}",
    autoHint:
      "Bei aktiver automatischer Bereinigung gibt PC Tweaker den RAM selbstständig in regelmäßigen Abständen frei, solange die App geöffnet bleibt.",
    autoNext: "Nächste Bereinigung um {time}",
    autoDue: "Bereinigung steht an...",
    autoLast: "Zuletzt um {time}: {amount} freigegeben",
    autoNoneYet: "Es wurde noch keine automatische Bereinigung ausgeführt.",
    autoFailed: "Der letzte Versuch ist fehlgeschlagen: {detail}",
  },
  restore: {
    button: "Alles zurücksetzen",
    title: "Alle Änderungen zurücksetzen?",
    body: "Die {count} aktiven Optimierungen werden deaktiviert und jeder Wert exakt so wiederhergestellt, wie er vorher war. Es gehen keine Daten verloren.",
    confirm: "Ja, alles zurücksetzen",
    cancel: "Abbrechen",
    running: "Wird zurückgesetzt...",
    doneToast: "{count} Optimierungen zurückgesetzt.",
    nothingToast: "Es gibt nichts zurückzusetzen.",
  },
  passwordCheck: {
    title: "Passwort-Datenleck-Prüfung",
    description:
      "Prüft, ob ein Passwort in einem bekannten Datenleck aufgetaucht ist, ohne es je vollständig zu senden: Es wird nur ein Fragment seines Hashes gesendet (k-Anonymität, derselbe Standard wie bei Have I Been Pwned).",
    placeholder: "Ein zu prüfendes Passwort einfügen",
    button: "Prüfen",
    checking: "Wird geprüft...",
    safe: "In keinem bekannten Datenleck gefunden. Gutes Zeichen.",
    breached:
      "In {count} bekannten Datenlecks gefunden. Ändere es sofort, überall wo du es verwendest.",
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
    previewLoading: "Es wird berechnet, was in den Papierkorb verschoben wird...",
    previewEmpty: "Nichts zu bereinigen - der Ordner ist bereits leer.",
    previewNotAccessible:
      "Der Inhalt kann ohne Administratorrechte nicht gelesen werden; der autorisierte Prozess listet und entfernt ihn.",
    previewTruncated: "Die 500 größten Elemente werden angezeigt; die Summen umfassen alles.",
    selectedSummary: "{count} Elemente ausgewählt · {size}",
    confirmSelected: "Auswahl bereinigen",
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
    description:
      "Fuhrt das integrierte Windows-Optimierungstool aus: Defragmentierung bei einer HDD oder TRIM bei einer SSD (nie eine vollstandige Defragmentierung, die sie nur unnotig abnutzen wurde).",
    button: "Jetzt optimieren",
    running: "Optimierung lauft... kann einige Minuten dauern",
    resultToast: "Laufwerk ({media}) erfolgreich optimiert.",
  },
  dnsFlush: {
    title: "DNS-Cache leeren",
    description:
      "Löscht zwischengespeicherte DNS-Einträge. Nützlich, wenn eine Website den Server gewechselt hat und dein Browser weiterhin die alte Version anzeigt.",
    button: "Jetzt leeren",
    running: "Wird geleert...",
    resultToast: "DNS-Cache geleert.",
  },
  browserCleanup: {
    title: "Browser-Bereinigung",
    description:
      "Leert Cache und Cookies von Chrome, Edge und Firefox. Der Browser baut sie beim nächsten Start von selbst wieder auf, es geht also nichts endgültig verloren.",
    noneFound: "Kein unterstützter Browser auf diesem PC gefunden.",
    cache: "Cache",
    cookies: "Cookies",
    clearButton: "Leeren",
    clearing: "Wird geleert...",
    runningWarning: "Schließe {browser}, um ihn zu leeren.",
    clearedToast: "{browser}: {freed} freigegeben.",
  },
  redaxaPromo: {
    title: "Redaxa",
    description:
      "Telemetrie und Tracking sind aus — aber was fügst du in KI-Chats ein? Redaxa fängt persönliche Daten und Zugangsdaten ab, bevor ein Prompt irgendein Modell erreicht. Gleiche Familie, gleiche Regel: nichts wird gespeichert.",
    button: "Im Web ausprobieren",
  },
  uninstallerPromo: {
    title: "PC Tweaker Uninstaller",
    description:
      "Entferne ganze Programme sicher: automatischer Wiederherstellungspunkt, gepruefter Befehl, ehrlicher Bericht. Aus derselben Familie wie PC Tweaker.",
    button: "Mehr erfahren",
  },
  largeFiles: {
    title: "Grosse Dateien finden",
    description:
      "Durchsucht einen Ordner nach den grossten Dateien (uber 100 MB), damit du schnell Speicherplatz freigeben kannst, indem du nicht mehr benotigte loschst.",
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
    description:
      "Ordner wählen: findet identische Dateien und lässt dich auswählen, welche in den Papierkorb verschoben werden.",
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
    licenseNeedsRefresh:
      "Wir können Ihr Pro-Abonnement nach so langer Offline-Zeit nicht bestätigen. Stellen Sie eine Internetverbindung her und versuchen Sie es erneut.",
    accountRefreshFailed:
      "Wir konnten den Status Ihres Kontos nicht überprüfen. Die hier angezeigten Informationen sind möglicherweise veraltet — prüfen Sie Ihre Verbindung oder versuchen Sie es später erneut.",
  },
  titlebar: {
    applied: "{applied}/{total} aktiv",
    cpu: "CPU",
    ram: "RAM",
    minimize: "Minimieren",
    maximize: "Maximieren",
    restore: "Wiederherstellen",
    close: "Schließen",
  },
  x3d: {
    title: "3D-V-Cache-Die-Ausrichtung",
    subtitle:
      "Bei einem Ryzen X3D mit zwei Dies trägt nur eines den gestapelten Cache. Windows weiß nicht welches und verteilt ein Spiel auf beide — jeder Zugriff über die Die-Grenze kostet einen Umweg über die Infinity Fabric.",
    cpuLabel: "Prozessor",
    readyHeadline: "V-Cache-Die gefunden: {cores} Threads",
    readyBody:
      "Heften Sie ein Spiel an dieses Die, dann bleibt jeder seiner Threads dort, wo der Cache ist.",
    singleDie:
      "Dieser Prozessor hat nur ein Die: Alle Kerne sehen bereits denselben Cache, es gibt also nichts auszurichten. Die Funktion erscheint von selbst auf einer CPU mit zwei Dies und asymmetrischem Cache.",
    uniformCache:
      "Dieser Prozessor hat mehrere Dies, alle mit gleich viel Cache. Ein Spiel zwischen ihnen zu verschieben würde nichts ändern, die Funktion bleibt daher aus.",
    unavailable: "Windows hat keine Cache-Karte für diesen Prozessor zurückgegeben.",
    dieLabel: "Die {index}",
    dieCache: "{mb} MB L3",
    dieThreads: "{count} Threads",
    vcacheBadge: "V-Cache",
    processesTitle: "Laufende Prozesse",
    processesHint: "Die aktivsten zuerst. Spiel auswählen und an das Cache-Die heften.",
    refresh: "Aktualisieren",
    refreshing: "Wird gelesen...",
    align: "Ausrichten",
    reset: "Zurücksetzen",
    alignedBadge: "Ausgerichtet",
    noProcesses: "Kein Prozess groß genug, um ihn aufzuführen.",
    persistenceNote:
      "Die Affinität gehört zum laufenden Prozess: Sie ist weg, sobald das Spiel schließt, und muss beim nächsten Start erneut gesetzt werden. Keine Systemeinstellung wird geändert.",
    alignedToast: "{name} an das V-Cache-Die geheftet.",
    resetToast: "{name} wieder auf allen Kernen.",
  },
  hardware: {
    intro:
      "Direkt von den Sensoren Ihrer Hardware gelesen. Wo es keinen Sensor gibt, sagen wir es Ihnen, statt eine Zahl anzuzeigen, die niemand überprüfen kann.",
    gpuLabel: "Grafikkarte",
    cpuLabel: "Prozessor",
    liveBadge: "Live",
    gpuDriver: "Treiber {version}",
    load: "GPU-Auslastung",
    vram: "Grafikspeicher",
    fan: "Lüfter",
    power: "Leistungsaufnahme",
    fanIdle: "steht: unter 50° nicht nötig",
    powerLimit: "Grenze {limit} W",
    tempCool: "kühl",
    tempGood: "optimal",
    tempWarm: "warm",
    tempHot: "sehr warm",
    traceLabel: "Diese Sitzung",
    traceRange: "min {min}° · max {max}°",
    noTempSensor: "Diese Karte stellt keinen Temperatursensor bereit.",
    cpuAcpiSource: "aus der ACPI-Thermalzone gelesen",
    cpuNoSensor:
      "Die Firmware dieses PCs stellt keine ACPI-Thermalzone bereit, daher hat Windows keine CPU-Temperatur zum Auslesen. Programme, die immer eine anzeigen, installieren einen Kernel-Treiber, um die Prozessorregister direkt zu lesen: PC Tweaker tut das nicht und sagt es Ihnen lieber, als einen erfundenen Wert zu zeigen.",
    noGpuTool:
      "Keine NVIDIA-Karte erkannt. AMD und Intel liefern kein vergleichbares Abfragewerkzeug, ihre Temperaturen sind daher ohne Herstellersoftware nicht auslesbar.",
    thermalsUnavailable: "Wir können die Sensoren dieses Systems nicht auslesen.",
    driversTitle: "Treiberalter",
    driversSubtitle:
      "Wie alt Ihre Herstellertreiber sind. Windows weiß, was installiert ist, nicht was verfügbar ist: Hier steht das belegbare Alter, nie eine erfundene Update-Meldung.",
    driversRescan: "Neu prüfen",
    driversScanning: "Wird geprüft...",
    driversCounted: "{count} Herstellertreiber",
    driversAging: "{count} älter als 2 Jahre",
    driversStale: "{count} älter als 4 Jahre",
    driversAllCurrent: "Alle aktuell",
    driversNone: "Keine Treiber von Drittherstellern in diesen Kategorien.",
    driversShowAll: "{count} weitere anzeigen",
    driversShowLess: "Weniger anzeigen",
    driversInboxNote:
      "{count} mitgelieferte Microsoft-Treiber ausgeschlossen: Windows Update pflegt sie und ihr Datum ist ein fester Platzhalter — sie als alt zu zählen wäre ein Fehlalarm.",
    ageYears: "{years} Jahre",
    ageYear: "{years} Jahr",
    ageMonths: "{months} Monate",
    ageMonth: "{months} Monat",
    vendorSite: "Herstellerseite",
    watchLabel: "Beobachtet seit",
    peakLabel: "Spitze",
    verdictRisky: "Riskant",
    verdictNormal: "Normal",
    verdictBetter: "Besser als erwartet",
    verdictIdle: "Im Leerlauf",
    verdictRiskyHint:
      "Die Karte hat 84° überschritten — ab da drosselt sie sich selbst, um sich zu schützen. Prüfen Sie den Luftstrom oder wechseln Sie zum Profil Leise.",
    verdictNormalHint:
      "Übliche Temperaturen für eine Karte unter Last: nichts Besorgniserregendes.",
    verdictBetterHint:
      "Sie blieb unter 65°, während sie wirklich gearbeitet hat: bessere Kühlung als üblich.",
    verdictIdleHint:
      "Sie hat noch nicht genug gearbeitet, um das zu beurteilen. Eine Karte im Leerlauf bleibt ohnehin kühl — das würde nichts beweisen.",
    profilesTitle: "Thermische Profile",
    profilesSubtitle:
      "Sie setzen das Leistungslimit der Karte — den Hebel, der Hitze und Lüftergeräusch tatsächlich bestimmt. Jeder Wert stammt aus den Grenzen, die die Karte selbst meldet.",
    currentLimit: "Jetzt: {watts} W",
    modeSilent: "Leise",
    modeSilentHint:
      "Für Arbeit, Streaming und lange Sitzungen: Der Lüfter bleibt fast lautlos und die Karte wird deutlich kühler — auf Kosten einiger Bilder.",
    modeStandard: "Standard",
    modeStandardHint:
      "Ein ausgewogenes Limit knapp unter der Obergrenze der Karte: leiserer Lüfter und niedrigere Temperaturen, bei wenigen Prozent weniger Bildrate.",
    modeGaming: "Gaming",
    modeGamingHint:
      "Für kompetitive Sitzungen: Watt am Maximum und angehobene Taktobergrenze, damit die 1%-Lows stabiler bleiben, wenn es darauf ankommt.",
    modeApplying: "Wird angewendet...",
    profileStageReading: "Grenzwerte der Karte werden gelesen",
    profileStageApplying: "Grenzwert wird angewendet",
    profileStageSettling: "Warten auf die Lüfter",
    profileApplied: "Limit auf {watts} W gesetzt.",
    profileNote:
      "Erfordert Administratorrechte und wird beim Neustart zurückgesetzt. Das ist keine Lüfterkurve: NVIDIA bietet in nvidia-smi keine direkte Lüftersteuerung, und die Programme, die eine anbieten, nutzen private, undokumentierte APIs, die diese App nicht anfasst.",
    profileDefaultIsMax:
      "Bei dieser Karte entspricht das Werks-Leistungslimit bereits dem Maximum, daher ändert nur Leise die Wattzahl: Gaming unterscheidet sich, indem es die Taktobergrenze anhebt.",
    driverInstalled: "installiert v{version} am {date}",
    driversNoUpdateCheck:
      "Dieser Bildschirm kontaktiert keinen Hersteller und kann nicht wissen, ob eine neuere Version existiert: Er zeigt die installierte Version und ihr Alter und führt Sie zur offiziellen Seite, damit Sie es selbst prüfen.",
    driversCheckedAt: "Gelesen am {time}",
    modeClockLocked: "Takt bis {mhz} MHz",
    modeClockAuto: "automatischer Takt",
    profileApply: "Profil anwenden",
    profileActive: "Profil aktiv",
    profileWillSet: "Setzt {watts} W, {clock}",
    scanStarting: "Analyse startet...",
    scanReading: "Klasse {class} wird gelesen",
    scanCount: "{done}/{total} · {pct}%",
    driversScannedAll: "{total} Treiber in {classes} Kategorien geprüft",
    winUpdateLabel: "Windows Update",
    winUpdateButton: "In Windows Update suchen",
    winUpdateNote:
      "Dies prüft nur den eigenen Katalog von Windows Update, nicht die oben aufgeführten einzelnen Treiber: Viele Hersteller - besonders bei Onboard-Audio und Chipsatz - veröffentlichen ihre Updates dort nie, nur auf der eigenen Website. PC Tweaker lädt keine Treiberpakete selbst herunter: Es gibt keine Hersteller-API dafür, was für genau Ihr Gerät aktuell ist, und den falschen Grafiktreiber zu installieren ist einer der wenigen Fehler, die Sie ohne Bild zurücklassen können.",
    winUpdateOpened: "Windows Update geöffnet.",
    winUpdateSearching: "Wird gesucht...",
    winUpdateTakesAWhile: "Das kann eine Minute dauern - der Microsoft-Katalog wird abgefragt.",
    winUpdateInstall: "Herunterladen und installieren ({count})",
    winUpdateInstalling: "Wird heruntergeladen und installiert...",
    winUpdateNone:
      "Windows Update hat nichts Neueres zu bieten, selbst für die oben als alt markierten Treiber: Viele Hersteller veröffentlichen Updates auf eigenem Weg, nicht über Windows Update.",
    winUpdateFailed: "Suche fehlgeschlagen: {detail}",
    winUpdateDone: "Installiert {installed}, fehlgeschlagen {failed}.",
    rebootTitle: "Windows verlangt einen Neustart",
    rebootBody:
      "Windows meldet, dass eine Installation erst nach einem Neustart abgeschlossen ist. Sie können das jetzt oder später tun.",
    rebootNow: "Jetzt neu starten",
    rebootLater: "Später",
  },
  menu: {
    account: "Konto",
    plan: "Tarif",
    planFree: "Kostenlos",
    planPro: "Pro",
    viewPlan: "Plan ansehen",
    upgradeButton: "Auf Pro upgraden",
    language: "Sprache",
    theme: "Designs",
    about: "Info",
    errorReports: "Anonyme Fehlerberichte",
    errorReportsBody:
      "Wenn etwas fehlschlägt, wird nur die Fehlermeldung gesendet (niemals persönliche Daten), um Fehler schneller zu beheben. Standardmäßig deaktiviert.",
    changePhoto: "Profilfoto ändern",
    removePhoto: "Foto entfernen",
    photoFailed: "Dieses Bild konnte nicht als Profilfoto verwendet werden.",
    support: "Support",
    reportIssue: "Ein Problem melden",
    aboutBody:
      "PC Tweaker — Systemoptimierungen mit automatischer Sicherung und Wiederherstellung.",
    close: "Schließen",
  },
  auth: {
    login: "Anmelden",
    register: "Registrieren",
    email: "E-Mail",
    password: "Passwort",
    loginButton: "Anmelden",
    rememberMe: "Angemeldet bleiben",
    registerButton: "Konto erstellen",
    working: "...",
    logout: "Abmelden",
    loggedInAs: "Angemeldet als {email}",
    backendNotConfigured:
      "Noch kein Server verbunden: API_BASE_URL setzen, sobald das Backend bereitgestellt ist.",
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
    forgotPasswordSent:
      "Falls diese E-Mail registriert ist, erhältst du einen Link zum Zurücksetzen des Passworts.",
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
        'Verhindert, dass Windows dich mit Umfragen wie „Wie wahrscheinlich ist es, dass du ... weiterempfiehlst" unterbricht (HKCU, keine Erhöhung erforderlich).',
    },
    disable_cortana: {
      name: "Cortana deaktivieren",
      description:
        "Schaltet Cortana per Systemrichtlinie ab und gibt die im Hintergrund reservierten Ressourcen frei (HKLM, erfordert Administratorrechte).",
    },
    show_file_extensions: {
      name: "Dateiendungen immer anzeigen",
      description:
        'Zeigt die echte Endung jeder Datei. Allein aus Sicherheitsgründen sinnvoll: Dateien wie „rechnung.pdf.exe" werden so sichtbar, die Windows sonst verbirgt (HKCU, keine Erhöhung erforderlich).',
    },
    hide_taskbar_widgets: {
      name: "Widgets aus der Taskleiste ausblenden",
      description:
        "Entfernt die Widgets-Schaltfläche (Wetter/Nachrichten), die auch dann Inhalte im Hintergrund lädt, wenn du sie nie öffnest (HKCU, keine Erhöhung erforderlich).",
    },
    network_latency: {
      name: "Netzwerkverzoegerung senken (Nagle-Algorithmus)",
      description:
        "Windows haelt kleine Pakete einige Millisekunden zurueck, um sie zu buendeln, und verzoegert zusaetzlich die Empfangsbestaetigungen. Fuer Downloads ist das ein guter Kompromiss, fuer Spiele ein schlechter: Dort ist jedes Paket klein, und zu spaet ist dasselbe wie gar nicht. Dies schaltet beides auf Ihrem aktiven Adapter ab (HKLM, erfordert Administratorrechte).",
    },
    disable_window_animations: {
      name: "Sofortige Fensteranimationen",
      description:
        "Entfernt die Animation, die Windows bei jedem Oeffnen, Schliessen oder Minimieren eines Fensters abspielt. Diese Animation ist reine Wartezeit: Ohne sie reagiert der Desktop im Moment des Klicks, und die dahinterliegende GPU-Arbeit entfaellt (HKCU, keine Erhoehung erforderlich).",
    },
    disable_drag_full_windows: {
      name: "Leichteres Verschieben von Fenstern",
      description:
        "Zeichnet beim Verschieben eines Fensters nur dessen Umriss, statt den gesamten Inhalt in jedem Einzelbild neu zu zeichnen. Auf einer schnellen GPU kaum spuerbar, auf integrierter Grafik oder einem aelteren Rechner deutlich (HKCU, keine Erhoehung erforderlich).",
    },
    mouse_hover_delay: {
      name: "Sofortige Reaktion beim Ueberfahren mit der Maus",
      description:
        "Windows wartet 400 ms, bevor es auf den ruhenden Mauszeiger reagiert - Taskleistenvorschauen, QuickInfos, Menues. Diese Wartezeit sinkt auf nahezu null, die Oberflaeche folgt der Maus, statt ihr hinterherzuhinken (HKCU, keine Erhoehung erforderlich).",
    },
    disable_background_apps: {
      name: "Apps im Hintergrund stoppen",
      description:
        "Verhindert, dass Store-Apps laufen, sich aktualisieren und das Netzwerk abfragen, waehrend Sie sie nicht nutzen. Das sind echte CPU-, RAM- und Akkuressourcen fuer Apps, die Sie nie geoeffnet haben (HKCU, keine Erhoehung erforderlich).",
    },
    disable_delivery_optimization: {
      name: "Windows-Updates nicht mehr mit Fremden teilen",
      description:
        "Windows laedt heruntergeladene Updatedateien standardmaessig ueber Ihre Verbindung zu anderen PCs hoch. Dies beschraenkt die Uebermittlungsoptimierung auf Ihren eigenen Rechner, damit dieser Upload nicht mitten im Spiel Bandbreite frisst (HKLM, erfordert Administratorrechte).",
    },
    disable_copilot: {
      name: "Windows Copilot deaktivieren",
      description:
        "Entfernt den Copilot-Assistenten aus der Taskleiste und verhindert, dass er im Hintergrund läuft. Windows aktiviert ihn standardmäßig, und in den Einstellungen gibt es keinen dauerhaften Schalter: Dies setzt die Systemrichtlinie, die ihn endgültig abschaltet (HKCU, keine Erhöhung erforderlich).",
    },
    disable_suggested_apps: {
      name: "Verhindern, dass Windows selbst Apps installiert",
      description:
        "Windows installiert unaufgefordert „vorgeschlagene“ Apps und Spiele in Ihr Startmenü — bei der Installation und erneut nach großen Updates. Dies schaltet das ab, sodass nichts mehr auf Ihrem Rechner landet, was Sie nicht selbst ausgewählt haben (HKCU, keine Erhöhung erforderlich).",
    },
    disable_mouse_acceleration: {
      name: "Mausbeschleunigung deaktivieren",
      description:
        "Schaltet „Zeigerbeschleunigung verbessern“ ab, wodurch der Zeiger bei schnellen Bewegungen weiter läuft. Genau diese variable Reaktion will man beim Zielen nicht: Dieselbe Handbewegung muss immer dieselbe Strecke auf dem Bildschirm zurücklegen (HKCU, keine Erhöhung erforderlich).",
    },
    disable_sticky_keys_prompt: {
      name: "Die Einrastfunktion-Meldung abschalten",
      description:
        "Fünfmal Umschalt öffnet den Einrastfunktion-Dialog — im Spiel bedeutet das ein Verlassen des Vollbilds im ungünstigsten Moment, meist mitten im Kampf. Dies deaktiviert das Tastenkürzel und seine Meldung; die Einrastfunktion selbst bleibt in den Einstellungen verfügbar (HKCU, keine Erhöhung erforderlich).",
    },
    disable_recall: {
      name: "Recall deaktivieren (KI-Bildschirmaufnahmen)",
      description:
        "Recall nimmt alle paar Sekunden ein Bild Ihres Bildschirms auf und baut daraus einen KI-durchsuchbaren Verlauf von allem, was Sie angesehen haben — Passwörter und private Nachrichten eingeschlossen, denn es erfasst alles, was auf dem Bildschirm steht. Dies setzt die Systemrichtlinie, die jede Analyse und Speicherung unterbindet (HKLM, erfordert Administratorrechte).",
    },
    disable_memory_integrity: {
      name: "Speicherintegrität (VBS) deaktivieren",
      description:
        "Die Speicherintegrität führt Teile von Windows in einem virtualisierten Container aus, was bei jedem Kernel-Übergang CPU-Zeit kostet — der Grund, warum ihre Abschaltung der größte kostenlose Bildraten-Gewinn ist. Der Handel muss klar sein: Es ist eine echte Sicherheitsfunktion, und sie abzuschalten entfernt den Schutz vor bösartigen Treibern. Auf einem reinen Spiele-PC vertretbar, auf einem Arbeitsrechner nicht. Wirkt nach einem Neustart (HKLM, erfordert Administratorrechte).",
    },
    disable_typing_personalization: {
      name: "Verhindern, dass Windows Ihren Schreibstil lernt",
      description:
        "Windows baut aus dem, was Sie tippen und handschriftlich eingeben, ein persönliches Wörterbuch auf — auch in Passwort-Managern, Chatfenstern und Suchfeldern — und synchronisiert es mit Ihrem Microsoft-Konto, um seine Vorschläge zu verbessern. Dies schaltet sowohl die Text- als auch die Handschrifterfassung ab (HKCU, keine Erhöhung erforderlich).",
    },
    classic_context_menu: {
      name: "Das vollständige Rechtsklick-Menü zurückholen",
      description:
        "Windows 11 versteckt den größten Teil des Kontextmenüs hinter „Weitere Optionen anzeigen“ und macht aus einem Klick zwei — bei Dingen, die man den ganzen Tag tut. Dies stellt das vollständige Windows-10-Menü überall wieder her, im Explorer und auf dem Desktop. Der Explorer startet zum Anwenden neu, offene Fenster flackern daher einmal (HKCU, keine Erhöhung erforderlich).",
    },
    disable_transparency: {
      name: "Transparenzeffekte deaktivieren",
      description:
        "Schaltet die Weichzeichner-/Acryleffekte in Taskleiste und Menüs ab. Eine kleine, aber echte GPU-Ersparnis, die ältere Rechner oder Systeme mit integrierter Grafik flüssiger macht (HKCU, keine Erhöhung erforderlich).",
    },
    dark_mode: {
      name: "Dunkler Modus",
      description:
        "Aktiviert das dunkle Design für Apps und System (HKCU, keine Rechteerhöhung erforderlich).",
    },
    show_hidden_files: {
      name: "Versteckte Dateien anzeigen",
      description:
        "Zeigt versteckte Dateien und Ordner im Explorer an (HKCU, keine Rechteerhöhung erforderlich).",
    },
    priority_separation: {
      name: "CPU-Priorität optimieren",
      description:
        "Stellt Win32PrioritySeparation (0x26) so ein, dass die Vordergrund-App kurze, variable CPU-Zeitscheiben mit 3x-Priorität erhält — der klassische Wert für Desktop-/Gaming-Reaktionsschnelligkeit (HKLM, Administratorrechte erforderlich).",
    },
    disable_game_dvr: {
      name: "Xbox Game Bar / Game DVR deaktivieren",
      description:
        "Deaktiviert die Hintergrundaufnahme der Xbox Game Bar, die beim Spielen CPU/GPU beansprucht (HKCU, keine Rechteerhöhung erforderlich).",
    },
    disable_telemetry_tasks: {
      name: "Diagnosedatenerfassung reduzieren",
      description:
        "Setzt die Windows-Diagnosestufe auf das minimal zulässige Niveau (HKLM, Administratorrechte erforderlich).",
    },
    reset_advertising_id: {
      name: "Werbe-ID deaktivieren",
      description:
        "Verhindert, dass Apps deine Werbe-ID zur Profilbildung nutzen (HKCU, keine Rechteerhöhung erforderlich).",
    },
    disable_location_tracking: {
      name: "Standortverfolgung deaktivieren",
      description:
        "Blockiert den Standortzugriff für alle Apps per Systemrichtlinie (HKLM, Administratorrechte erforderlich).",
    },
    disable_bing_search: {
      name: "Bing-Suche im Startmenü deaktivieren",
      description:
        "Verhindert, dass deine Suchanfragen im Startmenü an Bing gesendet werden (HKCU, keine Rechteerhöhung erforderlich).",
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
    keep_kernel_in_ram: {
      name: "Kernel und Treiber im RAM halten",
      description:
        "Windows kann Teile des Kernels und des Treibercodes selbst bei reichlich Speicher auf die Festplatte auslagern, und sie zurückzulesen ist eine Pause, die sich als Ruckler anfühlt. Dies hält sie resident. Lohnt sich, wenn RAM übrig ist; auf einem PC mit wenig Speicher besser aus lassen (HKLM, erfordert Administratorrechte).",
    },
    auto_end_frozen_tasks: {
      name: "Eine eingefrorene App soll das Herunterfahren nicht blockieren",
      description:
        'Wenn eine Anwendung beim Herunterfahren nicht mehr reagiert, wartet Windows und zeigt den Bildschirm "Diese App verhindert das Herunterfahren", bis jemand klickt. Dies schließt nicht reagierende Anwendungen automatisch, damit ein hängendes Programm den Rechner nicht eingeschaltet stehen lässt (HKCU, keine Erhöhung nötig).',
    },
    instant_folder_loading: {
      name: "Jeden Ordner sofort öffnen",
      description:
        "Der Explorer durchsucht den Inhalt eines Ordners, um zu raten, ob es Bilder, Musik oder Dokumente sind, und ein Ordner mit Tausenden Mediendateien kann dabei sekundenlang hängen. Dies legt alle Ordner auf das allgemeine Layout fest, sodass sie sofort öffnen (HKCU, keine Erhöhung nötig).",
    },
    tcp_congestion_bbr: {
      name: "Niedrige Latenz auch bei ausgelasteter Leitung (BBR2)",
      description:
        "Windows verwendet CUBIC, das so lange beschleunigt, bis irgendwo ein Puffer überläuft — deshalb steigt der Ping, sobald jemand anders im Haus einen Download startet. BBR2 misst stattdessen die tatsächliche Bandbreite und die Umlaufzeit der Leitung und taktet den Verkehr passend dazu, sodass die Leitung voll wird, ohne dass die Warteschlange voll wird. Microsoft liefert BBR2 mit Windows 11 aus; dies stellt die Internet-Vorlage darauf um und stellt exakt den vorherigen Zustand wieder her (erfordert Administratorrechte).",
    },
    taskbar_align_left: {
      name: "Taskleiste links ausrichten",
      description:
        "Richtet die Taskleisten-Symbole wieder links aus (Windows-10-Stil) statt zentriert (HKCU, keine Elevation erforderlich).",
    },
    hide_taskbar_chat: {
      name: "Chat/Teams aus der Taskleiste ausblenden",
      description:
        "Entfernt das Chat-Symbol (Microsoft Teams) aus der Taskleiste (HKCU, keine Elevation erforderlich).",
    },
    disable_start_suggestions: {
      name: "Startmenü-Vorschläge und empfohlene Apps deaktivieren",
      description:
        "Verhindert, dass Windows empfohlene Apps, Werbung und Vorschläge im Startmenü anzeigt (HKCU, keine Elevation erforderlich).",
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
      description:
        "Verschiebt den Inhalt von %TEMP% in den Papierkorb: jederzeit wiederherstellbar, kein endgültiges Löschen.",
    },
    winupdate_cache_cleanup: {
      name: "Windows Update-Cache leeren",
      description:
        "Verschiebt bereits installierte Windows Update-Pakete in den Papierkorb (Administratorrechte erforderlich).",
    },
  },
};

const pt: Strings = {
  appName: "PC Tweaker",
  appliedCount: "{applied} de {total} ajustes ativos",
  headerNote:
    "Cada ajuste faz backup do valor original antes de ser aplicado. Ajustes que precisam de privilégios elevados pedem uma janela de UAC explícita, só para essa ação.",
  advisor: {
    eyebrow: "Recomendado para o seu PC",
    applyButton: "Aplicar",
    confidenceHigh: "Alta confiança — baseado no hardware deste PC",
    confidenceStandard: "Recomendado para este tipo de máquina",
    reversible: "Reversível — o valor original é salvo antes de qualquer alteração.",
    empty: "Nada a recomendar por agora — sua configuração já está de acordo com nossos critérios.",
  },
  drift: {
    titleAfterUpdate: "O Windows voltou a mexer nas suas definições",
    titleNoUpdate: "Algumas definições já não estão ativas",
    afterUpdateOne:
      "Após a atualização para {patch}, um ajuste que tinha aplicado já não está ativo no sistema.",
    afterUpdateMany:
      "Após a atualização para {patch}, {count} ajustes que tinha aplicado já não estão ativos no sistema.",
    noUpdateOne:
      "Um ajuste que tinha aplicado já não está ativo no sistema. Não houve nenhuma atualização do Windows entretanto, por isso foi outra coisa a alterá-lo.",
    noUpdateMany:
      "{count} ajustes que tinha aplicado já não estão ativos no sistema. Não houve nenhuma atualização do Windows entretanto, por isso foi outra coisa a alterá-los.",
    reapplyOne: "Reaplicar o ajuste",
    reapplyMany: "Reaplicar {count} ajustes",
    reapplying: "A reaplicar...",
    reappliedOne: "Ajuste reaplicado.",
    reappliedMany: "{count} ajustes reaplicados.",
  },
  crashes: {
    title: "Encerramentos inesperados",
    subtitle:
      "A aplicação fechou sozinha. O relatório fica neste PC: copie-o e envie-o pelo Discord ou GitHub se quiser que seja corrigido.",
    copy: "Copiar relatório",
    copied: "Relatório copiado para a área de transferência.",
    clear: "Limpar",
    cleared: "Relatórios limpos.",
    processApp: "janela principal",
    processElevated: "operação com direitos de administrador",
  },
  ledger: {
    title: "Registro de alterações",
    subtitle:
      "Tudo o que este app alterou neste PC, mais recente primeiro. Armazenado localmente, nunca enviado.",
    empty: "Nenhuma alteração registrada ainda. Aplique seu primeiro ajuste e ele aparecerá aqui.",
    clear: "Limpar histórico",
    clearing: "Limpando...",
    cleared: "Histórico limpo.",
    revert: "Reverter",
    elevated: "com privilégios de administrador",
    failed: "falhou",
    actions: {
      applied: "Ajuste aplicado",
      reverted: "Ajuste revertido",
      cleanup: "Limpeza",
      filesDeleted: "Arquivos excluídos",
      diskOptimize: "Otimização de disco",
      startupChange: "Alteração na inicialização",
      restorePoint: "Ponto de restauração",
    },
  },
  tabs: {
    groupMonitor: "Monitorar",
    groupOptimize: "Otimizar",
    groupManage: "Gerenciar",
    scan: "Verificação",
    health: "Saúde do PC",
    hardware: "Hardware",
    performance: "Desempenho",
    privacy: "Privacidade",
    ui: "Interface",
    manutenzione: "Manutenção",
    gaming: "Jogos",
    startup: "Inicialização",
    profiles: "Configurações",
    pricing: "Planos e preços",
    ledger: "Histórico",
  },
  healthPanel: {
    title: "Saúde do PC",
    subtitle:
      "Uma pontuação explicável: todo número mostra os fatos a partir dos quais foi calculado.",
    why: "Por que {score}?",
    refresh: "Recalcular",
    compute: "Calcular pontuação de saúde",
    showMore: "Mostrar mais",
    showLess: "Mostrar menos",
    stageProfile: "Lendo o perfil do sistema",
    stageTweaks: "Verificando ajustes aplicados",
    stageSecurity: "Lendo o estado de segurança",
    stageScoring: "Calculando pontuação",
    verdictExcellent: "EXCELENTE",
    verdictGood: "BOM",
    verdictFair: "RAZOÁVEL",
    verdictNeedsWork: "PRECISA MELHORAR",
    computing: "Analisando...",
    idleHint:
      "Nada roda em segundo plano: a pontuação só é calculada quando você pede, inteiramente neste PC.",
    baselineTitle: "Referência",
    baselineHint:
      "Medições rápidas e repetíveis — só comparáveis com execuções anteriores neste PC.",
    baselineRun: "Executar referência",
    baselineRunning: "Medindo (~5 s)...",
    baselineEmpty:
      "Nenhuma referência ainda. Execute uma antes de aplicar alterações, e outra depois.",
    changeSinceLast: "desde sua última verificação",
    changeNone: "Nenhuma alteração desde sua última verificação.",
    changeFirstRun:
      "Primeira medição registrada. Execute novamente após uma alteração para ver o que mudou.",
    changeWhyTitle: "Por que a pontuação mudou",
    changeContributes: "Contribuição para a pontuação geral:",
    changeStructural:
      "Uma atualização do app mudou quais categorias são pontuadas — parte desta diferença não veio do seu PC.",
    changeTrend: "Tendência",
    categories: {
      performance: "Desempenho",
      gaming: "Jogos",
      responsiveness: "Responsividade",
      memory: "Memória",
      storage: "Armazenamento",
      startup: "Inicialização",
      maintenance: "Manutenção",
      privacy: "Privacidade",
      security: "Segurança",
    },
  },
  transparency: {
    title: "O que isto altera, exatamente",
    key: "Chave",
    value: "Valor",
    setsTo: "Define como",
    note: "O valor anterior é salvo antes da escrita, então a reversão o restaura exatamente como estava.",
    kindRegistry: "Registro",
    kindCommand: "Comando",
    kindService: "Serviço",
    copy: "Copiar",
    copied: "Copiado",
  },
  command: {
    statusQuiet: "Tudo tranquilo",
    statusScanning: "Verificando...",
    statusFindings: "{count} recomendações prontas",
    domainsLine:
      "Inicialização · Armazenamento · Memória · Privacidade · Desempenho · Atualizações",
    consent: "Nada muda sem sua aprovação.",
    runScan: "Executar verificação do sistema",
    reviewFindings: "Revisar {count} recomendações",
    memTitle: "Pressão de memória",
    pressureLow: "Baixa",
    pressureElevated: "Elevada",
    pressureHigh: "Alta",
    memReview: "Revisar uso de memória",
    memTopTitle: "Principais processos",
    trimTitle: "Reduzir conjuntos de trabalho",
    trimExplainer:
      "Pede ao Windows para mover páginas ociosas para fora dos conjuntos de trabalho dos apps (EmptyWorkingSet). Útil sob alta pressão; os apps podem recarregar páginas brevemente no próximo uso. Nenhum dado é perdido.",
    trimButton: "Reduzir agora",
    autoTitle: "Redução automática",
    profilesTitle: "Perfis de sessão",
    profileGame: "Sessão de jogo",
    profileGameDesc: "Prepara o PC para jogar: energia, prioridade e captura de DVR.",
    profileFocus: "Foco",
    profileFocusDesc: "Menos distrações, atividade não essencial sob controle.",
    profileQuiet: "Sessão silenciosa",
    profileQuietDesc: "Eficiência, bateria e baixo ruído em primeiro lugar.",
    profileDownload: "Sessão de download",
    profileDownloadDesc: "Controla a largura de banda e a atividade em segundo plano.",
    previewBtn: "Pré-visualizar alterações",
    gameChange1: "Desativa o Game DVR (captura em segundo plano)",
    gameChange2: "Muda para o plano de energia Alto desempenho",
    gameChange3: "Otimiza a prioridade da CPU para jogos (Win32PrioritySeparation)",
    previewReq: "Requer privilégios de administrador · Recurso Pro",
    previewCost: "Custo potencial: maior consumo de energia e calor enquanto ativo.",
    previewRevert: "Reversível com um clique: todo valor original é salvo antes.",
    applySession: "Iniciar sessão",
    restoreSession: "Restaurar",
    statusActive: "Ativa",
    statusOff: "Inativa",
    soon: "Em breve",
  },
  systemMonitor: {
    cpu: "CPU",
    ram: "Memória",
    disk: "Disco",
    uptime: "Ativo há",
    uptimeValue: "{hours}h {minutes}m",
    cores: "{count} núcleos",
  },
  startupManager: {
    title: "Programas de inicialização",
    description:
      "Programas que abrem sozinhos quando o PC liga. Desativar alguns encurta o tempo de inicialização: o programa continua instalado e você ainda pode abri-lo manualmente.",
    empty: "Nenhum programa está configurado para iniciar automaticamente.",
    activeCount: "Ativos: {enabled} / {total}",
    machineWide: "Todos os usuários",
    impactNote: "Desativar um não desinstala nada e é reversível a qualquer momento.",
    refresh: "Atualizar",
    refreshing: "A reanalisar...",
    hiddenOrphans: "{count} entradas ocultas: o programa já não está instalado.",
  },
  search: {
    placeholder: "Buscar um ajuste...",
    noResults: 'Nenhum resultado para "{query}".',
    clear: "Limpar",
  },
  pricing: {
    eyebrow: "Desbloqueia tudo",
    title: "Escolha o quanto quer avançar",
    subtitle:
      "Cada alteração guarda antes como estava: o que experimentares aqui desfaz-se num clique. O gratuito cobre o essencial; o Pro abre o resto.",
    monthly: "Mensal",
    annual: "Anual",
    lifetime: "Vitalício",
    saveBadge: "ECONOMIZE {percent}%",
    perMonth: "/mês",
    perYear: "/ano",
    once: "pagamento único",
    lifetimeDetail:
      "Paga uma vez e fica seu. Compensa em {months} meses face ao plano anual, e a partir daí não paga mais nada",
    annualDetail: "Isso equivale a {monthly} por mês, cobrados {yearly} de uma vez por ano",
    annualNudge: "No plano anual seria {price} por mês",
    mostChosen: "MAIS ESCOLHIDO",
    freeName: "Grátis",
    freeTagline: "Tudo o que você precisa para um PC mais limpo e ágil.",
    freePriceNote: "Grátis para sempre, sem expirar",
    freeCta: "Você está no plano Grátis",
    freeCurrent: "Plano atual",
    proName: "Pro",
    proTagline:
      "Todos os ajustes, incluindo os que exigem privilégios de administrador e os que farías à mão no registo.",
    proCta: "Assinar o Pro",
    proCurrent: "Seu plano",
    manageBilling: "Gerenciar assinatura",
    everythingInFree: "Tudo do Grátis, mais:",
    reassurance:
      "Cancele quando quiser. Toda alteração continua a um clique de ser desfeita, mesmo depois de cancelar.",
    freeFeatures: [
      "{count} ajustes reais, cada um com backup e reversível",
      "Monitor do sistema em tempo real (CPU, memória, disco)",
      "Gerenciador de programas de inicialização",
      "Verificação de vazamento de senha",
      "Verificação e correção do PC com um clique",
      "Limpeza de arquivos temporários",
    ],
    proFeatures: [
      "Sessões de jogo: o turbo se ativa sozinho ao iniciar um jogo",
      "Preset Turbo Gaming e prioridade máxima para jogos",
      "Privacidade avançada: telemetria e histórico de atividades",
      "Encontra e remove arquivos duplicados",
      "Limpa o cache do Windows Update",
      "Desativa a indexação que mantém o disco ocupado",
      "Todo ajuste e todo recurso futuro, incluídos",
    ],
  },
  toggle: { on: "Ativado", off: "Desativado" },
  driverBooster: {
    title: "Driver Booster",
    subtitle:
      "Escolhe os drivers que estão a ficar para trás e abre todas as suas páginas de transferência de uma vez.",
    scan: "Analisar drivers",
    scanning: "A analisar...",
    selectAll: "Selecionar tudo",
    selectNone: "Limpar seleção",
    selectedCount: "{selected} de {total} selecionados",
    pagesForSelection: "{pages} páginas a abrir",
    openSelected: "Abrir páginas de transferência ({count})",
    opened: "{count} páginas abertas",
    openedCapped:
      "Abertas {opened} de {total} páginas: as restantes ficam selecionadas, executa de novo.",
    allCurrent: "Nenhum driver aparenta a idade.",
    nothingActionable: "Nenhum driver antigo tem uma página do fabricante para abrir.",
    note: "O PC Tweaker não transfere pacotes de drivers sozinho: não existe uma API do fabricante que diga qual a versão certa para o teu dispositivo exato, e instalar o driver de vídeo errado é um dos poucos erros capazes de te deixar sem ecrã. Isto automatiza a parte aborrecida — encontrar as páginas — não a escolha. Para os drivers que o Windows Update conhece mesmo, usa o botão acima.",
  },
  secureDefrag: {
    title: "Desfragmentação segura",
    willDefrag: "Este disco é mecânico: será executada uma desfragmentação real.",
    willRetrim:
      "Este disco não está confirmado como mecânico: o volume inteiro é analisado e depois é executado um retrim em vez de uma desfragmentação. O retrim demora segundos e só diz respeito ao espaço livre — é esse o seu papel: indicar ao controlador que blocos já não são usados. Desfragmentar um SSD não o acelera, apenas o desgasta.",
    start: "Iniciar",
    running: "A executar...",
    working: "A processar...",
    phaseAnalyze: "Análise",
    phaseOptimize: "Otimização",
    analysisTitle: "Relatório de análise",
    doneDefrag: "Desfragmentação concluída.",
    doneRetrim: "Retrim concluído.",
    note: "É criado antes um ponto de restauro. A percentagem vem do próprio Windows, não de um temporizador.",
  },
  zeroTrace: {
    title: "Zero-Trace Cleaner",
    subtitle:
      "Remove o que os programas fechados deixam na memória e destrói ficheiros sem recuperação possível.",
    purgeTitle: "Limpeza de memória",
    purgeBody:
      "O Windows mantém na RAM as páginas dos programas fechados como cache. Isto liberta-as: os fragmentos deixados por um processo terminado desaparecem mesmo da memória física.",
    purgeButton: "Limpar memória",
    purging: "A limpar...",
    purgeResult: "Libertados {freed} MB — agora {after} MB livres",
    purgeLimit:
      "Não toca no ficheiro de paginação nem no de hibernação: estão em disco e o Windows não oferece uma API para os limpar em execução.",
    shredTitle: "Destruição segura de ficheiros",
    shredBody:
      "Sobrescreve o conteúdo do ficheiro em três passagens antes de o eliminar, colocando-o fora do alcance das ferramentas de recuperação comuns.",
    shredButton: "Escolher ficheiros...",
    shredding: "A destruir...",
    shredDone: "{count} ficheiros destruídos ({size})",
    shredSummary: "{shredded} destruídos, {skipped} ignorados",
    shredWarning: "Definitivo: sem Reciclagem, sem recuperação.",
    ssdCaveat:
      "Num SSD, o nivelamento de desgaste escreve quase sempre em células diferentes do original. As antigas são libertadas, não reescritas — só o secure-erase do disco pode garantir mais.",
  },
  hud: {
    title: "Overlay de jogo",
    subtitle:
      "Um painel transparente sobre o jogo: carga de CPU/GPU, temperaturas, VRAM, processo ativo com a sua prioridade e indicador de estrangulamento.",
    fpsAbout:
      "Os FPS são contados a partir dos eventos de apresentação que o Windows emite a cada fotograma — a mesma fonte que o PresentMon lê, sem prender nada ao jogo. Exige iniciar como administrador, porque abrir uma sessão de rastreio é uma operação privilegiada.",
    fpsLowExplained:
      "Ao lado da média aparece DROP: a velocidade do um por cento de fotogramas piores, aquilo a que noutros sítios chamam «1% low». É o número que se mexe quando o jogo engasga, enquanto a média fica alta e não o diz. Quanto mais perto DROP estiver da média, mais fluido está o jogo.",
    fpsStart: "Medir FPS",
    fpsStop: "Parar medição",
    fpsNeedsAdmin: "Para medir os FPS é preciso iniciar o PC Tweaker como administrador.",
    fpsRunning: "A medir: os FPS aparecem no overlay assim que um jogo começar a desenhar.",
    show: "Mostrar",
    hide: "Ocultar",
    lock: "Bloquear",
    unlock: "Desbloquear",
    dragHint: "Arraste a sobreposição para onde quiser e bloqueie antes de iniciar o jogo.",
    lockedHint: "Bloqueada: os cliques a atravessam e chegam ao jogo. Desbloqueie para movê-la.",
    sizeCompact: "Compacto",
    sizeNormal: "Normal",
  },
  updater: {
    title: "Atualização disponível: v{version}",
    body: "Baixa e instala em uma etapa; o app reinicia sozinho ao terminar.",
    install: "Instalar e reiniciar",
    later: "Mais tarde",
    downloading: "Baixando... {percent}%",
    installing: "Instalando...",
    error: "Falha na atualização: {message}",
    checkFailed: "Falha ao verificar atualizações: {message}",
  },
  badges: { admin: "Admin", pro: "PRO", soon: "EM BREVE" },
  emptyCategory: "Nenhum ajuste disponível nesta categoria ainda — mais em breve.",
  gameSessions: {
    title: "Sessões de jogo",
    subtitle: "Detecta seus jogos automaticamente e aplica/reverte o preset Turbo Gaming sozinho.",
    active: "Sessão ativa: {name}",
    gamesCount: "{count} jogos registrados",
    addGame: "+ Adicionar jogo (.exe)",
  },
  turboBoost: {
    title: "Turbo Boost",
    subtitle: "Leva seu processador ao desempenho máximo em jogos, com um toque.",
    startLabel: "INICIAR",
    stopLabel: "PARAR",
    activating: "Ativando o turbo...",
    deactivating: "Restaurando...",
    active: "Turbo ativo",
    inactive: "Turbo inativo",
    loadLabel: "CARGA CPU",
    stageReading: "Lendo o plano de energia",
    stageRaising: "Elevando o teto de boost",
    stageApplying: "Aplicando ao sistema",
    modeAggressive: "Modo agressivo",
    modeDefault: "Modo padrão",
    stageMeasuringBefore: "Medindo antes",
    stageMeasuringAfter: "Medindo novamente",
    gainMeasured: "{factor}x mais rápido",
    gainSlight: "{factor}x mais rápido - um ganho modesto",
    gainAtCeiling: "Já na velocidade máxima: esta CPU não tinha mais margem para liberar",
    ceilingLocked: "Teto de boost travado",
    ceilingUnlocked: "Teto de boost liberado",
  },
  profiles: {
    title: "Configurações",
    subtitle:
      "Salve como você configurou este PC, reaplique com um clique, ou passe para outra pessoa.",
    saveHeading: "Salvar a atual",
    namePlaceholder: "Nome (ex.: Jogos)",
    saveButton: "Salvar",
    savedHeading: "Salvas",
    empty: "Nenhuma configuração salva ainda.",
    tweakCount: "{count} ajustes",
    apply: "Aplicar",
    applying: "Aplicando...",
    exportButton: "Exportar",
    importButton: "Importar de arquivo",
    deleteButton: "Excluir",
    savedToast: 'Configuração "{name}" salva',
    appliedToast: "{count} ajustes aplicados",
    exportedToast: "Arquivo exportado",
    importedToast: "Importado: {count} ajustes prontos para revisão",
    droppedWarning: "{count} entradas que esta versão não reconhece foram descartadas",
    nameRequired: "Dê um nome à configuração",
    reviewNotice: "Uma configuração importada nunca é aplicada sozinha — você a revisa primeiro.",
    signInRequired: "Entre ou crie uma conta para salvar configurações.",
  },
  scan: {
    title: "Verificação rápida",
    subtitle:
      "Verifica o estado do seu PC e encontra otimizações que ainda não estão ativas, com um clique.",
    startLabel: "VERIFICAR",
    stepPerformance: "Desempenho",
    stepPrivacy: "Privacidade",
    stepGaming: "Jogos",
    stepJunk: "Arquivos temporários",
    allGood: "Tudo certo — nenhum problema encontrado.",
    issuesFound: "{count} otimizações disponíveis",
    selectAll: "Selecionar tudo",
    deselectAll: "Desmarcar tudo",
    fixAll: "Corrigir tudo",
    fixing: "Corrigindo {done}/{total}...",
    fixedToast: "{count} problemas corrigidos.",
    proIssuesTitle: "Também disponível com o Pro",
    unlockPro: "Desbloquear o Pro",
    scanAgain: "Verificar novamente",
    verdictRecommended: "Recomendado neste PC",
    verdictNotRecommended: "Não recomendado para este PC",
    verdictUnsupported: "Não suportado",
    reasons: {
      laptop_battery: "este PC é um notebook: custa mais bateria do que devolve",
      hdd_index_cost:
        "o disco do sistema é mecânico, então a indexação em segundo plano é realmente sentida",
      fast_disk_no_gain:
        "o disco do sistema é NVMe, rápido o bastante para tornar a economia insignificante",
      needs_win10_2004: "requer Windows 10 versão 2004 ou mais recente",
      weak_gpu: "gráficos integrados: a transparência custa desempenho que poderia ser aproveitado",
    },
    thisPc: "Este PC",
    dashDrivesTitle: "Armazenamento",
    dashFreeOf: "{free} livres de {total}",
    dashAlmostFull: "Quase cheio",
    dashStartupTitle: "Apps de inicialização",
    dashStartupCount: "{on} de {total} ativados",
    dashManage: "Gerenciar",
    dashUptimeTitle: "Ativo há",
    dashUptimeDh: "{days}d {hours}h",
    dashUptimeHm: "{hours}h {minutes}min",
    dashUptimeLongHint:
      "Este PC não reinicia há um bom tempo. Um reinício aplica atualizações pendentes e libera memória retida.",
    dashHistoryTitle: "Ações recentes",
    dashHistoryEmpty: "Nada ainda. As ações que você realizar aparecerão aqui.",
    dashActTweakApplied: "Ajuste aplicado",
    dashActTweakReverted: "Ajuste revertido",
    dashActCleanup: "Limpeza",
    dashActFilesDeleted: "Arquivos excluídos",
    dashActStartupChange: "Inicialização alterada",
    dashActDiskOptimize: "Disco otimizado",
    dashActRestorePoint: "Ponto de restauração",
    profileUnknown: "Não detectado",
    diskHdd: "HDD",
    diskSsd: "SSD",
    diskNvme: "NVMe",
    formDesktop: "Desktop",
    formLaptop: "Notebook",
    groupRecommended: "Recomendado para este PC",
    groupOptional: "Opcional",
    groupNotRecommended: "Não recomendado aqui",
    tailoredNote: "Cada item é avaliado com base no hardware acima, não em uma lista fixa.",
    fixRecommended: "Aplicar os {count} recomendados",
    fixEverything: "Aplicar selecionados ({count})",
    nothingSelected: "Nada selecionado",
    foundHeadline: "{count} vale a pena corrigir neste PC",
    foundNone: "Nada a corrigir",
    doneTitle: "Pronto!",
    doneBody: "{count} otimizações aplicadas. Seu PC está em ordem.",
    fixHeading: "Pronto para aplicar",
  },
  ram: {
    title: "Liberar RAM",
    subtitle:
      "Pede ao Windows para liberar memória que os programas estão retendo mas não usando. Execute quantas vezes quiser.",
    button: "Liberar agora",
    cleaning: "Limpando...",
    freed: "{amount} liberados",
    freedNothing: "A memória já estava otimizada",
    inUse: "{used} de {total} em uso",
    autoLabel: "Limpeza automática",
    autoOff: "Desativada",
    autoEvery: "A cada {interval}",
    autoHint:
      "Com a limpeza automática ativada, o PC Tweaker libera RAM sozinho em intervalos regulares enquanto o app estiver aberto.",
    autoNext: "Próxima limpeza às {time}",
    autoDue: "Limpeza prestes a ocorrer...",
    autoLast: "Última às {time}: {amount} liberados",
    autoNoneYet: "Nenhuma limpeza automática foi executada ainda.",
    autoFailed: "A última tentativa falhou: {detail}",
  },
  restore: {
    button: "Restaurar tudo",
    title: "Restaurar todas as alterações?",
    body: "Isso desativará as {count} otimizações ativas e devolverá cada valor exatamente como estava. Nada é perdido.",
    confirm: "Sim, restaurar tudo",
    cancel: "Cancelar",
    running: "Restaurando...",
    doneToast: "{count} otimizações restauradas.",
    nothingToast: "Não há nada para restaurar.",
  },
  passwordCheck: {
    title: "Verificação de vazamento de senha",
    description:
      "Verifica se uma senha apareceu em algum vazamento de dados conhecido, sem nunca enviá-la por completo: apenas um fragmento do seu hash é enviado (k-anonimato, o mesmo padrão usado pelo Have I Been Pwned).",
    placeholder: "Cole uma senha para verificar",
    button: "Verificar",
    checking: "Verificando...",
    safe: "Não encontrada em nenhum vazamento conhecido. Bom sinal.",
    breached:
      "Encontrada em {count} vazamentos conhecidos. Troque-a agora, em todos os lugares onde a usa.",
    error: "Não foi possível verificar agora: confira sua conexão e tente novamente.",
  },
  paywall: {
    title: "Recurso Pro",
    body: '"{feature}" faz parte do PC Tweaker Pro, junto com Sessões de jogo, os presets de jogos e todo recurso futuro.',
    unlock: "Ver planos e preços",
    notNow: "Agora não",
    notConnectedToast:
      "O pagamento do Pro ainda não está configurado nesta build de desenvolvimento.",
  },
  cleanupConfirm: {
    previewLoading: "Calculando o que irá para a Lixeira...",
    previewEmpty: "Nada para limpar - a pasta já está vazia.",
    previewNotAccessible:
      "O conteúdo não pode ser lido sem privilégios de administrador; o processo autorizado vai listá-lo e removê-lo.",
    previewTruncated: "Mostrando os 500 maiores itens; os totais incluem tudo.",
    selectedSummary: "{count} itens selecionados · {size}",
    confirmSelected: "Limpar selecionados",
    title: "Confirmar limpeza?",
    body: '"{name}" moverá os arquivos correspondentes para a Lixeira do Windows. Você pode restaurá-los de lá até que ela seja esvaziada.',
    confirm: "Mover para a Lixeira",
    cancel: "Cancelar",
  },
  cleanupButton: "Limpar",
  cleanupRunning: "...",
  cleanupResultToast: "{deleted} itens movidos para a Lixeira, {freed} liberados",
  cleanupResultToastSkipped: " ({skipped} em uso, ignorados).",
  diskOptimize: {
    title: "Otimizar unidade",
    description:
      "Executa o próprio otimizador do Windows: desfragmentação em um HDD, ou TRIM em um SSD (nunca uma desfragmentação completa, que só o desgastaria sem benefício algum).",
    button: "Otimizar agora",
    running: "Otimizando... isso pode levar alguns minutos",
    resultToast: "Unidade ({media}) otimizada com sucesso.",
  },
  dnsFlush: {
    title: "Limpar cache de DNS",
    description:
      "Limpa consultas DNS em cache. Útil se um site mudou de servidor e seu navegador continua mostrando a versão antiga.",
    button: "Limpar agora",
    running: "Limpando...",
    resultToast: "Cache de DNS limpo.",
  },
  browserCleanup: {
    title: "Limpeza do navegador",
    description:
      "Limpa cache e cookies do Chrome, Edge e Firefox. O navegador os recria sozinho na próxima abertura, então nada se perde de verdade.",
    noneFound: "Nenhum navegador compatível encontrado neste PC.",
    cache: "Cache",
    cookies: "Cookies",
    clearButton: "Limpar",
    clearing: "Limpando...",
    runningWarning: "Feche o {browser} para limpar.",
    clearedToast: "{browser}: {freed} liberados.",
  },
  redaxaPromo: {
    title: "Redaxa",
    description:
      "Você já cortou telemetria e rastreamento — mas o que cola em chats de IA? O Redaxa detecta dados pessoais e credenciais antes que um prompt chegue a qualquer modelo. Mesma família, mesma regra: nada é armazenado.",
    button: "Experimente na web",
  },
  uninstallerPromo: {
    title: "PC Tweaker Uninstaller",
    description:
      "Remova programas inteiros com segurança: ponto de restauração automático, comando verificado, relatório honesto. Da mesma família do PC Tweaker.",
    button: "Saiba mais",
  },
  largeFiles: {
    title: "Encontrar arquivos grandes",
    description:
      "Verifica uma pasta em busca dos maiores arquivos (acima de 100 MB), para você liberar espaço rapidamente removendo os que não precisa mais.",
    chooseFolder: "Escolher pasta",
    scanning: "Verificando...",
    noneFound: "Nenhum arquivo acima de {size} encontrado.",
    foundCount: "{count} arquivos encontrados",
    moveSelected: "Mover {count} selecionados para a Lixeira",
    deleting: "Movendo para a Lixeira...",
    deletedToast: "{count} arquivos movidos, {freed} liberados.",
  },
  diskHealth: {
    title: "Saúde da unidade",
    freeSpace: "{size} livres",
    selectDrive: "Unidade",
    healthy: "Saudável",
    warning: "Alerta",
    unhealthy: "Comprometida",
    unknown: "Desconhecida",
    loading: "Verificando...",
  },
  duplicateFinder: {
    title: "Encontrar arquivos duplicados",
    description:
      "Escolha uma pasta: encontre arquivos idênticos e decida quais mover para a Lixeira.",
    chooseFolder: "Escolher pasta",
    scanning: "Verificando...",
    noneFound: "Nenhum arquivo duplicado encontrado nesta pasta.",
    copies: "{count} cópias · {size} cada",
    moveSelected: "Mover para a Lixeira ({count} selecionados)",
    deleting: "...",
    deletedToast: "{count} arquivos movidos para a Lixeira ({freed} liberados).",
  },
  ipMask: {
    title: "Mascarar IP (VPN)",
    description:
      "Oculta seu endereço IP roteando o tráfego por um servidor VPN. Requer um serviço de VPN externo: ainda não integrado nesta versão.",
    button: "Saiba mais",
    explainerToast:
      "O mascaramento real de IP precisa de um backend de VPN dedicado (servidor + protocolo). Ainda não está conectado — isto é apenas uma prévia do recurso.",
  },
  toasts: {
    applied: '"{name}" aplicado.',
    rolledBack: '"{name}" restaurado ao valor original.',
    licenseNeedsRefresh:
      "Não conseguimos verificar sua assinatura Pro depois de tanto tempo offline. Reconecte-se à internet e tente novamente.",
    accountRefreshFailed:
      "Não conseguimos verificar o estado da sua conta. O que aparece aqui pode estar desatualizado — verifique sua conexão ou tente novamente mais tarde.",
  },
  titlebar: {
    applied: "{applied}/{total} ativos",
    cpu: "CPU",
    ram: "RAM",
    minimize: "Minimizar",
    maximize: "Maximizar",
    restore: "Restaurar",
    close: "Fechar",
  },
  x3d: {
    title: "Alinhador de die 3D V-Cache",
    subtitle:
      "Em um Ryzen X3D de dois dies, só um carrega o cache empilhado. O Windows não sabe qual é e espalha um jogo pelos dois - todo acesso que cruza os dies paga uma viagem pelo Infinity Fabric.",
    cpuLabel: "Processador",
    readyHeadline: "Die com V-Cache encontrado: {cores} threads",
    readyBody: "Fixe um jogo neste die e cada uma de suas threads permanece onde o cache está.",
    singleDie:
      "Este processador tem apenas um die: todos os núcleos já veem o mesmo cache, então não há nada para alinhar. O recurso aparece sozinho em uma CPU de dois dies com cache assimétrico.",
    uniformCache:
      "Este processador tem vários dies, todos com a mesma quantidade de cache. Mover um jogo entre eles não mudaria nada, então o recurso permanece desativado.",
    unavailable: "O Windows não retornou um mapa de cache para este processador.",
    dieLabel: "Die {index}",
    dieCache: "{mb} MB L3",
    dieThreads: "{count} threads",
    vcacheBadge: "V-Cache",
    processesTitle: "Processos em execução",
    processesHint: "Os mais ativos primeiro. Escolha o jogo e fixe-o no die do cache.",
    refresh: "Atualizar",
    refreshing: "Lendo...",
    align: "Alinhar",
    reset: "Redefinir",
    alignedBadge: "Alinhado",
    noProcesses: "Nenhum processo grande o suficiente para valer a pena listar.",
    persistenceNote:
      "A afinidade pertence ao processo em execução: desaparece quando o jogo fecha e precisa ser definida de novo na próxima vez. Nenhuma configuração do sistema é alterada.",
    alignedToast: "{name} fixado no die com V-Cache.",
    resetToast: "{name} devolvido a todos os núcleos.",
  },
  hardware: {
    intro:
      "Lido diretamente dos próprios sensores do seu hardware. Onde um sensor não existe, dizemos isso, em vez de mostrar um número que ninguém pode verificar.",
    gpuLabel: "Placa de vídeo",
    cpuLabel: "Processador",
    liveBadge: "Ao vivo",
    gpuDriver: "Driver {version}",
    load: "Uso da GPU",
    vram: "Memória de vídeo",
    fan: "Ventoinha",
    power: "Consumo de energia",
    fanIdle: "parada: desnecessária abaixo de 50°",
    powerLimit: "limite de {limit} W",
    tempCool: "fria",
    tempGood: "saudável",
    tempWarm: "quente",
    tempHot: "muito quente",
    traceLabel: "Esta sessão",
    traceRange: "mín {min}° · máx {max}°",
    noTempSensor: "Esta placa não expõe sensor de temperatura.",
    cpuAcpiSource: "lido da zona térmica ACPI",
    cpuNoSensor:
      "O firmware deste PC não expõe uma zona térmica ACPI, então o Windows não tem temperatura de CPU para ler. Ferramentas que sempre mostram uma instalam um driver em nível de kernel para ler os registradores do processador diretamente: o PC Tweaker não faz isso, e prefere dizer isso a mostrar um número inventado.",
    noGpuTool:
      "Nenhuma placa NVIDIA detectada. AMD e Intel não oferecem uma ferramenta de consulta equivalente, então suas temperaturas não podem ser lidas sem o software do próprio fabricante.",
    thermalsUnavailable: "Não conseguimos ler os sensores neste sistema.",
    driversTitle: "Idade dos drivers",
    driversSubtitle:
      "Há quanto tempo estão os drivers fornecidos pelo fabricante. O Windows sabe o que está instalado, não o que está disponível: isto informa a idade que ele pode comprovar, nunca um aviso de atualização falso.",
    driversRescan: "Reexaminar",
    driversScanning: "Verificando...",
    driversCounted: "{count} drivers de fabricantes",
    driversAging: "{count} com mais de 2 anos",
    driversStale: "{count} com mais de 4 anos",
    driversAllCurrent: "Todos recentes",
    driversNone: "Nenhum driver de terceiros nestas categorias.",
    driversShowAll: "Mostrar mais {count}",
    driversShowLess: "Mostrar menos",
    driversInboxNote:
      "{count} drivers nativos da Microsoft excluídos: o Windows Update cuida deles e sua data é um valor fixo, então contá-los como antigos seria um falso alarme.",
    ageYears: "{years} anos",
    ageYear: "{years} ano",
    ageMonths: "{months} meses",
    ageMonth: "{months} mês",
    vendorSite: "Site do fabricante",
    watchLabel: "Observando",
    peakLabel: "Pico",
    verdictRisky: "Arriscado",
    verdictNormal: "Normal",
    verdictBetter: "Melhor do que o esperado",
    verdictIdle: "Ocioso",
    verdictRiskyHint:
      "A placa passou de 84°, o ponto em que começa a reduzir o próprio desempenho para se proteger. Verifique a ventilação, ou mude para o perfil Silencioso.",
    verdictNormalHint: "Temperaturas na faixa normal para uma placa sob carga: nada alarmante.",
    verdictBetterHint:
      "Ficou abaixo de 65° enquanto trabalhava de verdade: resfriamento melhor que a média.",
    verdictIdleHint:
      "Ainda não trabalhou o suficiente para avaliar. Uma placa ociosa roda fria de qualquer forma, então isso não provaria nada.",
    profilesTitle: "Perfis térmicos",
    profilesSubtitle:
      "Estes definem o limite de energia da placa, a alavanca que realmente governa calor e ruído da ventoinha. Cada valor vem dos limites que a própria placa informa.",
    currentLimit: "Agora: {watts} W",
    modeSilent: "Silencioso",
    modeSilentHint:
      "Para trabalho, streaming e sessões longas: a ventoinha fica quase silenciosa e a placa roda bem mais fria, ao custo de alguns quadros.",
    modeStandard: "Padrão",
    modeStandardHint:
      "Um limite equilibrado um pouco abaixo do teto da placa: ventoinha mais silenciosa e temperaturas mais baixas, com um custo em frames de poucos pontos.",
    modeGaming: "Jogos",
    modeGamingHint:
      "Para sessões competitivas: watts no máximo e um teto de clock elevado, para manter os 1% mais baixos mais estáveis quando importa.",
    modeApplying: "Aplicando...",
    profileStageReading: "A ler os limites da placa",
    profileStageApplying: "A aplicar o limite",
    profileStageSettling: "A aguardar a resposta das ventoinhas",
    profileApplied: "Limite definido para {watts} W.",
    profileNote:
      "Requer privilégios de administrador e é redefinido ao reiniciar. Isto não é uma curva de ventoinha: a NVIDIA não expõe controle direto de ventoinha no nvidia-smi, e as ferramentas que oferecem isso usam APIs privadas e não documentadas que este app não utiliza.",
    profileDefaultIsMax:
      "Nesta placa o limite de energia de fábrica já é igual ao máximo, então Silencioso é o único perfil que muda a potência: Jogos se diferencia elevando o teto de clock em vez disso.",
    driverInstalled: "instalado v{version} em {date}",
    driversNoUpdateCheck:
      "Esta tela não contata nenhum fabricante e não pode saber se existe uma versão mais nova: mostra a versão instalada e sua idade, e leva você até a página oficial para verificar por conta própria.",
    driversCheckedAt: "Lido às {time}",
    modeClockLocked: "clock até {mhz} MHz",
    modeClockAuto: "clock automático",
    profileApply: "Aplicar perfil",
    profileActive: "Perfil ativo",
    profileWillSet: "Vai definir {watts} W, {clock}",
    scanStarting: "Iniciando verificação...",
    scanReading: "Lendo a classe {class}",
    scanCount: "{done}/{total} · {pct}%",
    driversScannedAll: "{total} drivers examinados em {classes} categorias",
    winUpdateLabel: "Windows Update",
    winUpdateButton: "Verificar no Windows Update",
    winUpdateNote:
      "Isto verifica apenas o próprio catálogo do Windows Update, não os drivers específicos listados acima: muitos fabricantes - de áudio e chipset integrados especialmente - nunca publicam suas atualizações ali, só no próprio site. O PC Tweaker não baixa pacotes de driver por conta própria: não existe uma API de fabricante para o que é atual para o seu dispositivo exato, e instalar o driver de vídeo errado é um dos poucos erros capazes de deixar você sem tela.",
    winUpdateOpened: "Windows Update aberto.",
    winUpdateSearching: "Buscando...",
    winUpdateTakesAWhile: "Pode demorar um minuto: consulta o catálogo da Microsoft.",
    winUpdateInstall: "Baixar e instalar ({count})",
    winUpdateInstalling: "Baixando e instalando...",
    winUpdateNone:
      "O Windows Update não tem nada mais recente a oferecer, mesmo para os drivers marcados como antigos acima: muitos fabricantes publicam suas atualizações à própria maneira, não pelo Windows Update.",
    winUpdateFailed: "A busca falhou: {detail}",
    winUpdateDone: "Instalados {installed}, falharam {failed}.",
    rebootTitle: "O Windows está pedindo um reinício",
    rebootBody:
      "O Windows informa que uma instalação só termina após um reinício. Você pode fazer isso agora ou quando for conveniente.",
    rebootNow: "Reiniciar agora",
    rebootLater: "Mais tarde",
  },
  menu: {
    account: "Conta",
    plan: "Plano",
    planFree: "Grátis",
    planPro: "Pro",
    viewPlan: "Ver seu plano",
    upgradeButton: "Assinar o Pro",
    language: "Idioma",
    theme: "Temas",
    about: "Sobre",
    errorReports: "Relatórios de erro anônimos",
    errorReportsBody:
      "Quando algo falha, envia apenas a mensagem de erro (nunca dados pessoais) para nos ajudar a corrigir bugs. Desativado por padrão.",
    changePhoto: "Alterar foto de perfil",
    removePhoto: "Remover foto",
    photoFailed: "Não foi possível usar essa imagem como foto de perfil.",
    support: "Suporte",
    reportIssue: "Relatar um problema",
    aboutBody: "PC Tweaker — ajustes de sistema com backup e reversão automáticos.",
    close: "Fechar",
  },
  auth: {
    login: "Entrar",
    register: "Cadastrar-se",
    email: "E-mail",
    password: "Senha",
    loginButton: "Entrar",
    rememberMe: "Manter conectado",
    registerButton: "Criar conta",
    working: "...",
    logout: "Sair",
    loggedInAs: "Conectado como {email}",
    backendNotConfigured:
      "Nenhum servidor conectado ainda: defina API_BASE_URL assim que o backend for implantado.",
    switchToRegister: "Não tem conta? Cadastre-se",
    switchToLogin: "Já tem uma conta? Entre",
    emailInvalid: "Digite um endereço de e-mail válido.",
    passwordTooShort: "A senha deve ter pelo menos 8 caracteres.",
    firstName: "Nome",
    lastName: "Sobrenome",
    registerDetailsRequired: "Nome, sobrenome e data de nascimento são obrigatórios.",
    loginRequiredForCheckout: "Entre ou cadastre-se antes de desbloquear o Pro.",
    forgotPasswordLink: "Esqueceu a senha?",
    forgotPasswordButton: "Enviar link de redefinição",
    forgotPasswordSent:
      "Se esse e-mail estiver cadastrado, você receberá um link para redefinir a senha.",
    backToLogin: "Voltar ao login",
    emailNotVerified: "E-mail não verificado",
    emailVerified: "E-mail verificado",
    resendVerification: "Reenviar",
    verificationSent: "E-mail de verificação enviado.",
  },
  tweaks: {
    disable_startup_delay: {
      name: "Remover o atraso de apps na inicialização",
      description:
        "O Windows espera propositalmente cerca de 10 segundos após o login antes de abrir seus programas de inicialização. Isto remove essa espera (HKCU, sem elevação necessária).",
    },
    menu_show_delay: {
      name: "Resposta instantânea dos menus",
      description:
        "Remove o atraso embutido antes de os menus abrirem, o que torna toda a área de trabalho perceptivelmente mais ágil (HKCU, sem elevação necessária).",
    },
    disable_power_throttling: {
      name: "Desativar limitação de energia da CPU",
      description:
        "Impede o Windows de reduzir a velocidade de processos em segundo plano para economizar energia - útil em notebooks onde a limitação causa engasgos em sessões longas (HKLM, requer privilégios de administrador).",
    },
    games_gpu_priority: {
      name: "Aumentar a prioridade de GPU para jogos",
      description:
        "Diz ao agendador multimídia para dar aos jogos a classe de prioridade de GPU mais alta, para que apps em segundo plano parem de disputar a GPU no meio de uma partida (HKLM, requer privilégios de administrador).",
    },
    disable_tailored_experiences: {
      name: "Desativar experiências personalizadas",
      description:
        "Impede o Windows de usar seus dados de diagnóstico para personalizar anúncios, dicas e recomendações (HKCU, sem elevação necessária).",
    },
    disable_app_launch_tracking: {
      name: "Parar de rastrear quais apps você abre",
      description:
        "O Windows registra a frequência com que você abre cada programa para classificar os resultados do menu Iniciar. Isto desativa esse registro (HKCU, sem elevação necessária).",
    },
    disable_feedback_requests: {
      name: "Parar as solicitações de feedback do Windows",
      description:
        "Impede que o Windows te interrompa com pesquisas do tipo 'Qual a probabilidade de você recomendar...' (HKCU, sem elevação necessária).",
    },
    disable_cortana: {
      name: "Desativar a Cortana",
      description:
        "Desativa a Cortana via política de sistema, liberando os recursos em segundo plano que ela reserva (HKLM, requer privilégios de administrador).",
    },
    show_file_extensions: {
      name: "Sempre mostrar extensões de arquivo",
      description:
        "Revela a extensão real de cada arquivo. Vale a pena ativar só pela segurança: expõe arquivos como 'fatura.pdf.exe' que o Windows normalmente esconde (HKCU, sem elevação necessária).",
    },
    hide_taskbar_widgets: {
      name: "Ocultar Widgets da barra de tarefas",
      description:
        "Remove o botão de Widgets de clima/notícias, que carrega conteúdo em segundo plano mesmo quando você nunca o abre (HKCU, sem elevação necessária).",
    },
    network_latency: {
      name: "Reduzir atraso de rede (algoritmo de Nagle)",
      description:
        "O Windows retém pacotes pequenos por alguns milissegundos para agrupá-los, e ainda atrasa as confirmações por cima. Essa é uma boa troca para downloads e uma péssima para jogos, onde todo pacote é pequeno e atrasado equivale a perdido. Isto desativa ambos no seu adaptador ativo (HKLM, requer privilégios de administrador).",
    },
    disable_window_animations: {
      name: "Animações de janela instantâneas",
      description:
        "Remove a animação de deslizar/esmaecer que o Windows exibe toda vez que uma janela abre, fecha ou minimiza. A animação é tempo de espera puro - removê-la faz a área de trabalho responder no instante do clique, e libera o trabalho de GPU por trás dela (HKCU, sem elevação necessária).",
    },
    disable_drag_full_windows: {
      name: "Arraste de janelas mais leve",
      description:
        "Desenha um contorno enquanto você arrasta uma janela em vez de redesenhar todo o seu conteúdo a cada quadro. Quase imperceptível em uma GPU rápida, uma diferença clara em gráficos integrados ou máquinas mais antigas (HKCU, sem elevação necessária).",
    },
    mouse_hover_delay: {
      name: "Resposta instantânea ao passar o mouse",
      description:
        "O Windows espera 400 ms antes de reagir ao ponteiro parado sobre algo - prévias da barra de tarefas, dicas de ferramentas, menus. Isto reduz essa espera a quase nada, para que a interface acompanhe o mouse em vez de ficar atrás dele (HKCU, sem elevação necessária).",
    },
    disable_background_apps: {
      name: "Impedir apps de rodar em segundo plano",
      description:
        "Impede que apps da Store rodem, atualizem e consultem a rede enquanto você não os está usando. Isso é CPU, RAM e bateria de verdade gastos em apps que você não abriu (HKCU, sem elevação necessária).",
    },
    disable_delivery_optimization: {
      name: "Parar de compartilhar atualizações do Windows com estranhos",
      description:
        "Por padrão, o Windows envia arquivos de atualização já baixados para outros PCs pela sua conexão. Isto limita o Delivery Optimization à sua própria máquina, o que impede esse envio de consumir banda no meio de um jogo (HKLM, requer privilégios de administrador).",
    },
    disable_copilot: {
      name: "Desativar o Windows Copilot",
      description:
        "Remove o assistente Copilot da barra de tarefas e impede que ele rode em segundo plano. O Windows vem com ele ativado e não há um botão permanente de desligar nas Configurações — isto define a política de sistema que o desliga de vez (HKCU, sem elevação necessária).",
    },
    disable_suggested_apps: {
      name: "Impedir o Windows de instalar apps sozinho",
      description:
        "O Windows instala silenciosamente apps e jogos 'sugeridos' no seu menu Iniciar sem perguntar, em uma instalação nova e novamente após grandes atualizações. Isto desativa isso, para que nada chegue à sua máquina sem você escolher (HKCU, sem elevação necessária).",
    },
    disable_mouse_acceleration: {
      name: "Desativar aceleração do mouse",
      description:
        "Desativa 'Aprimorar precisão do ponteiro', que faz o cursor percorrer mais distância quando você move o mouse mais rápido. Essa resposta variável é exatamente o que você não quer ao mirar: o mesmo movimento físico deve sempre cobrir a mesma distância na tela (HKCU, sem elevação necessária).",
    },
    disable_sticky_keys_prompt: {
      name: "Parar o pop-up das Teclas de Aderência",
      description:
        "Pressionar Shift cinco vezes normalmente abre a janela das Teclas de Aderência — o que em um jogo significa sair da tela cheia no pior momento possível, geralmente no meio de uma luta. Isto desativa o atalho e seu aviso; as Teclas de Aderência continuam disponíveis nas Configurações (HKCU, sem elevação necessária).",
    },
    disable_recall: {
      name: "Desativar o Recall (capturas de tela por IA)",
      description:
        "O Recall tira uma captura de tela da sua área de trabalho a cada poucos segundos e monta um histórico pesquisável, indexado por IA, de tudo que você já viu — senhas e mensagens privadas incluídas, já que captura o que estiver na tela. Isto define a política de sistema que impede que ele analise ou armazene qualquer coisa (HKLM, requer privilégios de administrador).",
    },
    disable_memory_integrity: {
      name: "Desativar Integridade de Memória (VBS)",
      description:
        "A Integridade de Memória executa partes do Windows dentro de um contêiner virtualizado por hardware, o que custa CPU a cada transição de kernel — motivo pelo qual é o maior ganho gratuito de taxa de quadros na maioria das máquinas de jogo. Deixando claro o trade-off: é um recurso de segurança real, e desativá-lo remove proteção contra drivers maliciosos. Vale a pena em um PC dedicado a jogos, não em uma máquina de trabalho. Tem efeito após reiniciar (HKLM, requer privilégios de administrador).",
    },
    disable_typing_personalization: {
      name: "Impedir o Windows de aprender como você digita",
      description:
        "O Windows monta um dicionário pessoal a partir do que você digita e escreve à mão — incluindo em gerenciadores de senha, janelas de chat e caixas de busca — e o sincroniza com sua conta Microsoft para melhorar suas sugestões. Isto desativa tanto a coleta de texto quanto a de escrita à mão (HKCU, sem elevação necessária).",
    },
    classic_context_menu: {
      name: "Restaurar o menu de clique direito completo",
      description:
        "O Windows 11 esconde a maior parte do menu de clique direito atrás de 'Mostrar mais opções', transformando um clique em dois para coisas que você faz o dia todo. Isto restaura o menu completo do Windows 10 em todo o Explorador de Arquivos e na área de trabalho. O Explorer reinicia para aplicar, então janelas abertas vão piscar uma vez (HKCU, sem elevação necessária).",
    },
    disable_transparency: {
      name: "Desativar efeitos de transparência",
      description:
        "Desativa os efeitos de desfoque/acrílico na barra de tarefas e nos menus. Uma economia de GPU pequena mas real, e deixa máquinas mais antigas ou com gráficos integrados mais fluidas (HKCU, sem elevação necessária).",
    },
    dark_mode: {
      name: "Modo escuro",
      description: "Ativa o tema escuro para apps e sistema (HKCU, sem elevação necessária).",
    },
    show_hidden_files: {
      name: "Mostrar arquivos ocultos",
      description:
        "Mostra arquivos e pastas ocultos no Explorador de Arquivos (HKCU, sem elevação necessária).",
    },
    priority_separation: {
      name: "Otimizar prioridade da CPU",
      description:
        "Ajusta o Win32PrioritySeparation (0x26) para que o app em primeiro plano receba fatias de tempo de CPU curtas e variáveis com um aumento de prioridade de 3x — o valor clássico de responsividade para desktop/jogos (HKLM, requer privilégios de administrador).",
    },
    disable_game_dvr: {
      name: "Desativar Xbox Game Bar / Game DVR",
      description:
        "Desativa a gravação em segundo plano da Xbox Game Bar, que consome CPU/GPU durante os jogos (HKCU, sem elevação necessária).",
    },
    disable_telemetry_tasks: {
      name: "Reduzir a coleta de dados de diagnóstico",
      description:
        "Define o nível de dados de diagnóstico do Windows para o mínimo permitido (HKLM, requer privilégios de administrador).",
    },
    reset_advertising_id: {
      name: "Desativar ID de publicidade",
      description:
        "Impede que apps usem seu ID de publicidade para perfilamento (HKCU, sem elevação necessária).",
    },
    disable_location_tracking: {
      name: "Desativar rastreamento de localização",
      description:
        "Bloqueia o acesso à localização para todos os apps via política de sistema (HKLM, requer privilégios de administrador).",
    },
    disable_bing_search: {
      name: "Desativar a busca do Bing no menu Iniciar",
      description:
        "Impede que suas buscas no menu Iniciar sejam enviadas ao Bing (HKCU, sem elevação necessária).",
    },
    power_plan_performance: {
      name: "Alto desempenho (plano de energia)",
      description:
        'Muda para o plano de energia "Alto desempenho" do Windows. Útil em desktops ou quando conectado à tomada; restaura o plano anterior ao reverter.',
    },
    turbo_gaming: {
      name: "Turbo Gaming",
      description:
        "Preset: desativa o Game DVR, muda o plano de energia para Alto desempenho, e otimiza a prioridade da CPU (requer privilégios de administrador).",
    },
    privacy_dns: {
      name: "DNS privado (Cloudflare)",
      description:
        "Muda para servidores DNS focados em privacidade (1.1.1.1), impedindo que seu provedor registre suas consultas DNS. Não oculta seu endereço IP (isso precisa de uma VPN, veja abaixo).",
    },
    hardware_gpu_scheduling: {
      name: "Agendamento de GPU acelerado por hardware",
      description:
        "Ativa o Agendamento de GPU acelerado por hardware (HAGS) do Windows, que pode reduzir a latência de entrada em muitos jogos (HKLM, requer privilégios de administrador).",
    },
    reduce_input_lag: {
      name: "Reduzir latência de entrada (mouse)",
      description:
        'Desativa a aceleração do ponteiro ("Aprimorar precisão do ponteiro") para movimento do mouse 1:1, sem atraso adicionado pelo sistema (HKCU, sem elevação necessária).',
    },
    turbo_boost: {
      name: "CPU Turbo Boost",
      description:
        'Define o modo de boost de desempenho do processador como "Agressivo", extraindo o máximo do Turbo Boost/Turbo Core durante os jogos (requer privilégios de administrador).',
    },
    network_throttling_index: {
      name: "Desativar limitação de rede multimídia",
      description:
        "Remove o limite que o Windows impõe ao tráfego de rede enquanto apps de multimídia/jogos estão ativos, útil para reduzir microtravamentos online (HKLM, requer privilégios de administrador).",
    },
    system_responsiveness: {
      name: "Maximizar a responsividade dos apps em primeiro plano",
      description:
        "Zera a parcela de CPU que o Windows reserva para tarefas em segundo plano, deixando mais recursos para o app/jogo em primeiro plano (HKLM, requer privilégios de administrador).",
    },
    games_task_priority: {
      name: "Prioridade máxima para jogos (agendador multimídia)",
      description:
        "Diz ao agendador multimídia do Windows para tratar jogos como os processos de maior prioridade no sistema, à frente de qualquer tarefa em segundo plano (HKLM, requer privilégios de administrador).",
    },
    reduce_keyboard_delay: {
      name: "Reduzir atraso de entrada (teclado)",
      description:
        "Zera o atraso antes de uma tecla pressionada começar a se repetir e maximiza sua taxa de repetição, para uma resposta mais ágil em jogos (HKCU, sem elevação necessária).",
    },
    keep_kernel_in_ram: {
      name: "Manter o kernel e os drivers na RAM",
      description:
        "O Windows pode enviar partes do kernel e do código dos drivers para o disco mesmo com memória de sobra, e recarregá-las é uma pausa que se sente como um engasgo. Isto os mantém residentes. Vale a pena em máquinas com RAM sobrando; em um PC com pouca memória, deixe desativado (HKLM, requer privilégios de administrador).",
    },
    auto_end_frozen_tasks: {
      name: "Não deixar um app travado bloquear o desligamento",
      description:
        'Quando um aplicativo para de responder durante o desligamento, o Windows espera e mostra a tela "Este app está impedindo o desligamento" até alguém clicar. Isto fecha automaticamente os apps que não respondem, para que um programa travado não deixe a máquina ligada (HKCU, sem elevação necessária).',
    },
    instant_folder_loading: {
      name: "Abrir toda pasta instantaneamente",
      description:
        "O Explorer examina o conteúdo de uma pasta para adivinhar se é Imagens, Música ou Documentos, e uma pasta com milhares de arquivos de mídia pode travar por segundos enquanto decide. Isto fixa todas as pastas no layout geral, para que abram na hora (HKCU, sem elevação necessária).",
    },
    tcp_congestion_bbr: {
      name: "Manter a latência baixa quando a conexão está ocupada (BBR2)",
      description:
        "O Windows usa CUBIC, que acelera até algum buffer transbordar em algum lugar - por isso seu ping sobe no momento em que outra pessoa em casa começa um download. O BBR2 mede a largura de banda real e o tempo de ida e volta da conexão e ajusta o ritmo do tráfego a isso, então o cano enche sem a fila encher. A Microsoft inclui o BBR2 no Windows 11; isto muda o modelo Internet para ele, e volta exatamente ao que havia antes (requer privilégios de administrador).",
    },
    taskbar_align_left: {
      name: "Alinhar a barra de tarefas à esquerda",
      description:
        "Move os ícones da barra de tarefas de volta para a esquerda (estilo Windows 10) em vez de centralizados (HKCU, sem elevação necessária).",
    },
    hide_taskbar_chat: {
      name: "Ocultar Chat/Teams da barra de tarefas",
      description:
        "Remove o ícone do Chat (Microsoft Teams) da barra de tarefas (HKCU, sem elevação necessária).",
    },
    disable_start_suggestions: {
      name: "Desativar sugestões e apps recomendados no menu Iniciar",
      description:
        "Impede que o Windows mostre apps recomendados, anúncios e sugestões no menu Iniciar (HKCU, sem elevação necessária).",
    },
    disable_activity_history: {
      name: "Desativar histórico de atividades (Linha do Tempo do Windows)",
      description:
        "Impede que o Windows registre, salve e envie à Microsoft seu histórico de uso de apps e documentos, via política de sistema (HKLM, requer privilégios de administrador).",
    },
    hide_taskbar_search: {
      name: "Ocultar a caixa de busca da barra de tarefas",
      description:
        "Remove a caixa/ícone de busca da barra de tarefas para uma barra mais limpa (a busca continua disponível pela tecla Windows) (HKCU, sem elevação necessária).",
    },
    disable_fullscreen_optimizations_global: {
      name: "Desativar otimizações de tela cheia globalmente",
      description:
        "Força o DXGI a respeitar a tela cheia exclusiva de verdade em vez do modo simulado do Windows, reduzindo microtravamentos e latência de entrada em muitos jogos mais antigos (HKCU, sem elevação necessária).",
    },
    disable_windows_search_service: {
      name: "Desativar o serviço de indexação (Windows Search)",
      description:
        "Para e desativa o serviço de indexação de arquivos do Windows, reduzindo a atividade de disco em segundo plano — útil em SSDs pequenos ou durante jogos. A busca de arquivos no menu Iniciar fica mais lenta até você reativá-lo (requer privilégios de administrador).",
    },
  },
  cleanup: {
    temp_cleanup: {
      name: "Limpar arquivos temporários",
      description:
        "Move o conteúdo de %TEMP% para a Lixeira: você pode recuperá-lo a qualquer momento, não é uma exclusão permanente.",
    },
    winupdate_cache_cleanup: {
      name: "Limpar cache do Windows Update",
      description:
        "Move pacotes do Windows Update já instalados para a Lixeira (requer privilégios de administrador).",
    },
  },
};

export const STRINGS: Record<Lang, Strings> = { it, en, fr, es, de, pt };

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
