import type { Lang } from "../i18n";

/** Invitation panel, account menu entry and referral error wording. German
 *  follows the "Sie" of the billing copy (trial-copy.ts). The inviter never
 *  sees a friend's plan, payment date or payment status, so no string here
 *  may name one. */
type ReferralCopy = {
  eyebrow: string;
  close: string;
  title: string;
  intro: string;
  loading: string;
  loadFailed: string;
  closedTitle: string;
  closedBody: string;
  tabsLabel: string;
  tabInvite: string;
  tabBonuses: string;
  tabRedeem: string;
  perkMonthly: string;
  perkAnnual: string;
  perkLifetime: string;
  perkMonths: string;
  perkScope: string;
  codeTitle: string;
  copyCode: string;
  copyLink: string;
  codeCopied: string;
  linkCopied: string;
  copyFailed: string;
  codeHelp: string;
  generate: string;
  codeReady: string;
  lifetimeInviter: string;
  bonusesTitle: string;
  bonusesBody: string;
  bonusesLimits: string;
  emptyTitle: string;
  emptyBody: string;
  rewardTitle: string;
  rewardMonths: string;
  statusPending: string;
  statusReady: string;
  statusActive: string;
  statusNotEligible: string;
  pendingHelp: string;
  activate: string;
  confirmLabel: string;
  confirmTitle: string;
  confirmBody: string;
  confirmActivate: string;
  keepForLater: string;
  activated: string;
  claimTitle: string;
  expiredTitle: string;
  expiredBody: string;
  confirmedOpen: string;
  confirmedLocked: string;
  claimWarning: string;
  codeLabel: string;
  claimButton: string;
  codeInvalid: string;
  claimed: string;
  rulesTitle: string;
  rulesDiscount: string;
  rulesBonus: string;
  rulesVerification: string;
  rulesDevice: string;
  menuInvite: string;
  bonusActive: string;
  errors: {
    verifyEmail: string;
    unavailable: string;
    notEligible: string;
    alreadyBound: string;
    invalidCode: string;
    bonusUnavailable: string;
    bonusExpired: string;
    clockAhead: string;
    clockBehind: string;
    sessionChanged: string;
    signInAgain: string;
    rateLimited: string;
    notVerified: string;
    generic: string;
  };
};

export const REFERRAL_COPY: Record<Lang, ReferralCopy> = {
  en: {
    eyebrow: "PC TWEAKER · INVITATIONS",
    close: "Close invitations",
    title: "Invite a friend.",
    intro: "Your friend saves an extra 10%. You earn Pro time once their purchase is verified.",
    loading: "Loading your invitations…",
    loadFailed: "Invitations are unavailable. Verify your email and try again later.",
    closedTitle: "Invitations are not open yet.",
    closedBody: "Your current plan is unchanged. The programme will appear here when it is ready.",
    tabsLabel: "Invitation options",
    tabInvite: "Your code",
    tabBonuses: "Bonuses",
    tabRedeem: "Use a code",
    perkMonthly: "MONTHLY PURCHASE",
    perkAnnual: "ANNUAL PURCHASE",
    perkLifetime: "LIFETIME PURCHASE",
    perkMonths: "{months} months",
    perkScope: "Pro for one PC",
    codeTitle: "Your invitation code",
    copyCode: "Copy code",
    copyLink: "Copy invitation link",
    codeCopied: "Invitation code copied.",
    linkCopied: "Invitation link copied.",
    copyFailed: "Could not copy. Select the code and copy it manually.",
    codeHelp: "Your friend enters this code in the app before paying.",
    generate: "Generate my code",
    codeReady: "Your invitation code is ready.",
    lifetimeInviter:
      "You own Lifetime: your friends still save 10%, but Lifetime accounts do not earn bonuses.",
    bonusesTitle: "Your Pro bonuses",
    bonusesBody:
      "Each bonus covers one PC. Activating it starts its duration; it never creates a paid subscription.",
    bonusesLimits:
      "Up to {cap} bonuses every 12 months. Bonuses are personal: they cannot be transferred, sold or given away.",
    emptyTitle: "No bonuses yet.",
    emptyBody: "When a friend completes an eligible purchase, its status appears here.",
    rewardTitle: "Invitation bonus",
    rewardMonths: "{months} months of Pro",
    statusPending: "Being verified · up to {days} days after the purchase",
    statusReady: "Ready to activate on one PC",
    statusActive: "Active on one PC until {date}",
    statusNotEligible: "Not eligible",
    pendingHelp:
      "A bonus becomes available once the purchase can no longer be disputed. If it is still being verified after that, write to {email}.",
    activate: "Activate on this PC",
    confirmLabel: "Confirm bonus activation",
    confirmTitle: "Start your {months}-month bonus on this PC?",
    confirmBody:
      "The timer starts now. The bonus stays on this PC and cannot be moved automatically. If you already pay for Pro, both periods run at the same time, so you may prefer to keep it for later.",
    confirmActivate: "Confirm activation",
    keepForLater: "Keep it for later",
    activated: "Bonus activated on this PC.",
    claimTitle: "Have an invitation?",
    expiredTitle: "This invitation has expired.",
    expiredBody:
      "You can still buy PC Tweaker at the regular price. If a payment page is already open, check its price and expiry before paying.",
    confirmedOpen:
      "Your invitation is confirmed for your first paid purchase. Check the discount on the payment page before paying.",
    confirmedLocked:
      "Your invitation is confirmed and linked to the payment page you opened. Check the discount before paying.",
    claimWarning:
      "Before you confirm: the invitation stays linked to this account, expires {days} days after confirmation, applies to your first paid purchase only and cannot be combined with the free trial.",
    codeLabel: "Invitation code",
    claimButton: "Confirm invitation",
    codeInvalid: "Enter the 10-character invitation code.",
    claimed: "Invitation confirmed. Check the final price before paying.",
    rulesTitle: "Programme rules",
    rulesDiscount:
      "The extra 10% applies once, to your first eligible paid purchase, after any supported offer. Renewals follow the normal plan terms. The free trial cannot be combined with an invitation.",
    rulesBonus:
      "A monthly purchase earns the inviter 6 months of Pro; an annual or Lifetime purchase earns 12. Each bonus is for one PC, personal and not transferable. Up to {cap} bonuses every 12 months. Lifetime owners can invite friends but do not earn bonuses.",
    rulesVerification:
      "A bonus becomes available {days} days after the friend's payment, once it can no longer be disputed. Refunds, disputes, repeated payment details and self-invitations make a purchase ineligible. The inviter never sees the friend's plan, payment date or payment status.",
    rulesDevice:
      "An active bonus is checked online about every 10 minutes while the app is open. Downloads alone do not qualify. A Microsoft Store download does not carry the invitation: confirm the code here before buying.",
    menuInvite: "Invite a friend",
    bonusActive: "Pro bonus · active on this PC. Separate from your paid plans.",
    errors: {
      verifyEmail: "Verify your email before using invitations.",
      unavailable: "The invitation programme is not available yet.",
      notEligible: "This invitation is not eligible for this account.",
      alreadyBound: "This account already has a different invitation.",
      invalidCode: "Check the invitation code and try again.",
      bonusUnavailable: "This bonus is not available on this PC.",
      bonusExpired: "This bonus has ended.",
      clockAhead:
        "Your PC clock is {minutes} minutes ahead. Turn on “Set time automatically” in Windows Settings, then try again. The bonus has not been started.",
      clockBehind:
        "Your PC clock is more than a day behind. Turn on “Set time automatically” in Windows Settings, then try again. The bonus has not been started.",
      sessionChanged:
        "Your sign-in changed during activation. Open this panel again to check the bonus.",
      signInAgain: "Please sign in again.",
      rateLimited: "Please wait a few minutes before trying again.",
      notVerified: "The bonus could not be verified on this PC. Try again in a few minutes.",
      generic: "The request could not be completed. Your paid plan is unchanged.",
    },
  },
  it: {
    eyebrow: "PC TWEAKER · INVITI",
    close: "Chiudi gli inviti",
    title: "Invita un amico.",
    intro:
      "Il tuo amico risparmia un ulteriore 10%. Tu ottieni tempo Pro quando il suo acquisto è verificato.",
    loading: "Caricamento degli inviti…",
    loadFailed: "Gli inviti non sono disponibili. Verifica la tua email e riprova più tardi.",
    closedTitle: "Gli inviti non sono ancora aperti.",
    closedBody: "Il tuo piano attuale non cambia. Il programma comparirà qui quando sarà pronto.",
    tabsLabel: "Opzioni degli inviti",
    tabInvite: "Il tuo codice",
    tabBonuses: "Bonus",
    tabRedeem: "Usa un codice",
    perkMonthly: "ACQUISTO MENSILE",
    perkAnnual: "ACQUISTO ANNUALE",
    perkLifetime: "ACQUISTO A VITA",
    perkMonths: "{months} mesi",
    perkScope: "Pro per un PC",
    codeTitle: "Il tuo codice invito",
    copyCode: "Copia codice",
    copyLink: "Copia link di invito",
    codeCopied: "Codice invito copiato.",
    linkCopied: "Link di invito copiato.",
    copyFailed: "Copia non riuscita. Seleziona il codice e copialo manualmente.",
    codeHelp: "Il tuo amico inserisce questo codice nell'app prima di pagare.",
    generate: "Genera il mio codice",
    codeReady: "Il tuo codice invito è pronto.",
    lifetimeInviter:
      "Hai il piano A vita: i tuoi amici risparmiano comunque il 10%, ma gli account a vita non ricevono bonus.",
    bonusesTitle: "I tuoi bonus Pro",
    bonusesBody:
      "Ogni bonus vale per un PC. L'attivazione avvia la sua durata e non crea mai un abbonamento a pagamento.",
    bonusesLimits:
      "Fino a {cap} bonus ogni 12 mesi. I bonus sono personali: non si possono trasferire, vendere o regalare.",
    emptyTitle: "Nessun bonus per ora.",
    emptyBody: "Quando un amico completa un acquisto idoneo, lo stato compare qui.",
    rewardTitle: "Bonus invito",
    rewardMonths: "{months} mesi di Pro",
    statusPending: "In verifica · fino a {days} giorni dopo l'acquisto",
    statusReady: "Pronto da attivare su un PC",
    statusActive: "Attivo su un PC fino al {date}",
    statusNotEligible: "Non idoneo",
    pendingHelp:
      "Un bonus diventa disponibile quando l'acquisto non può più essere contestato. Se dopo quel periodo è ancora in verifica, scrivi a {email}.",
    activate: "Attiva su questo PC",
    confirmLabel: "Conferma l'attivazione del bonus",
    confirmTitle: "Avviare il bonus di {months} mesi su questo PC?",
    confirmBody:
      "Il periodo inizia ora. Il bonus resta su questo PC e non può essere spostato automaticamente. Se paghi già Pro, i due periodi scorrono insieme: potresti preferire tenerlo per dopo.",
    confirmActivate: "Conferma attivazione",
    keepForLater: "Tienilo per dopo",
    activated: "Bonus attivato su questo PC.",
    claimTitle: "Hai un invito?",
    expiredTitle: "Questo invito è scaduto.",
    expiredBody:
      "Puoi comunque acquistare PC Tweaker al prezzo normale. Se hai già aperto una pagina di pagamento, controllane prezzo e scadenza prima di pagare.",
    confirmedOpen:
      "Il tuo invito è confermato per il primo acquisto a pagamento. Controlla lo sconto nella pagina di pagamento prima di pagare.",
    confirmedLocked:
      "Il tuo invito è confermato e collegato alla pagina di pagamento che hai aperto. Controlla lo sconto prima di pagare.",
    claimWarning:
      "Prima di confermare: l'invito resta legato a questo account, scade {days} giorni dopo la conferma, vale solo per il primo acquisto a pagamento e non si combina con la prova gratuita.",
    codeLabel: "Codice invito",
    claimButton: "Conferma invito",
    codeInvalid: "Inserisci il codice invito di 10 caratteri.",
    claimed: "Invito confermato. Controlla il prezzo finale prima di pagare.",
    rulesTitle: "Regole del programma",
    rulesDiscount:
      "Il 10% in più si applica una sola volta, al primo acquisto a pagamento idoneo, dopo eventuali offerte compatibili. I rinnovi seguono le condizioni normali del piano. La prova gratuita non si combina con un invito.",
    rulesBonus:
      "Un acquisto mensile fa ottenere a chi invita 6 mesi di Pro; un acquisto annuale o a vita 12. Ogni bonus vale per un PC, è personale e non trasferibile. Fino a {cap} bonus ogni 12 mesi. Chi ha il piano A vita può invitare amici ma non riceve bonus.",
    rulesVerification:
      "Un bonus diventa disponibile {days} giorni dopo il pagamento dell'amico, quando non può più essere contestato. Rimborsi, contestazioni, dati di pagamento ripetuti e autoinviti rendono l'acquisto non idoneo. Chi invita non vede mai il piano, la data o lo stato del pagamento dell'amico.",
    rulesDevice:
      "Un bonus attivo viene verificato online circa ogni 10 minuti mentre l'app è aperta. Il solo download non conta. Un download dal Microsoft Store non trasferisce l'invito: conferma il codice qui prima di acquistare.",
    menuInvite: "Invita un amico",
    bonusActive: "Bonus Pro · attivo su questo PC. Separato dai tuoi piani a pagamento.",
    errors: {
      verifyEmail: "Verifica la tua email prima di usare gli inviti.",
      unavailable: "Il programma inviti non è ancora disponibile.",
      notEligible: "Questo invito non è valido per questo account.",
      alreadyBound: "Questo account ha già un invito diverso.",
      invalidCode: "Controlla il codice invito e riprova.",
      bonusUnavailable: "Questo bonus non è disponibile su questo PC.",
      bonusExpired: "Questo bonus è terminato.",
      clockAhead:
        "L'orologio del PC è avanti di {minutes} minuti. Attiva «Imposta automaticamente l'ora» nelle Impostazioni di Windows e riprova. Il bonus non è stato avviato.",
      clockBehind:
        "L'orologio del PC è indietro di più di un giorno. Attiva «Imposta automaticamente l'ora» nelle Impostazioni di Windows e riprova. Il bonus non è stato avviato.",
      sessionChanged:
        "L'accesso è cambiato durante l'attivazione. Riapri questo pannello per controllare il bonus.",
      signInAgain: "Accedi di nuovo.",
      rateLimited: "Attendi qualche minuto prima di riprovare.",
      notVerified:
        "Non è stato possibile verificare il bonus su questo PC. Riprova tra qualche minuto.",
      generic:
        "Non è stato possibile completare la richiesta. Il tuo piano a pagamento non cambia.",
    },
  },
  fr: {
    eyebrow: "PC TWEAKER · PARRAINAGE",
    close: "Fermer le parrainage",
    title: "Invitez un ami.",
    intro: "Votre ami économise 10 % de plus. Vous gagnez du temps Pro une fois son achat vérifié.",
    loading: "Chargement de vos invitations…",
    loadFailed: "Les invitations sont indisponibles. Vérifiez votre e-mail et réessayez plus tard.",
    closedTitle: "Les invitations ne sont pas encore ouvertes.",
    closedBody:
      "Votre forfait actuel ne change pas. Le programme apparaîtra ici dès qu'il sera prêt.",
    tabsLabel: "Options d'invitation",
    tabInvite: "Votre code",
    tabBonuses: "Bonus",
    tabRedeem: "Utiliser un code",
    perkMonthly: "ACHAT MENSUEL",
    perkAnnual: "ACHAT ANNUEL",
    perkLifetime: "ACHAT À VIE",
    perkMonths: "{months} mois",
    perkScope: "Pro pour un PC",
    codeTitle: "Votre code d'invitation",
    copyCode: "Copier le code",
    copyLink: "Copier le lien d'invitation",
    codeCopied: "Code d'invitation copié.",
    linkCopied: "Lien d'invitation copié.",
    copyFailed: "Copie impossible. Sélectionnez le code et copiez-le manuellement.",
    codeHelp: "Votre ami saisit ce code dans l'application avant de payer.",
    generate: "Générer mon code",
    codeReady: "Votre code d'invitation est prêt.",
    lifetimeInviter:
      "Vous avez le forfait À vie : vos amis économisent quand même 10 %, mais les comptes À vie ne gagnent pas de bonus.",
    bonusesTitle: "Vos bonus Pro",
    bonusesBody:
      "Chaque bonus vaut pour un PC. Son activation lance sa durée ; elle ne crée jamais d'abonnement payant.",
    bonusesLimits:
      "Jusqu'à {cap} bonus tous les 12 mois. Les bonus sont personnels : ils ne peuvent être ni transférés, ni vendus, ni offerts.",
    emptyTitle: "Aucun bonus pour l'instant.",
    emptyBody: "Quand un ami finalise un achat éligible, son statut apparaît ici.",
    rewardTitle: "Bonus de parrainage",
    rewardMonths: "{months} mois de Pro",
    statusPending: "En vérification · jusqu'à {days} jours après l'achat",
    statusReady: "Prêt à activer sur un PC",
    statusActive: "Actif sur un PC jusqu'au {date}",
    statusNotEligible: "Non éligible",
    pendingHelp:
      "Un bonus devient disponible lorsque l'achat ne peut plus être contesté. S'il est encore en vérification après ce délai, écrivez à {email}.",
    activate: "Activer sur ce PC",
    confirmLabel: "Confirmer l'activation du bonus",
    confirmTitle: "Lancer votre bonus de {months} mois sur ce PC ?",
    confirmBody:
      "La période commence maintenant. Le bonus reste sur ce PC et ne peut pas être déplacé automatiquement. Si vous payez déjà Pro, les deux périodes courent en même temps : vous préférerez peut-être le garder pour plus tard.",
    confirmActivate: "Confirmer l'activation",
    keepForLater: "Le garder pour plus tard",
    activated: "Bonus activé sur ce PC.",
    claimTitle: "Vous avez une invitation ?",
    expiredTitle: "Cette invitation a expiré.",
    expiredBody:
      "Vous pouvez toujours acheter PC Tweaker au prix normal. Si une page de paiement est déjà ouverte, vérifiez son prix et son expiration avant de payer.",
    confirmedOpen:
      "Votre invitation est confirmée pour votre premier achat payant. Vérifiez la réduction sur la page de paiement avant de payer.",
    confirmedLocked:
      "Votre invitation est confirmée et liée à la page de paiement que vous avez ouverte. Vérifiez la réduction avant de payer.",
    claimWarning:
      "Avant de confirmer : l'invitation reste liée à ce compte, expire {days} jours après la confirmation, ne s'applique qu'à votre premier achat payant et ne se cumule pas avec l'essai gratuit.",
    codeLabel: "Code d'invitation",
    claimButton: "Confirmer l'invitation",
    codeInvalid: "Saisissez le code d'invitation à 10 caractères.",
    claimed: "Invitation confirmée. Vérifiez le prix final avant de payer.",
    rulesTitle: "Règles du programme",
    rulesDiscount:
      "Les 10 % supplémentaires s'appliquent une seule fois, à votre premier achat payant éligible, après toute offre compatible. Les renouvellements suivent les conditions normales du forfait. L'essai gratuit ne se cumule pas avec une invitation.",
    rulesBonus:
      "Un achat mensuel rapporte 6 mois de Pro au parrain ; un achat annuel ou À vie en rapporte 12. Chaque bonus vaut pour un PC, est personnel et non transférable. Jusqu'à {cap} bonus tous les 12 mois. Les titulaires du forfait À vie peuvent inviter des amis mais ne gagnent pas de bonus.",
    rulesVerification:
      "Un bonus devient disponible {days} jours après le paiement de l'ami, lorsqu'il ne peut plus être contesté. Les remboursements, contestations, coordonnées de paiement répétées et auto-parrainages rendent l'achat non éligible. Le parrain ne voit jamais le forfait, la date ni le statut du paiement de l'ami.",
    rulesDevice:
      "Un bonus actif est vérifié en ligne environ toutes les 10 minutes lorsque l'application est ouverte. Un simple téléchargement ne compte pas. Un téléchargement depuis le Microsoft Store ne transmet pas l'invitation : confirmez le code ici avant d'acheter.",
    menuInvite: "Inviter un ami",
    bonusActive: "Bonus Pro · actif sur ce PC. Distinct de vos forfaits payants.",
    errors: {
      verifyEmail: "Vérifiez votre e-mail avant d'utiliser les invitations.",
      unavailable: "Le programme de parrainage n'est pas encore disponible.",
      notEligible: "Cette invitation n'est pas valable pour ce compte.",
      alreadyBound: "Ce compte a déjà une autre invitation.",
      invalidCode: "Vérifiez le code d'invitation et réessayez.",
      bonusUnavailable: "Ce bonus n'est pas disponible sur ce PC.",
      bonusExpired: "Ce bonus est terminé.",
      clockAhead:
        "L'horloge de votre PC avance de {minutes} minutes. Activez « Régler l'heure automatiquement » dans les Paramètres Windows, puis réessayez. Le bonus n'a pas été lancé.",
      clockBehind:
        "L'horloge de votre PC retarde de plus d'un jour. Activez « Régler l'heure automatiquement » dans les Paramètres Windows, puis réessayez. Le bonus n'a pas été lancé.",
      sessionChanged:
        "Votre connexion a changé pendant l'activation. Rouvrez ce panneau pour vérifier le bonus.",
      signInAgain: "Veuillez vous reconnecter.",
      rateLimited: "Veuillez patienter quelques minutes avant de réessayer.",
      notVerified: "Le bonus n'a pas pu être vérifié sur ce PC. Réessayez dans quelques minutes.",
      generic: "La demande n'a pas pu aboutir. Votre forfait payant ne change pas.",
    },
  },
  es: {
    eyebrow: "PC TWEAKER · INVITACIONES",
    close: "Cerrar invitaciones",
    title: "Invita a un amigo.",
    intro: "Tu amigo ahorra un 10 % adicional. Tú ganas tiempo Pro cuando se verifica su compra.",
    loading: "Cargando tus invitaciones…",
    loadFailed:
      "Las invitaciones no están disponibles. Verifica tu correo y vuelve a intentarlo más tarde.",
    closedTitle: "Las invitaciones aún no están abiertas.",
    closedBody: "Tu plan actual no cambia. El programa aparecerá aquí cuando esté listo.",
    tabsLabel: "Opciones de invitación",
    tabInvite: "Tu código",
    tabBonuses: "Bonos",
    tabRedeem: "Usar un código",
    perkMonthly: "COMPRA MENSUAL",
    perkAnnual: "COMPRA ANUAL",
    perkLifetime: "COMPRA DE POR VIDA",
    perkMonths: "{months} meses",
    perkScope: "Pro para un PC",
    codeTitle: "Tu código de invitación",
    copyCode: "Copiar código",
    copyLink: "Copiar enlace de invitación",
    codeCopied: "Código de invitación copiado.",
    linkCopied: "Enlace de invitación copiado.",
    copyFailed: "No se pudo copiar. Selecciona el código y cópialo manualmente.",
    codeHelp: "Tu amigo introduce este código en la aplicación antes de pagar.",
    generate: "Generar mi código",
    codeReady: "Tu código de invitación está listo.",
    lifetimeInviter:
      "Tienes el plan De por vida: tus amigos siguen ahorrando un 10 %, pero las cuentas De por vida no ganan bonos.",
    bonusesTitle: "Tus bonos Pro",
    bonusesBody:
      "Cada bono es para un PC. Al activarlo empieza su duración; nunca crea una suscripción de pago.",
    bonusesLimits:
      "Hasta {cap} bonos cada 12 meses. Los bonos son personales: no se pueden transferir, vender ni regalar.",
    emptyTitle: "Todavía no hay bonos.",
    emptyBody: "Cuando un amigo complete una compra válida, su estado aparecerá aquí.",
    rewardTitle: "Bono de invitación",
    rewardMonths: "{months} meses de Pro",
    statusPending: "En verificación · hasta {days} días después de la compra",
    statusReady: "Listo para activar en un PC",
    statusActive: "Activo en un PC hasta el {date}",
    statusNotEligible: "No elegible",
    pendingHelp:
      "Un bono está disponible cuando ya no se puede abrir una disputa sobre la compra. Si sigue en verificación después de ese plazo, escribe a {email}.",
    activate: "Activar en este PC",
    confirmLabel: "Confirmar la activación del bono",
    confirmTitle: "¿Iniciar tu bono de {months} meses en este PC?",
    confirmBody:
      "El periodo empieza ahora. El bono se queda en este PC y no puede trasladarse automáticamente. Si ya pagas Pro, ambos periodos transcurren a la vez, así que quizá prefieras guardarlo para más adelante.",
    confirmActivate: "Confirmar activación",
    keepForLater: "Guardarlo para más adelante",
    activated: "Bono activado en este PC.",
    claimTitle: "¿Tienes una invitación?",
    expiredTitle: "Esta invitación ha caducado.",
    expiredBody:
      "Puedes seguir comprando PC Tweaker al precio normal. Si ya tienes abierta una página de pago, comprueba su precio y su caducidad antes de pagar.",
    confirmedOpen:
      "Tu invitación está confirmada para tu primera compra de pago. Comprueba el descuento en la página de pago antes de pagar.",
    confirmedLocked:
      "Tu invitación está confirmada y vinculada a la página de pago que abriste. Comprueba el descuento antes de pagar.",
    claimWarning:
      "Antes de confirmar: la invitación queda vinculada a esta cuenta, caduca {days} días después de la confirmación, solo vale para tu primera compra de pago y no se combina con la prueba gratuita.",
    codeLabel: "Código de invitación",
    claimButton: "Confirmar invitación",
    codeInvalid: "Introduce el código de invitación de 10 caracteres.",
    claimed: "Invitación confirmada. Comprueba el precio final antes de pagar.",
    rulesTitle: "Reglas del programa",
    rulesDiscount:
      "El 10 % adicional se aplica una sola vez, a tu primera compra de pago válida, después de cualquier oferta compatible. Las renovaciones siguen las condiciones normales del plan. La prueba gratuita no se combina con una invitación.",
    rulesBonus:
      "Una compra mensual da a quien invita 6 meses de Pro; una compra anual o De por vida, 12. Cada bono es para un PC, personal e intransferible. Hasta {cap} bonos cada 12 meses. Los titulares del plan De por vida pueden invitar a amigos, pero no ganan bonos.",
    rulesVerification:
      "Un bono está disponible {days} días después del pago del amigo, cuando ya no se puede abrir una disputa. Los reembolsos, disputas, datos de pago repetidos y autoinvitaciones hacen que la compra no sea válida. Quien invita nunca ve el plan, la fecha ni el estado del pago de su amigo.",
    rulesDevice:
      "Un bono activo se comprueba en línea aproximadamente cada 10 minutos mientras la aplicación está abierta. La descarga por sí sola no cuenta. Una descarga desde Microsoft Store no transfiere la invitación: confirma el código aquí antes de comprar.",
    menuInvite: "Invitar a un amigo",
    bonusActive: "Bono Pro · activo en este PC. Independiente de tus planes de pago.",
    errors: {
      verifyEmail: "Verifica tu correo antes de usar las invitaciones.",
      unavailable: "El programa de invitaciones aún no está disponible.",
      notEligible: "Esta invitación no es válida para esta cuenta.",
      alreadyBound: "Esta cuenta ya tiene otra invitación.",
      invalidCode: "Comprueba el código de invitación y vuelve a intentarlo.",
      bonusUnavailable: "Este bono no está disponible en este PC.",
      bonusExpired: "Este bono ha terminado.",
      clockAhead:
        "El reloj de tu PC va {minutes} minutos adelantado. Activa «Establecer la hora automáticamente» en Configuración de Windows y vuelve a intentarlo. El bono no se ha iniciado.",
      clockBehind:
        "El reloj de tu PC va más de un día atrasado. Activa «Establecer la hora automáticamente» en Configuración de Windows y vuelve a intentarlo. El bono no se ha iniciado.",
      sessionChanged:
        "Tu sesión cambió durante la activación. Vuelve a abrir este panel para comprobar el bono.",
      signInAgain: "Vuelve a iniciar sesión.",
      rateLimited: "Espera unos minutos antes de volver a intentarlo.",
      notVerified: "No se pudo verificar el bono en este PC. Vuelve a intentarlo en unos minutos.",
      generic: "No se pudo completar la solicitud. Tu plan de pago no cambia.",
    },
  },
  de: {
    eyebrow: "PC TWEAKER · EINLADUNGEN",
    close: "Einladungen schließen",
    title: "Laden Sie einen Freund ein.",
    intro:
      "Ihr Freund spart zusätzlich 10 %. Sie erhalten Pro-Zeit, sobald sein Kauf bestätigt ist.",
    loading: "Einladungen werden geladen…",
    loadFailed:
      "Einladungen sind nicht verfügbar. Bestätigen Sie Ihre E-Mail-Adresse und versuchen Sie es später erneut.",
    closedTitle: "Einladungen sind noch nicht geöffnet.",
    closedBody:
      "Ihr aktueller Tarif bleibt unverändert. Das Programm erscheint hier, sobald es bereit ist.",
    tabsLabel: "Einladungsoptionen",
    tabInvite: "Ihr Code",
    tabBonuses: "Boni",
    tabRedeem: "Code einlösen",
    perkMonthly: "MONATLICHER KAUF",
    perkAnnual: "JÄHRLICHER KAUF",
    perkLifetime: "KAUF LEBENSLANG",
    perkMonths: "{months} Monate",
    perkScope: "Pro für einen PC",
    codeTitle: "Ihr Einladungscode",
    copyCode: "Code kopieren",
    copyLink: "Einladungslink kopieren",
    codeCopied: "Einladungscode kopiert.",
    linkCopied: "Einladungslink kopiert.",
    copyFailed: "Kopieren nicht möglich. Markieren Sie den Code und kopieren Sie ihn manuell.",
    codeHelp: "Ihr Freund gibt diesen Code vor dem Bezahlen in der App ein.",
    generate: "Meinen Code erstellen",
    codeReady: "Ihr Einladungscode ist bereit.",
    lifetimeInviter:
      "Sie haben den Tarif Lebenslang: Ihre Freunde sparen trotzdem 10 %, aber Lebenslang-Konten erhalten keine Boni.",
    bonusesTitle: "Ihre Pro-Boni",
    bonusesBody:
      "Jeder Bonus gilt für einen PC. Mit der Aktivierung beginnt seine Laufzeit; es entsteht nie ein kostenpflichtiges Abonnement.",
    bonusesLimits:
      "Bis zu {cap} Boni alle 12 Monate. Boni sind persönlich und können nicht übertragen, verkauft oder verschenkt werden.",
    emptyTitle: "Noch keine Boni.",
    emptyBody: "Wenn ein Freund einen berechtigten Kauf abschließt, erscheint sein Status hier.",
    rewardTitle: "Einladungsbonus",
    rewardMonths: "{months} Monate Pro",
    statusPending: "Wird geprüft · bis zu {days} Tage nach dem Kauf",
    statusReady: "Bereit zur Aktivierung auf einem PC",
    statusActive: "Aktiv auf einem PC bis {date}",
    statusNotEligible: "Nicht berechtigt",
    pendingHelp:
      "Ein Bonus wird verfügbar, sobald der Kauf nicht mehr angefochten werden kann. Ist er danach noch in Prüfung, schreiben Sie an {email}.",
    activate: "Auf diesem PC aktivieren",
    confirmLabel: "Bonusaktivierung bestätigen",
    confirmTitle: "Ihren {months}-Monats-Bonus auf diesem PC starten?",
    confirmBody:
      "Die Laufzeit beginnt jetzt. Der Bonus bleibt auf diesem PC und kann nicht automatisch übertragen werden. Wenn Sie bereits für Pro bezahlen, laufen beide Zeiträume gleichzeitig – vielleicht heben Sie ihn lieber für später auf.",
    confirmActivate: "Aktivierung bestätigen",
    keepForLater: "Für später aufheben",
    activated: "Bonus auf diesem PC aktiviert.",
    claimTitle: "Haben Sie eine Einladung?",
    expiredTitle: "Diese Einladung ist abgelaufen.",
    expiredBody:
      "Sie können PC Tweaker weiterhin zum regulären Preis kaufen. Wenn bereits eine Zahlungsseite geöffnet ist, prüfen Sie vor dem Bezahlen Preis und Ablaufzeit.",
    confirmedOpen:
      "Ihre Einladung ist für Ihren ersten bezahlten Kauf bestätigt. Prüfen Sie den Rabatt auf der Zahlungsseite, bevor Sie bezahlen.",
    confirmedLocked:
      "Ihre Einladung ist bestätigt und mit der geöffneten Zahlungsseite verknüpft. Prüfen Sie den Rabatt, bevor Sie bezahlen.",
    claimWarning:
      "Vor dem Bestätigen: Die Einladung bleibt mit diesem Konto verknüpft, läuft {days} Tage nach der Bestätigung ab, gilt nur für Ihren ersten bezahlten Kauf und ist nicht mit der kostenlosen Testphase kombinierbar.",
    codeLabel: "Einladungscode",
    claimButton: "Einladung bestätigen",
    codeInvalid: "Geben Sie den 10-stelligen Einladungscode ein.",
    claimed: "Einladung bestätigt. Prüfen Sie den Endpreis, bevor Sie bezahlen.",
    rulesTitle: "Programmregeln",
    rulesDiscount:
      "Die zusätzlichen 10 % gelten einmal, für Ihren ersten berechtigten bezahlten Kauf, nach einem eventuellen kompatiblen Angebot. Verlängerungen folgen den normalen Tarifbedingungen. Die kostenlose Testphase ist nicht mit einer Einladung kombinierbar.",
    rulesBonus:
      "Ein monatlicher Kauf bringt der einladenden Person 6 Monate Pro, ein jährlicher Kauf oder ein Kauf Lebenslang 12. Jeder Bonus gilt für einen PC, ist persönlich und nicht übertragbar. Bis zu {cap} Boni alle 12 Monate. Wer den Tarif Lebenslang besitzt, kann Freunde einladen, erhält aber keine Boni.",
    rulesVerification:
      "Ein Bonus wird {days} Tage nach der Zahlung des Freundes verfügbar, wenn sie nicht mehr angefochten werden kann. Rückerstattungen, Anfechtungen, wiederholte Zahlungsdaten und Selbsteinladungen machen einen Kauf nicht berechtigt. Die einladende Person sieht nie Tarif, Zahlungsdatum oder Zahlungsstatus des Freundes.",
    rulesDevice:
      "Ein aktiver Bonus wird online etwa alle 10 Minuten geprüft, solange die App geöffnet ist. Ein Download allein zählt nicht. Ein Download aus dem Microsoft Store überträgt die Einladung nicht: Bestätigen Sie den Code hier vor dem Kauf.",
    menuInvite: "Freund einladen",
    bonusActive: "Pro-Bonus · auf diesem PC aktiv. Getrennt von Ihren bezahlten Tarifen.",
    errors: {
      verifyEmail: "Bestätigen Sie Ihre E-Mail-Adresse, bevor Sie Einladungen nutzen.",
      unavailable: "Das Einladungsprogramm ist noch nicht verfügbar.",
      notEligible: "Diese Einladung gilt nicht für dieses Konto.",
      alreadyBound: "Dieses Konto hat bereits eine andere Einladung.",
      invalidCode: "Prüfen Sie den Einladungscode und versuchen Sie es erneut.",
      bonusUnavailable: "Dieser Bonus ist auf diesem PC nicht verfügbar.",
      bonusExpired: "Dieser Bonus ist abgelaufen.",
      clockAhead:
        "Die Uhr Ihres PCs geht {minutes} Minuten vor. Aktivieren Sie „Uhrzeit automatisch festlegen“ in den Windows-Einstellungen und versuchen Sie es erneut. Der Bonus wurde nicht gestartet.",
      clockBehind:
        "Die Uhr Ihres PCs geht mehr als einen Tag nach. Aktivieren Sie „Uhrzeit automatisch festlegen“ in den Windows-Einstellungen und versuchen Sie es erneut. Der Bonus wurde nicht gestartet.",
      sessionChanged:
        "Ihre Anmeldung hat sich während der Aktivierung geändert. Öffnen Sie dieses Fenster erneut, um den Bonus zu prüfen.",
      signInAgain: "Bitte melden Sie sich erneut an.",
      rateLimited: "Bitte warten Sie einige Minuten, bevor Sie es erneut versuchen.",
      notVerified:
        "Der Bonus konnte auf diesem PC nicht geprüft werden. Versuchen Sie es in einigen Minuten erneut.",
      generic:
        "Die Anfrage konnte nicht abgeschlossen werden. Ihr bezahlter Tarif bleibt unverändert.",
    },
  },
  pt: {
    eyebrow: "PC TWEAKER · CONVITES",
    close: "Fechar convites",
    title: "Convide um amigo.",
    intro: "O seu amigo poupa mais 10%. Recebe tempo Pro quando a compra dele for verificada.",
    loading: "A carregar os seus convites…",
    loadFailed:
      "Os convites não estão disponíveis. Verifique o seu e-mail e tente novamente mais tarde.",
    closedTitle: "Os convites ainda não estão abertos.",
    closedBody: "O seu plano atual não muda. O programa aparecerá aqui quando estiver pronto.",
    tabsLabel: "Opções de convite",
    tabInvite: "O seu código",
    tabBonuses: "Bónus",
    tabRedeem: "Usar um código",
    perkMonthly: "COMPRA MENSAL",
    perkAnnual: "COMPRA ANUAL",
    perkLifetime: "COMPRA VITALÍCIA",
    perkMonths: "{months} meses",
    perkScope: "Pro para um PC",
    codeTitle: "O seu código de convite",
    copyCode: "Copiar código",
    copyLink: "Copiar ligação de convite",
    codeCopied: "Código de convite copiado.",
    linkCopied: "Ligação de convite copiada.",
    copyFailed: "Não foi possível copiar. Selecione o código e copie-o manualmente.",
    codeHelp: "O seu amigo introduz este código na aplicação antes de pagar.",
    generate: "Gerar o meu código",
    codeReady: "O seu código de convite está pronto.",
    lifetimeInviter:
      "Tem o plano Vitalício: os seus amigos continuam a poupar 10%, mas as contas vitalícias não recebem bónus.",
    bonusesTitle: "Os seus bónus Pro",
    bonusesBody:
      "Cada bónus é válido para um PC. A ativação inicia a sua duração e nunca cria uma subscrição paga.",
    bonusesLimits:
      "Até {cap} bónus a cada 12 meses. Os bónus são pessoais: não podem ser transferidos, vendidos nem oferecidos.",
    emptyTitle: "Ainda não tem bónus.",
    emptyBody: "Quando um amigo concluir uma compra elegível, o estado aparece aqui.",
    rewardTitle: "Bónus de convite",
    rewardMonths: "{months} meses de Pro",
    statusPending: "Em verificação · até {days} dias após a compra",
    statusReady: "Pronto a ativar num PC",
    statusActive: "Ativo num PC até {date}",
    statusNotEligible: "Não elegível",
    pendingHelp:
      "Um bónus fica disponível quando a compra já não pode ser contestada. Se continuar em verificação depois desse prazo, escreva para {email}.",
    activate: "Ativar neste PC",
    confirmLabel: "Confirmar a ativação do bónus",
    confirmTitle: "Iniciar o seu bónus de {months} meses neste PC?",
    confirmBody:
      "O período começa agora. O bónus fica neste PC e não pode ser transferido automaticamente. Se já paga o Pro, os dois períodos decorrem em simultâneo; talvez prefira guardá-lo para mais tarde.",
    confirmActivate: "Confirmar ativação",
    keepForLater: "Guardar para mais tarde",
    activated: "Bónus ativado neste PC.",
    claimTitle: "Tem um convite?",
    expiredTitle: "Este convite expirou.",
    expiredBody:
      "Pode continuar a comprar o PC Tweaker ao preço normal. Se já abriu uma página de pagamento, confirme o preço e o prazo antes de pagar.",
    confirmedOpen:
      "O seu convite está confirmado para a primeira compra paga. Confirme o desconto na página de pagamento antes de pagar.",
    confirmedLocked:
      "O seu convite está confirmado e associado à página de pagamento que abriu. Confirme o desconto antes de pagar.",
    claimWarning:
      "Antes de confirmar: o convite fica associado a esta conta, expira {days} dias após a confirmação, aplica-se apenas à primeira compra paga e não pode ser combinado com a avaliação gratuita.",
    codeLabel: "Código de convite",
    claimButton: "Confirmar convite",
    codeInvalid: "Introduza o código de convite de 10 caracteres.",
    claimed: "Convite confirmado. Confirme o preço final antes de pagar.",
    rulesTitle: "Regras do programa",
    rulesDiscount:
      "Os 10% adicionais aplicam-se uma única vez, à primeira compra paga elegível, depois de qualquer oferta compatível. As renovações seguem as condições normais do plano. A avaliação gratuita não pode ser combinada com um convite.",
    rulesBonus:
      "Uma compra mensal dá a quem convida 6 meses de Pro; uma compra anual ou vitalícia, 12. Cada bónus é válido para um PC, é pessoal e intransmissível. Até {cap} bónus a cada 12 meses. Os titulares do plano Vitalício podem convidar amigos, mas não recebem bónus.",
    rulesVerification:
      "Um bónus fica disponível {days} dias após o pagamento do amigo, quando já não pode ser contestado. Reembolsos, contestações, dados de pagamento repetidos e autoconvites tornam a compra não elegível. Quem convida nunca vê o plano, a data nem o estado do pagamento do amigo.",
    rulesDevice:
      "Um bónus ativo é verificado online cerca de cada 10 minutos enquanto a aplicação está aberta. A transferência por si só não conta. Uma transferência a partir da Microsoft Store não transmite o convite: confirme o código aqui antes de comprar.",
    menuInvite: "Convidar um amigo",
    bonusActive: "Bónus Pro · ativo neste PC. Separado dos seus planos pagos.",
    errors: {
      verifyEmail: "Verifique o seu e-mail antes de usar convites.",
      unavailable: "O programa de convites ainda não está disponível.",
      notEligible: "Este convite não é válido para esta conta.",
      alreadyBound: "Esta conta já tem um convite diferente.",
      invalidCode: "Verifique o código de convite e tente novamente.",
      bonusUnavailable: "Este bónus não está disponível neste PC.",
      bonusExpired: "Este bónus terminou.",
      clockAhead:
        "O relógio do PC está {minutes} minutos adiantado. Ative «Definir hora automaticamente» nas Definições do Windows e tente novamente. O bónus não foi iniciado.",
      clockBehind:
        "O relógio do PC está mais de um dia atrasado. Ative «Definir hora automaticamente» nas Definições do Windows e tente novamente. O bónus não foi iniciado.",
      sessionChanged:
        "A sua sessão mudou durante a ativação. Abra novamente este painel para verificar o bónus.",
      signInAgain: "Inicie sessão novamente.",
      rateLimited: "Aguarde alguns minutos antes de tentar novamente.",
      notVerified:
        "Não foi possível verificar o bónus neste PC. Tente novamente dentro de alguns minutos.",
      generic: "Não foi possível concluir o pedido. O seu plano pago não muda.",
    },
  },
};
