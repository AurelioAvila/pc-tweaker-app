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
    all: string;
    performance: string;
    privacy: string;
    ui: string;
    manutenzione: string;
    gaming: string;
  };
  badges: { admin: string; pro: string; soon: string };
  emptyCategory: string;
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
  tabs: { all: "Tutti", performance: "Performance", privacy: "Privacy", ui: "UI", manutenzione: "Manutenzione", gaming: "Gaming" },
  badges: { admin: "Admin", pro: "PRO", soon: "IN ARRIVO" },
  emptyCategory: "Nessun tweak disponibile in questa categoria — presto in arrivo.",
  paywall: {
    title: "Funzione Pro",
    body: '"{feature}" fa parte della versione Pro di PC Tweaker. Sblocca con un pagamento unico, senza abbonamento: tweak avanzati, applicazione in batch e aggiornamenti futuri inclusi.',
    unlock: "Sblocca Pro — pagamento unico",
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
    theme: "Tema",
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
  },
  tweaks: {
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
  tabs: { all: "All", performance: "Performance", privacy: "Privacy", ui: "UI", manutenzione: "Maintenance", gaming: "Gaming" },
  badges: { admin: "Admin", pro: "PRO", soon: "COMING SOON" },
  emptyCategory: "No tweaks available in this category yet — more coming soon.",
  paywall: {
    title: "Pro feature",
    body: '"{feature}" is part of PC Tweaker Pro. Unlock it with a one-time payment, no subscription: advanced tweaks, batch presets, and future updates included.',
    unlock: "Unlock Pro — one-time payment",
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
    theme: "Theme",
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
  },
  tweaks: {
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
  tabs: { all: "Tous", performance: "Performance", privacy: "Confidentialité", ui: "Interface", manutenzione: "Entretien", gaming: "Gaming" },
  badges: { admin: "Admin", pro: "PRO", soon: "BIENTÔT" },
  emptyCategory: "Aucune optimisation disponible dans cette catégorie pour l'instant — à venir.",
  paywall: {
    title: "Fonction Pro",
    body: '« {feature} » fait partie de PC Tweaker Pro. Débloquez-la avec un paiement unique, sans abonnement : optimisations avancées, application par lot et mises à jour futures incluses.',
    unlock: "Débloquer Pro — paiement unique",
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
    theme: "Thème",
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
  },
  tweaks: {
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
  tabs: { all: "Todos", performance: "Rendimiento", privacy: "Privacidad", ui: "Interfaz", manutenzione: "Mantenimiento", gaming: "Gaming" },
  badges: { admin: "Admin", pro: "PRO", soon: "PRÓXIMAMENTE" },
  emptyCategory: "Todavía no hay ajustes disponibles en esta categoría — próximamente.",
  paywall: {
    title: "Función Pro",
    body: '"{feature}" forma parte de PC Tweaker Pro. Desbloquéala con un pago único, sin suscripción: ajustes avanzados, aplicación por lotes y futuras actualizaciones incluidas.',
    unlock: "Desbloquear Pro — pago único",
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
    theme: "Tema",
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
  },
  tweaks: {
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
  tabs: { all: "Alle", performance: "Leistung", privacy: "Datenschutz", ui: "Oberfläche", manutenzione: "Wartung", gaming: "Gaming" },
  badges: { admin: "Admin", pro: "PRO", soon: "DEMNÄCHST" },
  emptyCategory: "In dieser Kategorie sind noch keine Optimierungen verfügbar — bald verfügbar.",
  paywall: {
    title: "Pro-Funktion",
    body: '„{feature}" ist Teil von PC Tweaker Pro. Freischalten mit einer einmaligen Zahlung, kein Abo: erweiterte Optimierungen, Batch-Anwendung und zukünftige Updates inklusive.',
    unlock: "Pro freischalten — einmalige Zahlung",
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
    plan: "Plan",
    planFree: "Kostenlos",
    planPro: "Pro",
    upgradeButton: "Auf Pro upgraden",
    language: "Sprache",
    theme: "Design",
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
  },
  tweaks: {
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
      name: "Private DNS (Cloudflare)",
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

export function detectInitialLang(): Lang {
  const stored = localStorage.getItem("pc-tweaker-lang");
  if (stored && stored in STRINGS) return stored as Lang;
  const nav = navigator.language.slice(0, 2).toLowerCase();
  if (nav in STRINGS) return nav as Lang;
  return "en";
}
