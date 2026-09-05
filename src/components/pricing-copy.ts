import type { Lang } from "../i18n";

type PricingCopy = {
  title: string;
  intro: string;
  signed: string;
  signature: string;
  previewBuild: string;
  free: string;
  pro: string;
  lifetime: string;
  renewal: string;
  perpetual: string;
  compare: string;
  capability: string;
  essentials: string;
  advanced: string;
  sessions: string;
  restores: string;
  updates: string;
  profiles: string;
  reports: string;
  profileDetail: string;
  reportDetail: string;
  newExtras: string;
  openTools: string;
  notBenchmark: string;
  campaign: string;
  mayChange: string;
  ends: string;
  hours: string;
  minutes: string;
  seconds: string;
  preview: string;
  unavailable: string;
  retry: string;
  expired: string;
  scheduled: string;
  checking: string;
  checkout: string;
  terms: string;
  twoYears: string;
  current: string;
  afterCancel: string;
  previewCheckout: string;
};

export const PRICING_COPY: Record<Lang, PricingCopy> = {
  en: {
    title: "Your PC. Your terms.",
    intro: "Start with the essentials. Add advanced tools. Or make Pro yours with one payment.",
    signed: "Code-signed Windows releases",
    signature:
      "Code signing is now in place. Release installers signed by Aurelio Avila let Windows verify the publisher and file integrity. Older downloads may be unsigned. SmartScreen warnings can still appear.",
    previewBuild: "You are viewing a developer build, not a signed release installer.",
    free: "Understand your PC and choose your first changes.",
    pro: "Advanced tuning, privacy and game-session tools.",
    lifetime: "Every Pro tool, no recurring bill. Two additional tools for your tuning workflow.",
    renewal: "Renews until canceled. Manage it from your account.",
    perpetual: "One payment. No subscription renewal.",
    compare: "Choose by what you use",
    capability: "What is included",
    essentials: "Core tweaks and live monitoring",
    advanced: "Advanced Pro tools",
    sessions: "Automatic game sessions",
    restores: "Restore supported settings",
    updates: "Pro updates",
    profiles: "Compare saved profiles",
    reports: "Portable tuning reports",
    profileDetail:
      "Put two saved profiles side by side. See shared settings and the differences before choosing one.",
    reportDetail:
      "Preview and export a Markdown report of your recorded settings, with an optional profile comparison. You choose what to share.",
    newExtras: "Two more reasons to own Lifetime",
    openTools: "Open Lifetime tools",
    notBenchmark: "These tools document settings. They do not measure or claim performance gains.",
    campaign: "The current Lifetime offer ends in",
    mayChange:
      "Prices and availability may change after this deadline. Existing Lifetime access stays yours.",
    ends: "Offer ends",
    hours: "hours",
    minutes: "minutes",
    seconds: "seconds",
    preview: "Campaign preview · not live",
    unavailable: "Lifetime availability could not be verified. Refresh before purchasing.",
    retry: "Check again",
    expired: "This Lifetime offer has ended.",
    scheduled: "The next Lifetime offer has not started yet.",
    checking: "Checking Lifetime availability…",
    checkout: "Final price, applicable taxes and payment terms are shown at checkout.",
    terms: "Clear terms, before you choose",
    twoYears: "At today's annual price, two years of Pro cost {price}.",
    current: "Current plan",
    afterCancel:
      "Supported restores remain available after Pro expires. Cleanup and repair have their own recovery limits.",
    previewCheckout: "Checkout is disabled for this campaign preview.",
  },
  it: {
    title: "Il tuo PC. Alle tue condizioni.",
    intro:
      "Parti dagli strumenti essenziali. Aggiungi quelli avanzati. Oppure scegli Pro con un solo pagamento.",
    signed: "Release Windows firmate digitalmente",
    signature:
      "La firma digitale è ora disponibile. Gli installer firmati da Aurelio Avila consentono a Windows di verificare autore e integrità. I download precedenti potrebbero non essere firmati. SmartScreen può ancora mostrare avvisi.",
    previewBuild: "Stai usando una build di sviluppo, non un installer di release firmato.",
    free: "Conosci il tuo PC e scegli le prime modifiche.",
    pro: "Strumenti avanzati per tuning, privacy e sessioni di gioco.",
    lifetime:
      "Tutti gli strumenti Pro, senza rinnovi. Due strumenti aggiuntivi per le tue configurazioni.",
    renewal: "Si rinnova fino alla disdetta. Gestiscilo dal tuo account.",
    perpetual: "Un pagamento. Nessun rinnovo dell'abbonamento.",
    compare: "Scegli in base a ciò che usi",
    capability: "Cosa è incluso",
    essentials: "Tweak essenziali e monitoraggio live",
    advanced: "Strumenti Pro avanzati",
    sessions: "Sessioni di gioco automatiche",
    restores: "Ripristino delle impostazioni supportate",
    updates: "Aggiornamenti Pro",
    profiles: "Confronto dei profili salvati",
    reports: "Report delle impostazioni esportabili",
    profileDetail:
      "Affianca due profili salvati. Controlla impostazioni comuni e differenze prima di sceglierne uno.",
    reportDetail:
      "Visualizza ed esporta un report Markdown delle impostazioni registrate, con un confronto facoltativo tra profili. Scegli tu cosa condividere.",
    newExtras: "Due motivi in più per scegliere Lifetime",
    openTools: "Apri gli strumenti Lifetime",
    notBenchmark:
      "Questi strumenti documentano le impostazioni. Non misurano né promettono aumenti di prestazioni.",
    campaign: "L'offerta Lifetime attuale termina tra",
    mayChange:
      "Prezzi e disponibilità potrebbero cambiare dopo questa scadenza. Il Lifetime già acquistato rimane tuo.",
    ends: "Fine dell'offerta",
    hours: "ore",
    minutes: "minuti",
    seconds: "secondi",
    preview: "Anteprima della campagna · non attiva",
    unavailable:
      "Impossibile verificare la disponibilità di Lifetime. Aggiorna prima di acquistare.",
    retry: "Verifica di nuovo",
    expired: "Questa offerta Lifetime è terminata.",
    scheduled: "La prossima offerta Lifetime non è ancora iniziata.",
    checking: "Verifica disponibilità Lifetime…",
    checkout:
      "Prezzo finale, imposte applicabili e condizioni di pagamento sono mostrati al checkout.",
    terms: "Condizioni chiare prima di scegliere",
    twoYears: "Al prezzo annuale attuale, due anni di Pro costano {price}.",
    current: "Piano attuale",
    afterCancel:
      "I ripristini supportati restano disponibili dopo la scadenza di Pro. Pulizia e riparazione hanno limiti di recupero specifici.",
    previewCheckout: "Il checkout è disabilitato nell'anteprima della campagna.",
  },
  fr: {
    title: "Votre PC. Votre choix.",
    intro:
      "Commencez par l'essentiel. Ajoutez les outils avancés. Ou choisissez Pro en un seul paiement.",
    signed: "Versions Windows signées numériquement",
    signature:
      "La signature numérique est en place. Les programmes d'installation signés par Aurelio Avila permettent à Windows de vérifier l'éditeur et l'intégrité. Les anciens téléchargements peuvent ne pas être signés. SmartScreen peut encore afficher un avertissement.",
    previewBuild:
      "Vous utilisez une version de développement, pas un programme d'installation signé.",
    free: "Comprenez votre PC et choisissez vos premiers réglages.",
    pro: "Outils avancés de réglage, de confidentialité et de jeu.",
    lifetime:
      "Tous les outils Pro, sans renouvellement. Deux outils supplémentaires pour vos configurations.",
    renewal: "Renouvellement jusqu'à résiliation. Gérez-le depuis votre compte.",
    perpetual: "Un paiement. Aucun renouvellement d'abonnement.",
    compare: "Choisissez selon vos usages",
    capability: "Fonctions incluses",
    essentials: "Réglages essentiels et suivi en direct",
    advanced: "Outils Pro avancés",
    sessions: "Sessions de jeu automatiques",
    restores: "Restauration des réglages pris en charge",
    updates: "Mises à jour Pro",
    profiles: "Comparaison de profils enregistrés",
    reports: "Rapports de réglages exportables",
    profileDetail:
      "Comparez deux profils enregistrés. Consultez les réglages communs et les différences avant de choisir.",
    reportDetail:
      "Consultez et exportez un rapport Markdown de vos réglages enregistrés, avec une comparaison facultative. Vous choisissez ce que vous partagez.",
    newExtras: "Deux raisons de plus de choisir l'offre à vie",
    openTools: "Ouvrir les outils à vie",
    notBenchmark:
      "Ces outils documentent les réglages. Ils ne mesurent ni ne promettent de gains de performances.",
    campaign: "L'offre à vie actuelle se termine dans",
    mayChange:
      "Les prix et la disponibilité peuvent changer après cette échéance. Vos droits à vie déjà acquis sont conservés.",
    ends: "Fin de l'offre",
    hours: "heures",
    minutes: "minutes",
    seconds: "secondes",
    preview: "Aperçu de campagne · non actif",
    unavailable: "Disponibilité de l'offre à vie non vérifiée. Actualisez avant d'acheter.",
    retry: "Vérifier à nouveau",
    expired: "Cette offre à vie est terminée.",
    scheduled: "La prochaine offre à vie n'a pas encore commencé.",
    checking: "Vérification de l'offre à vie…",
    checkout: "Le prix final, les taxes et les conditions de paiement sont indiqués au paiement.",
    terms: "Des conditions claires avant de choisir",
    twoYears: "Au tarif annuel actuel, deux ans de Pro coûtent {price}.",
    current: "Offre actuelle",
    afterCancel:
      "Les restaurations prises en charge restent disponibles après l'expiration de Pro. Le nettoyage et la réparation ont leurs propres limites.",
    previewCheckout: "Le paiement est désactivé dans cet aperçu de campagne.",
  },
  es: {
    title: "Tu PC. Tú decides.",
    intro: "Empieza por lo esencial. Añade herramientas avanzadas. O elige Pro con un solo pago.",
    signed: "Versiones de Windows con firma digital",
    signature:
      "La firma digital ya está disponible. Los instaladores firmados por Aurelio Avila permiten a Windows verificar el editor y la integridad. Las descargas anteriores pueden no estar firmadas. SmartScreen aún puede mostrar avisos.",
    previewBuild: "Estás usando una versión de desarrollo, no un instalador firmado.",
    free: "Conoce tu PC y elige tus primeros ajustes.",
    pro: "Herramientas avanzadas de ajustes, privacidad y sesiones de juego.",
    lifetime:
      "Todas las herramientas Pro, sin renovaciones. Dos herramientas adicionales para tus configuraciones.",
    renewal: "Se renueva hasta que lo canceles. Gestión desde tu cuenta.",
    perpetual: "Un pago. Sin renovación de suscripción.",
    compare: "Elige según lo que uses",
    capability: "Qué incluye",
    essentials: "Ajustes esenciales y monitorización en vivo",
    advanced: "Herramientas Pro avanzadas",
    sessions: "Sesiones de juego automáticas",
    restores: "Restauración de ajustes compatibles",
    updates: "Actualizaciones Pro",
    profiles: "Comparación de perfiles guardados",
    reports: "Informes de ajustes exportables",
    profileDetail:
      "Compara dos perfiles guardados. Revisa los ajustes comunes y las diferencias antes de elegir.",
    reportDetail:
      "Revisa y exporta un informe Markdown de tus ajustes registrados, con una comparación opcional. Tú eliges qué compartir.",
    newExtras: "Dos motivos más para elegir Lifetime",
    openTools: "Abrir herramientas Lifetime",
    notBenchmark:
      "Estas herramientas documentan ajustes. No miden ni prometen mejoras de rendimiento.",
    campaign: "La oferta Lifetime actual termina en",
    mayChange:
      "Los precios y la disponibilidad podrían cambiar después de esta fecha. Conservas tu acceso Lifetime adquirido.",
    ends: "Fin de la oferta",
    hours: "horas",
    minutes: "minutos",
    seconds: "segundos",
    preview: "Vista previa de campaña · no activa",
    unavailable: "No se pudo verificar la disponibilidad de Lifetime. Actualiza antes de comprar.",
    retry: "Volver a comprobar",
    expired: "Esta oferta Lifetime ha terminado.",
    scheduled: "La próxima oferta Lifetime aún no ha empezado.",
    checking: "Comprobando disponibilidad de Lifetime…",
    checkout: "El precio final, los impuestos y las condiciones de pago se muestran al pagar.",
    terms: "Condiciones claras antes de elegir",
    twoYears: "Al precio anual actual, dos años de Pro cuestan {price}.",
    current: "Plan actual",
    afterCancel:
      "Las restauraciones compatibles siguen disponibles al caducar Pro. La limpieza y la reparación tienen sus propios límites.",
    previewCheckout: "El pago está desactivado en esta vista previa de campaña.",
  },
  de: {
    title: "Dein PC. Deine Entscheidung.",
    intro:
      "Beginne mit dem Wesentlichen. Ergänze erweiterte Werkzeuge. Oder wähle Pro mit einer einzigen Zahlung.",
    signed: "Digital signierte Windows-Versionen",
    signature:
      "Die Codesignierung ist eingerichtet. Von Aurelio Avila signierte Installationsdateien ermöglichen Windows, Herausgeber und Integrität zu prüfen. Ältere Downloads können unsigniert sein. SmartScreen kann weiterhin warnen.",
    previewBuild: "Du verwendest eine Entwicklungsversion, kein signiertes Installationspaket.",
    free: "Verstehe deinen PC und wähle deine ersten Änderungen.",
    pro: "Erweiterte Werkzeuge für Tuning, Datenschutz und Spielsitzungen.",
    lifetime:
      "Alle Pro-Werkzeuge ohne laufendes Abo. Zwei zusätzliche Werkzeuge für deine Konfigurationen.",
    renewal: "Verlängert sich bis zur Kündigung. Verwaltung über dein Konto.",
    perpetual: "Eine Zahlung. Keine Aboverlängerung.",
    compare: "Wähle nach deinem Bedarf",
    capability: "Enthaltene Funktionen",
    essentials: "Grundlegende Tweaks und Live-Monitoring",
    advanced: "Erweiterte Pro-Werkzeuge",
    sessions: "Automatische Spielsitzungen",
    restores: "Unterstützte Einstellungen wiederherstellen",
    updates: "Pro-Updates",
    profiles: "Gespeicherte Profile vergleichen",
    reports: "Exportierbare Einstellungsberichte",
    profileDetail:
      "Vergleiche zwei gespeicherte Profile. Prüfe gemeinsame Einstellungen und Unterschiede vor deiner Auswahl.",
    reportDetail:
      "Prüfe und exportiere einen Markdown-Bericht deiner erfassten Einstellungen mit optionalem Profilvergleich. Du entscheidest, was du teilst.",
    newExtras: "Zwei weitere Gründe für Lifetime",
    openTools: "Lifetime-Werkzeuge öffnen",
    notBenchmark:
      "Diese Werkzeuge dokumentieren Einstellungen. Sie messen oder versprechen keine Leistungsgewinne.",
    campaign: "Das aktuelle Lifetime-Angebot endet in",
    mayChange:
      "Preise und Verfügbarkeit können sich danach ändern. Bereits erworbener Lifetime-Zugang bleibt bestehen.",
    ends: "Angebotsende",
    hours: "Stunden",
    minutes: "Minuten",
    seconds: "Sekunden",
    preview: "Kampagnenvorschau · nicht aktiv",
    unavailable: "Lifetime-Verfügbarkeit konnte nicht geprüft werden. Vor dem Kauf aktualisieren.",
    retry: "Erneut prüfen",
    expired: "Dieses Lifetime-Angebot ist beendet.",
    scheduled: "Das nächste Lifetime-Angebot hat noch nicht begonnen.",
    checking: "Lifetime-Verfügbarkeit wird geprüft…",
    checkout: "Endpreis, Steuern und Zahlungsbedingungen werden beim Bezahlen angezeigt.",
    terms: "Klare Bedingungen vor deiner Wahl",
    twoYears: "Zum heutigen Jahrespreis kosten zwei Jahre Pro {price}.",
    current: "Aktueller Tarif",
    afterCancel:
      "Unterstützte Wiederherstellungen bleiben nach Ablauf von Pro verfügbar. Bereinigung und Reparatur haben eigene Grenzen.",
    previewCheckout: "Zahlungen sind in dieser Kampagnenvorschau deaktiviert.",
  },
  pt: {
    title: "O seu PC. A sua escolha.",
    intro:
      "Comece pelo essencial. Adicione ferramentas avançadas. Ou escolha Pro com um único pagamento.",
    signed: "Versões Windows assinadas digitalmente",
    signature:
      "A assinatura digital já está disponível. Os instaladores assinados por Aurelio Avila permitem ao Windows verificar o editor e a integridade. Os downloads anteriores podem não estar assinados. O SmartScreen ainda pode apresentar avisos.",
    previewBuild: "Está a usar uma versão de desenvolvimento, não um instalador assinado.",
    free: "Conheça o seu PC e escolha os primeiros ajustes.",
    pro: "Ferramentas avançadas de ajustes, privacidade e sessões de jogo.",
    lifetime:
      "Todas as ferramentas Pro, sem renovações. Duas ferramentas adicionais para as suas configurações.",
    renewal: "Renova até ao cancelamento. Gestão através da sua conta.",
    perpetual: "Um pagamento. Sem renovação de subscrição.",
    compare: "Escolha pelo que utiliza",
    capability: "O que está incluído",
    essentials: "Ajustes essenciais e monitorização em direto",
    advanced: "Ferramentas Pro avançadas",
    sessions: "Sessões de jogo automáticas",
    restores: "Restauro de definições suportadas",
    updates: "Atualizações Pro",
    profiles: "Comparação de perfis guardados",
    reports: "Relatórios de definições exportáveis",
    profileDetail:
      "Compare dois perfis guardados. Consulte as definições comuns e as diferenças antes de escolher.",
    reportDetail:
      "Pré-visualize e exporte um relatório Markdown das definições registadas, com uma comparação opcional. Decide o que partilha.",
    newExtras: "Mais dois motivos para escolher Lifetime",
    openTools: "Abrir ferramentas Lifetime",
    notBenchmark:
      "Estas ferramentas documentam definições. Não medem nem prometem ganhos de desempenho.",
    campaign: "A oferta Lifetime atual termina em",
    mayChange:
      "Os preços e a disponibilidade podem mudar após este prazo. O acesso Lifetime adquirido mantém-se.",
    ends: "Fim da oferta",
    hours: "horas",
    minutes: "minutos",
    seconds: "segundos",
    preview: "Pré-visualização da campanha · inativa",
    unavailable:
      "Não foi possível verificar a disponibilidade de Lifetime. Atualize antes de comprar.",
    retry: "Verificar novamente",
    expired: "Esta oferta Lifetime terminou.",
    scheduled: "A próxima oferta Lifetime ainda não começou.",
    checking: "A verificar a disponibilidade de Lifetime…",
    checkout:
      "O preço final, os impostos e as condições de pagamento são apresentados no checkout.",
    terms: "Condições claras antes de escolher",
    twoYears: "Ao preço anual atual, dois anos de Pro custam {price}.",
    current: "Plano atual",
    afterCancel:
      "Os restauros suportados continuam disponíveis após o fim de Pro. A limpeza e a reparação têm limites próprios.",
    previewCheckout: "O checkout está desativado nesta pré-visualização da campanha.",
  },
};
