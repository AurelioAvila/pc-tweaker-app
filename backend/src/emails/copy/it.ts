import type { Copy } from "./index";

/** Italiano: del "tu", come le app. Etichette identiche a quelle dell'interfaccia. */
const named = (lead: string, n: string, end = ".") => (n ? `${lead}, ${n}${end}` : `${lead}${end}`);

export const it: Copy = {
  tag: "it",
  dateLocale: "it-IT",

  shell: {
    writeTo: (address: string) => `Scrivi a ${address} oppure rispondi a questa email.`,
    expectation: "Leggiamo tutto e di solito rispondiamo entro un giorno lavorativo.",
    neverSend: "Non inviare mai password o numeri di carta via email.",
    questions: "Domande?",
    family: "Un solo account per PC Tweaker, PC Tweaker Uninstaller e Tweaky Driver.",
    support: "Assistenza",
    privacy: "Privacy",
    terms: "Termini",
    linkFallback: "Se il pulsante non si apre, copia questo indirizzo nel browser:",
    ifYou: "Se sei stato tu:",
    ifNot: "Se non sei stato tu:",
    unsubscribe: "Annulla l'iscrizione",
  },

  plans: { monthly: "Pro, mensile", annual: "Pro, annuale", lifetime: "Pro, a vita" },

  verify: {
    subject: (b: string) => `Conferma la tua email per ${b}`,
    preheader: "Un clic conferma questo indirizzo. Il link vale 24 ore.",
    eyebrow: "Conferma la tua email",
    headline: (n: string) => named("Manca un passo", n),
    intro: (b: string) =>
      `Hai creato un account ${b} con questo indirizzo. Confermalo e l'account è attivo. È l'account a portare un piano Pro da un PC all'altro, ed è l'unico modo per inviarti in futuro il ripristino della password.`,
    button: "Conferma la mia email",
    stepsTitle: "Dopo la conferma",
    stepsHtml: (u: boolean) =>
      u
        ? [
            "Torna nell'Uninstaller e accedi dal pannello <strong>Account</strong>. L'app controlla l'account all'accesso, quindi non c'è nulla da aggiornare a mano.",
            "Nulla di ciò che hai rimosso cambia. Le disinstallazioni singole, la ricerca dei residui e il Registro rimozioni non hanno mai richiesto un account.",
            "Il pagamento di Uninstaller Pro si apre solo con l'indirizzo confermato. Un piano PC Tweaker sullo stesso account sblocca il prezzo fedeltà.",
          ]
        : [
            "Torna in PC Tweaker e accedi dal pulsante <strong>Account</strong>. L'app controlla l'account all'accesso, quindi non c'è nulla da aggiornare a mano.",
            "Nulla di ciò che hai già applicato cambia. Free non ha mai richiesto un account: i controlli Free, la Scansione e la Cronologia modifiche restano come li hai lasciati.",
            "Il pagamento di Pro si apre solo con l'indirizzo confermato. Una licenza Pro è firmata per l'account, non per il computer: per usarla su un altro PC basta accedere.",
          ],
    noteHtml: (b: string) =>
      `Il link vale 24 ore e una sola volta. Se è scaduto, apri il menu dell'account nell'app e scegli <strong>Invia di nuovo</strong>. Se non hai creato un account ${b}, ignora questa email: senza il clic non succede nulla.`,
    helpTitle: "Il link non arriva, o arriva due volte?",
    helpText: "Controlla prima la cartella spam, poi indicaci l'indirizzo con cui ti sei registrato.",
    why: (b: string) => `Ricevi questa email perché con questo indirizzo è stato creato un account ${b}.`,
  },

  welcome: {
    subject: (b: string) => `Il tuo account ${b} è pronto`,
    preheader: (u: boolean) =>
      u ? "Tre cose da provare per prime, e cosa aggiunge Pro." : "Tre controlli da provare per primi, e come si annulla ogni modifica.",
    eyebrow: "Account pronto",
    headline: (n: string) => named("Ci sei", n),
    intro: (u: boolean, free: number) =>
      u
        ? "Il tuo indirizzo è confermato e l'account è attivo. Accedi dal pannello Account dell'Uninstaller e tutto ciò che trovi qui sotto è tuo senza pagare nulla. Ecco da dove partire."
        : `Il tuo indirizzo è confermato e l'account è attivo. Accedi dal pulsante Account dell'app e i ${free} controlli Free, la Scansione, il Punteggio di salute e la Cronologia modifiche sono tuoi senza pagare nulla. Ecco da dove partire.`,
    stepsTitle: "Tre cose da provare per prime",
    stepsHtml: (u: boolean) =>
      u
        ? [
            "<strong>App installate.</strong> Ogni programma del PC, app del Microsoft Store comprese, con dimensione ed editore.",
            "<strong>Dettagli, poi Disinstalla.</strong> Ogni programma mostra un livello di affidabilità e un riepilogo della rimozione prima che parta qualsiasi cosa, e per i programmi installati per tutto il computer si tenta prima un punto di ripristino.",
            "<strong>La ricerca dei residui.</strong> Dopo una disinstallazione l'app cerca file e chiavi di registro lasciati dal programma, e il Registro rimozioni annota cosa è stato rimosso e lo spazio liberato.",
          ]
        : [
            "<strong>Scansione, poi Avvia scansione di sistema.</strong> Controlli su avvio, archiviazione, memoria, privacy, prestazioni e aggiornamenti. Le modifiche consigliate e quelle facoltative sono separate, e nulla viene applicato finché non approvi. Correggi tutto mostra prima le impostazioni esatte e poi le verifica una per una.",
            "<strong>Avvio.</strong> Le voci che partono con Windows, con l'editore accanto a ciascuna. Disattivarne due o tre che non usi mai è la modifica che i più notano al riavvio successivo, e ogni voce ha il suo ripristino.",
            "<strong>Profili.</strong> Gaming, Studio e Lavoro sono inclusi in Free. Aprine uno, leggi i compromessi su ogni scheda, togli la spunta a ciò che non vuoi e applica il resto con un clic. Un profilo aggiunge le sue impostazioni senza annullare le altre modifiche.",
          ],
    noteHtml: (u: boolean, guideLink: (label: string) => string) =>
      u
        ? "La pulizia dei residui, la rimozione in serie e la rimozione delle voci non valide fanno parte di Uninstaller Pro. Se lo stesso account ha un piano PC Tweaker, Pro costa meno: il prezzo è in Piani e prezzi."
        : `Prima di scrivere qualcosa, PC Tweaker salva il valore precedente, e ogni scheda di controllo ha <strong>Cosa modifica esattamente</strong>. Ripristina dal controllo stesso, oppure apri Cronologia modifiche e usa <strong>Ripristina i tweak attivi</strong>. La pulizia che finisce nel Cestino è recuperabile finché non lo svuoti; aggiornamenti dei driver, riparazioni e controlli hardware hanno i loro passaggi di recupero. Dettagli: ${guideLink("come annullare le modifiche di Windows")}.`,
    button: (b: string) => `Apri ${b}`,
    helpTitle: "Qualcosa non funziona come descritto?",
    helpText: "Indicaci la versione dell'app e cosa hai cliccato.",
    why: (b: string) => `Ricevi questa email perché hai confermato un account ${b} con questo indirizzo. Viene inviata una sola volta.`,
  },

  reset: {
    subject: (b: string) => `Reimposta la password di ${b}`,
    preheader: "Il link vale una volta sola, per un'ora. Finché non lo usi non cambia nulla.",
    eyebrow: "Reimpostazione password",
    headline: "Scegli una nuova password.",
    intro: (b: string) =>
      `Qualcuno ha chiesto di reimpostare la password dell'account ${b} collegato a questo indirizzo. Se sei stato tu, il pulsante qui sotto apre una pagina dove sceglierne una nuova. Per ora non è cambiato nulla.`,
    button: "Imposta una nuova password",
    rows: [
      ["Link valido per", "Un'ora, un solo uso"],
      ["Nuova password", "Almeno 8 caratteri, fino a 72 byte"],
      ["Vale per", "PC Tweaker, PC Tweaker Uninstaller e Tweaky Driver"],
      ["Dopo la modifica", "Ogni PC connesso viene disconnesso"],
    ],
    after:
      "Una volta salvata la nuova password, accedi di nuovo su ogni PC dove usi le app. Impostazioni applicate, cronologia ed eventuale piano Pro sono legati all'account e al computer, non alla password, quindi lì non cambia nulla.",
    note:
      "Non l'hai chiesto tu? Ignora l'email: il link vale un'ora e una sola volta, e la tua password resta esattamente com'è. Se queste richieste continuano ad arrivare, scrivici e controlleremo da dove partono.",
    helpTitle: "Link scaduto, o la pagina dice che non è valido?",
    helpTextHtml:
      "Chiedine uno nuovo da <strong>Password dimenticata?</strong> nella schermata di accesso e usa l'email più recente che ricevi.",
    why: (b: string) => `Ricevi questa email perché è stato chiesto di reimpostare la password dell'account ${b} collegato a questo indirizzo.`,
  },

  changed: {
    subject: (b: string) => `La password di ${b} è stata cambiata`,
    preheader: (when: string) => `Cambiata il ${when}. Gli altri PC connessi sono stati disconnessi. Se non sei stato tu, continua a leggere.`,
    eyebrow: "Avviso di sicurezza",
    headline: (n: string) => named("La tua password è stata cambiata", n),
    intro: (b: string, when: string) =>
      `La password del tuo account ${b} è stata cambiata il ${when}. Ogni dispositivo connesso è stato disconnesso, in PC Tweaker, PC Tweaker Uninstaller e Tweaky Driver.`,
    ifYou: "accedi di nuovo su ogni PC e hai finito. Impostazioni applicate, cronologia e piano restano intatti.",
    ifNot: "qualcun altro ha impostato quella password e la vecchia non funziona più. Fai queste tre cose, in quest'ordine.",
    stepsTitle: "Se non sei stato tu",
    stepsHtml: [
      "Apri l'app, scegli <strong>Password dimenticata?</strong> nella schermata di accesso e chiedi il ripristino su questo indirizzo. Il link che ricevi è solo tuo, e usarlo disconnette l'altra persona.",
      "Scegli una password che non usi da nessun'altra parte. Se questa casella di posta ha la stessa password di prima, cambia anche quella: è l'account da cui un attaccante sarebbe passato.",
      "Rispondi a questa email così controlliamo l'account anche dal nostro lato.",
    ],
    button: "Contatta l'assistenza",
    noteHtml:
      "Questa email non contiene link che modificano qualcosa né codici, di proposito: un pulsante di ripristino in un messaggio &quot;sei stato tu?&quot; è esattamente ciò che offrirebbe un'email falsa. Non ti chiederemo mai la password via email.",
    helpTitle: "Vuoi che controlliamo l'account?",
    helpText: "Le segnalazioni di sicurezza vengono lette per prime.",
    expectation: "Di solito ricevi risposta entro un giorno lavorativo.",
    why: (b: string) => `Questo avviso viene inviato ogni volta che cambia la password di un account ${b}. Non può essere disattivato.`,
  },

  emailChange: {
    subject: (b: string) => `Conferma il nuovo indirizzo email per ${b}`,
    preheader: "Un clic sposta il tuo account su questo indirizzo. Il link vale 24 ore.",
    eyebrow: "Conferma il nuovo indirizzo",
    headline: (n: string) => named("Conferma questo indirizzo", n),
    intro:
      "Hai chiesto di spostare su questo indirizzo l'account usato da PC Tweaker, PC Tweaker Uninstaller e Tweaky Driver. Confermalo e da ora accedi con questo indirizzo; quello precedente non funzionerà più per l'accesso.",
    button: "Conferma il nuovo indirizzo",
    note: "Il link vale 24 ore e una sola volta. Finché non confermi non cambia nulla. Dopo lo spostamento ogni PC connesso viene disconnesso.",
    helpTitle: "Non l'hai chiesto tu?",
    helpText: "Ignora questa email: l'account resta sull'indirizzo attuale.",
    why: "Ricevi questa email perché qualcuno ha effettuato l'accesso a un account PC Tweaker e ha chiesto di spostarlo su questo indirizzo.",
  },

  emailChanged: {
    subject: (b: string) => `L'email del tuo account ${b} è stata cambiata`,
    preheader: (masked: string) => `Ora l'account usa ${masked}. Se non sei stato tu, continua a leggere.`,
    eyebrow: "Avviso di sicurezza",
    headline: (n: string) => named("L'email del tuo account è stata cambiata", n),
    intro: (masked: string, when: string) =>
      `Il ${when} l'account usato da PC Tweaker, PC Tweaker Uninstaller e Tweaky Driver è passato da questo indirizzo a ${masked}. Ogni PC connesso è stato disconnesso; ora l'accesso usa il nuovo indirizzo.`,
    ifYou: "non devi fare altro. Piani, impostazioni e cronologia si sono spostati con l'account.",
    ifNot:
      "qualcuno che conosceva la tua password ha spostato l'account. Rispondi subito a questa email: possiamo riportarlo indietro e bloccarlo mentre verifichiamo. Poi cambia quella password ovunque l'hai usata.",
    button: "Contatta l'assistenza",
    note: "Questa email non contiene link che modificano qualcosa, di proposito. Non ti chiederemo mai la password via email.",
    helpTitle: "Vuoi che controlliamo l'account?",
    helpText: "Le segnalazioni di sicurezza vengono lette per prime.",
    why: (b: string) => `Questo avviso va all'indirizzo precedente ogni volta che cambia l'email di un account ${b}. Non può essere disattivato.`,
  },

  signIn: {
    subject: (b: string) => `Nuovo accesso al tuo account ${b}`,
    preheader: (device: string, when: string) => `Accesso da ${device} il ${when}. Se sei stato tu, non devi fare nulla.`,
    eyebrow: "Nuovo accesso",
    aPc: "un PC Windows",
    headline: (device: string) => `Nuovo accesso da ${device}.`,
    intro: (b: string) =>
      `Al tuo account ${b} si è effettuato l'accesso da un PC o da una rete che non avevamo mai visto su questo account. Lo inviamo una volta per ogni nuovo PC, e solo per accessi con la password corretta; una password sbagliata non genera mai questa email.`,
    rows: { device: "PC", when: "Quando", account: "Account" },
    ifYou: "non devi fare nulla, per esempio un secondo PC, una reinstallazione o una nuova rete. Un piano Pro segue l'account.",
    ifNotHtml:
      "cambia subito la password da <strong>Password dimenticata?</strong> nella schermata di accesso. Una nuova password disconnette subito ogni PC, compreso questo. Poi rispondi a questa email così controlliamo l'account.",
    note:
      "Questa email non contiene di proposito link per disconnettere qualcosa: un link “proteggi il tuo account” in un avviso di sicurezza è proprio la forma che avrebbe un messaggio falso. L'unica azione sicura è il ripristino che avvii tu dall'app. Non ti chiederemo mai la password via email.",
    helpTitle: "Non sei sicuro che fossi tu?",
    helpText: "Consideralo un accesso non tuo e scrivici. Le segnalazioni di sicurezza vengono lette per prime.",
    why: (b: string) => `Questo avviso viene inviato la prima volta che un nuovo PC o una nuova rete accede a un account ${b}. Non può essere disattivato.`,
  },

  receipt: {
    subject: (u: boolean, lifetime: boolean) =>
      u
        ? lifetime
          ? "Il tuo acquisto di PC Tweaker Uninstaller Pro è confermato"
          : "Il tuo abbonamento PC Tweaker Uninstaller Pro è attivo"
        : lifetime
          ? "La tua licenza PC Tweaker Pro Lifetime è attiva"
          : "Il tuo abbonamento PC Tweaker Pro è attivo",
    rows: {
      plan: "Piano",
      charged: "Addebitato",
      renewsOn: "Si rinnova il",
      access: "Accesso",
      neverExpires: "Non scade mai",
      renewal: "Rinnovo",
      renewalNone: "Nessuno. Non viene addebitato altro.",
      included: "Incluso",
      includedValue: "12 mesi di PC Tweaker Uninstaller Pro",
      account: "Account",
      shared: (email: string) => `${email} (condiviso con PC Tweaker)`,
    },
    eyebrowPro: "Pro attivato",
    eyebrowLifetime: "Licenza Lifetime",
    buttonPct: "Apri PC Tweaker",
    buttonUn: "Apri Uninstaller",
    help: {
      title: "Hai pagato ma non sei ancora Pro, o ti è stato addebitato qualcosa che non ti aspettavi?",
      text: "Indicaci l'indirizzo dell'account e la data sulla ricevuta Stripe.",
      expectation: "Le risposte sulla fatturazione partono di solito entro un giorno lavorativo.",
    },
    sub: {
      headline: (n: string) => named("Pro è attivo sul tuo account", n),
      preheader: (plan: string, price: string, renews: string) =>
        `${plan}, ${price}, si rinnova il ${renews}. Come gestire il piano e usare Pro su un secondo PC.`,
      intro: (email: string, total: number, free: number, pro: number) =>
        `Stripe ha confermato il pagamento e la licenza per ${email} è firmata. Tutti i ${total} controlli sono disponibili ora: i ${free} che avevi con Free più i ${pro} Pro, Game Sessions e il preset Turbo Gaming compresi. L'app aggiorna la licenza quando torni dal pagamento con la connessione attiva, quindi Pro dovrebbe già comparire.`,
      stepsTitle: "Da sapere fin dal primo giorno",
      stepsHtml: (who: string, renews: string) => [
        `<strong>Gestire il piano.</strong> Apri Piani e prezzi nell'app. Mostra il piano e apre il portale di fatturazione di Stripe, dove cambi la carta o disdici. Un piano disdetto resta Pro fino al ${renews} e non viene più addebitato.`,
        `<strong>Un secondo PC.</strong> Installa lì PC Tweaker e accedi con ${who}. La licenza è firmata per l'account, non per il computer, quindi è Pro su entrambi. I controlli applicati e la Cronologia modifiche restano per singolo computer.`,
        "<strong>Dopo una reinstallazione di Windows o un nuovo hardware.</strong> Accedi di nuovo e Pro torna da solo. La Cronologia modifiche non si trasferisce, quindi riapplica un profilo invece di cercare un ripristino.",
        "<strong>Da dove iniziare con Pro.</strong> Gaming, poi Game Sessions: registra un gioco e le impostazioni turbo si attivano quando parte e si annullano quando si chiude.",
      ],
      note: "Stripe invia fattura e ricevuta di pagamento separatamente, dal proprio indirizzo; conserva quella per i tuoi documenti. Se dopo qualche minuto l'app dice ancora Free, esci e accedi di nuovo: la licenza viene riletta all'accesso.",
      why: "Ricevi questa email perché sull'account collegato a questo indirizzo è stato attivato un abbonamento PC Tweaker Pro.",
    },
    lifetime: {
      headline: (n: string) => named("Pro, per sempre. Grazie", n),
      preheader: (price: string) =>
        `Un solo pagamento di ${price}, nessun rinnovo. Include 12 mesi di Uninstaller Pro, attivati al primo accesso.`,
      intro: (email: string, total: number) =>
        `Hai pagato una volta ed è l'ultima volta che addebitiamo questo account. La licenza Lifetime per ${email} è firmata e tutti i ${total} controlli, Game Sessions e il preset Turbo Gaming sono disponibili ora.`,
      stepsTitle: "Cosa significa Lifetime in pratica",
      stepsHtml: (who: string, uninstallerLink: string) => [
        `<strong>Ogni tuo PC.</strong> Accedi con ${who} su qualsiasi PC con Windows 10 o 11 ed è Pro. Non ci sono attivazioni da contare né chiavi di licenza da digitare: la chiave è l'account.`,
        `<strong>Uninstaller Pro per un anno.</strong> Installa PC Tweaker Uninstaller da ${uninstallerLink} e accedi con lo stesso account. I 12 mesi partono dal primo accesso lì, non da oggi. È un vantaggio separato e a tempo, non una licenza Lifetime di Uninstaller.`,
        "<strong>Reinstallazioni e nuovo hardware.</strong> Nulla da trasferire. Dopo un Windows nuovo, installa PC Tweaker, accedi, e Pro torna. La Cronologia modifiche appartiene alla vecchia installazione, quindi parti da un profilo invece di aspettarti che tornino le vecchie impostazioni.",
        "<strong>Aggiornamenti.</strong> PC Tweaker controlla da solo gli aggiornamenti, e Lifetime copre ogni aggiornamento di PC Tweaker Pro.",
      ],
      note: "Stripe invia la fattura separatamente. Se dopo questo acquisto vedessi mai un addebito mensile da parte nostra, scrivici subito: un account Lifetime non deve mai più essere addebitato, e sistemeremo tutto.",
      why: "Ricevi questa email perché sull'account collegato a questo indirizzo è stata acquistata una licenza PC Tweaker Pro Lifetime.",
    },
    un: {
      headline: (n: string) => named("Pro è attivo", n, ". Ora puoi rimuovere anche i residui."),
      preheader: (plan: string, price: string, renews: string | null) =>
        `${plan}, ${price}, ${renews ? `si rinnova il ${renews}` : "nessun rinnovo"}. Pulizia dei residui, rimozione in serie e voci non valide sono attive.`,
      intro: (email: string) =>
        `Stripe ha confermato il pagamento e la licenza Uninstaller Pro per ${email} è firmata. Nell'app cambiano tre cose: la ricerca dei residui ora può pulire ciò che trova, più programmi possono essere messi in coda e rimossi in un'unica sessione, e si possono rimuovere anche le voci il cui programma di disinstallazione non esiste più. Tutto ciò che avevi con Free, compresi il livello di affidabilità e il Registro rimozioni, resta esattamente com'era.`,
      stepsTitle: "Una prima rimozione pulita con Pro",
      stepsHtml: (lifetime: boolean, who: string, renews: string) => [
        "Scegli un programma valutato <strong>Sicuro</strong> e leggi il riepilogo della rimozione: il comando esatto, se parte Windows Installer o il programma di disinstallazione del programma, le autorizzazioni richieste e la dimensione indicata. Nulla parte finché non confermi.",
        "Dopo la disinstallazione, la ricerca dei residui elenca le cartelle, i collegamenti e le chiavi di registro lasciati dal programma. Con Pro puoi rimuoverli dalla stessa schermata. I file finiscono nel Cestino, quindi un errore è recuperabile finché non lo svuoti; i valori del registro restano nel Registro rimozioni.",
        "Per una pulizia più ampia, seleziona più programmi e avvia una rimozione in serie. I programmi protetti non entrano mai in una serie, il controllo dei programmi collegati avvisa comunque prima che un programma principale si porti via i suoi plugin, e prima delle rimozioni con privilegi elevati si tenta un punto di ripristino, con l'esito registrato.",
        ...(lifetime
          ? []
          : [
              `<strong>Gestire il piano.</strong> Piani e prezzi nella barra in alto mostra account e piano e apre il portale di fatturazione di Stripe per la carta o la disdetta. Un piano disdetto resta Pro fino al ${renews}. Accedendo con ${who} su un altro PC, è Pro anche lì.`,
            ]),
      ],
      note: (lifetime: boolean) =>
        `${lifetime ? "Questo acquisto non si rinnova. " : ""}Un account, due licenze: una licenza PC Tweaker Pro non sblocca Uninstaller e questa non sblocca PC Tweaker; ogni app verifica la propria. Stripe invia la fattura separatamente. Se dopo qualche minuto Uninstaller mostra ancora Free, esci e accedi di nuovo da Piani e prezzi.`,
      help: {
        title: "Hai pagato ma non sei ancora Pro, o una rimozione non è andata come diceva il riepilogo?",
        text: "Indicaci la versione dell'app e la voce del Registro rimozioni (si esporta in CSV).",
        expectation: "Di solito rispondiamo entro un giorno lavorativo.",
      },
      why: (lifetime: boolean) =>
        lifetime
          ? "Ricevi questa email perché sull'account PC Tweaker collegato a questo indirizzo è stato acquistato PC Tweaker Uninstaller Pro."
          : "Ricevi questa email perché sull'account PC Tweaker collegato a questo indirizzo è stato attivato un abbonamento Uninstaller Pro.",
    },
  },

  reversal: {
    subject: (u: boolean) =>
      u ? "Il pagamento di PC Tweaker Uninstaller Pro è stato stornato" : "Il pagamento di PC Tweaker Pro è stato stornato",
    eyebrow: "Pagamento stornato",
    headline: (n: string) => named("Il tuo pagamento è stato stornato", n),
    rows: {
      amount: "Importo stornato",
      plan: "Piano",
      proAccess: "Accesso Pro",
      ended: "Terminato",
      account: "Il tuo account",
      accountValue: "Aperto, su Free",
      unPro: "Uninstaller Pro",
      unFree: "Resta tuo con Free",
      unFreeValue: "Disinstallazioni singole, livello di affidabilità, riepilogo della rimozione, ricerca dei residui, Registro rimozioni",
    },
    pct: {
      lead: (amount: string | null) =>
        `${amount ? `Il tuo pagamento di ${amount}` : "Il tuo pagamento"} per PC Tweaker Pro è stato stornato dal tuo fornitore di pagamento.`,
      preheaderTail: "L'accesso Pro è terminato; le funzioni gratuite continuano a funzionare.",
      introTail:
        "Stripe ce lo ha comunicato, e l'accesso Pro legato a quel pagamento è terminato sul tuo account. Questa email registra cosa è cambiato; non ti chiede nulla.",
      ended: "L'accesso Pro legato a questo pagamento è terminato. Il tuo account e le funzioni gratuite continuano a funzionare.",
      endedTail: "L'app torna a Free al prossimo controllo della licenza, di solito al prossimo avvio o accesso.",
      stopRenewal: "Se l'abbonamento risulta ancora attivo, disdicilo da Piani e prezzi così non si rinnova.",
      oneOff: "Era un acquisto singolo, quindi non resta alcun abbonamento da disdire.",
      mistake: "Se pensi che sia successo per errore, rispondi a questa email e controlleremo con te i dati di Stripe.",
    },
    un: {
      preheader: (amount: string | null) =>
        `${amount ?? "Il tuo pagamento"} è stato stornato dal tuo fornitore di pagamento. Pro è terminato; disinstallazioni singole, riepilogo della rimozione e Registro rimozioni continuano a funzionare.`,
      intro: (amount: string | null) =>
        `Il tuo fornitore di pagamento ha stornato ${amount ? `il pagamento di ${amount}` : "il tuo pagamento"} per PC Tweaker Uninstaller Pro, e Stripe ce lo ha comunicato. L'accesso Pro legato a quel pagamento è terminato. Il tuo account resta aperto, e così la parte PC Tweaker: questo storno riguarda solo Uninstaller.`,
      stops:
        "Cosa si ferma: la pulizia dei residui, la rimozione in serie e la rimozione delle voci non valide. Cosa non cambia: ciò che è già stato rimosso resta rimosso, il Registro rimozioni conserva ogni ricevuta, e i file mandati nel Cestino restano lì finché non lo svuoti.",
      stopRenewal:
        "Se l'abbonamento risulta ancora attivo su Stripe, disdicilo da Piani e prezzi nella barra in alto così non tenta un altro addebito.",
      oneOff: "Era un accesso singolo, quindi non resta nulla da disdire.",
      origin:
        "Questo storno è partito dalla tua banca o dall'emittente della carta, non da noi. Se non l'hai chiesto tu alla banca, rispondi a questa email con data e importo dell'estratto conto e ripercorreremo con te i dati di Stripe.",
    },
    helpTitle: "Domande su questo storno?",
    helpText: "Indicaci la data e l'importo sull'estratto conto.",
    why: (u: boolean) =>
      u
        ? "Ricevi questa email perché un pagamento per Uninstaller Pro sull'account PC Tweaker collegato a questo indirizzo è stato stornato."
        : "Ricevi questa email perché un pagamento per PC Tweaker Pro sull'account collegato a questo indirizzo è stato stornato.",
  },

  ending: {
    subject: (b: string, ends: string) => `Il tuo piano ${b} Pro termina il ${ends}`,
    preheader: (ends: string) => `Pro resta attivo fino al ${ends}, poi l'account torna a Free. Non viene eliminato nulla.`,
    eyebrow: "Piano in scadenza",
    headline: (n: string, ends: string) => named(`Pro resta attivo fino al ${ends}`, n),
    intro: (b: string, failed: boolean, ends: string) =>
      failed
        ? `Stripe non è riuscito a riscuotere il rinnovo del tuo abbonamento ${b} Pro. Pro continua a funzionare mentre Stripe riprova il pagamento; se non riesce a riscuoterlo entro il ${ends}, l'account torna a Free.`
        : `Il tuo abbonamento ${b} Pro è stato disdetto, come richiesto. Non ci saranno altri addebiti. Tutto ciò che è Pro funziona fino alla fine del periodo già pagato, poi l'account torna a Free.`,
    rows: { plan: "Piano", until: "Pro fino al", next: "Prossimo addebito", nextValue: "Nessuno", after: "Dopo" },
    afterValue: (u: boolean, free: number) =>
      u ? "Free: disinstallazioni singole, ricerca dei residui, Registro rimozioni" : `Free: ${free} controlli, Scansione, Punteggio di salute, Cronologia modifiche`,
    stepsTitle: (ends: string) => `Prima del ${ends}`,
    steps: (u: boolean, failed: boolean) => [
      u
        ? "Pulizia dei residui e rimozione in serie si fermano quando Pro termina. Ciò che è già stato rimosso resta rimosso, e il Registro rimozioni conserva ogni ricevuta."
        : "Le impostazioni applicate con controlli Pro non vengono annullate quando Pro termina; Windows le mantiene. Se vuoi riportarne alcune ai valori predefiniti, fallo ora dalla scheda del controllo o da Cronologia modifiche, dove il ripristino funziona anche con Free.",
      u
        ? "I file mandati nel Cestino da una pulizia Pro restano lì finché non lo svuoti, con o senza Pro."
        : "Quando Pro termina, Game Sessions smette di attivare le impostazioni turbo all'avvio dei giochi. Da una sessione già chiusa non resta applicato nulla, perché ogni sessione viene annullata all'uscita.",
      failed
        ? "Aggiorna la carta da Piani e prezzi, poi Gestisci abbonamento. Stripe riprova il rinnovo da solo; quando riesce, Pro continua senza interruzioni."
        : "Hai cambiato idea? Apri Piani e prezzi, poi Gestisci abbonamento: fino alla data di fine Stripe ti permette di riprendere lo stesso piano senza un nuovo pagamento.",
    ],
    button: (b: string) => `Apri ${b}`,
    note: "Quando Pro termina non viene eliminato nulla: l'account, la sua cronologia e ogni impostazione applicata restano esattamente dove sono. Stripe invia separatamente il proprio avviso sull'abbonamento.",
    helpTitle: "Non hai disdetto, o la data sembra sbagliata?",
    helpText: "Scrivici e controlleremo con te i dati di Stripe.",
    why: (b: string) => `Ricevi questa email perché l'abbonamento ${b} Pro dell'account collegato a questo indirizzo ha cambiato stato.`,
  },

  bonus: {
    subject: "I tuoi 12 mesi di Uninstaller Pro sono iniziati",
    preheader: (ends: string) => `Incluso nella tua licenza PC Tweaker Lifetime, attivo fino al ${ends}. Nulla da pagare, nulla da disdire.`,
    eyebrow: "Vantaggio Lifetime",
    headline: (n: string) => named("Il tuo anno di Uninstaller Pro è iniziato oggi", n),
    intro: (ends: string) =>
      `Hai effettuato l'accesso a PC Tweaker Uninstaller con l'account che ha la tua licenza PC Tweaker Lifetime, ed è questo primo accesso a far partire i 12 mesi di Uninstaller Pro inclusi. Nessuna carta è stata addebitata e non c'è alcun abbonamento dietro; dura fino al ${ends} e poi semplicemente si ferma.`,
    rows: {
      entitlement: "Accesso",
      entitlementValue: "Uninstaller Pro, vantaggio Lifetime di 12 mesi",
      started: "Iniziato",
      ends: "Termina",
      charged: "Addebitato",
      chargedValue: "Nulla. Nessun rinnovo.",
    },
    stepsTitle: "Cosa aggiunge Pro per quest'anno",
    stepsHtml: [
      "<strong>Pulizia dei residui.</strong> La ricerca dopo ogni disinstallazione elencava già ciò che restava; ora puoi rimuovere quelle cartelle, collegamenti e chiavi di registro dalla stessa schermata. I file finiscono nel Cestino, i valori del registro restano nel Registro rimozioni.",
      "<strong>Rimozione in serie.</strong> Seleziona più programmi e lasciali procedere in un ordine sicuro. I programmi protetti sono esclusi, e per le rimozioni con privilegi elevati si tenta prima un punto di ripristino.",
      "<strong>Voci non valide.</strong> I programmi il cui programma di disinstallazione non esiste più, che di solito restano in elenco per sempre, possono essere rimossi.",
    ],
    button: "Apri Uninstaller",
    note: (ends: string) =>
      `Alla fine dell'anno Uninstaller torna a Free da solo: disinstallazioni singole, livello di affidabilità, ricerca dei residui e Registro rimozioni restano, e nulla di ciò che è stato rimosso torna indietro. La tua licenza PC Tweaker Lifetime non cambia in nessun caso. Se vuoi Pro oltre il ${ends}, è da Piani e prezzi che partirebbe un piano Uninstaller a pagamento; non c'è alcuna conversione automatica.`,
    helpTitle: "Pro non compare in Uninstaller?",
    helpText: "Esci e accedi di nuovo una volta; ogni app legge la propria licenza all'accesso.",
    why: "Ricevi questa email perché sull'account PC Tweaker collegato a questo indirizzo è stato attivato il vantaggio Lifetime. Viene inviata una sola volta.",
  },

  reminder: {
    subject: "Il tuo pagamento PC Tweaker Lifetime",
    preheader: "Il pagamento si è chiuso prima di completarsi, quindi non è stato addebitato nulla. È l'unico promemoria.",
    eyebrow: "Pagamento non completato",
    headline: (n: string) => named("Non è stato addebitato nulla", n),
    intro:
      "Hai aperto un pagamento Lifetime per PC Tweaker Pro e la pagina di Stripe si è chiusa prima che il pagamento andasse a buon fine. Nessuna carta è stata addebitata e il tuo account è esattamente com'era. Se qualcosa ti ha fermato, ecco cosa si chiede di solito prima di decidere.",
    rows: (total: number) => [
      ["Lifetime", "Un solo pagamento. Nessun rinnovo, mai."],
      ["Comprende", `Tutti i ${total} controlli, Game Sessions, ogni aggiornamento`],
      ["PC", "Ogni PC su cui accedi con questo account"],
      ["Incluso anche", "12 mesi di PC Tweaker Uninstaller Pro"],
    ],
    button: "Apri PC Tweaker",
    retry:
      "Per riprovare, apri Piani e prezzi nell'app e scegli Lifetime. Il pagamento richiede un indirizzo email confermato; se il pulsante è grigio è per questo, e Invia di nuovo nel menu dell'account lo risolve. Il prezzo attuale è sulla scheda del piano e sulla pagina di Stripe.",
    doubts:
      "Se un metodo di pagamento è stato rifiutato, Stripe mostra il motivo sulla sua pagina; di solito un'altra carta o un portafoglio digitale funziona. E se hai deciso di no, va benissimo: Free resta Free, e questo è l'unico promemoria che riceverai per questo pagamento.",
    helpTitle: "Una domanda prima di decidere?",
    helpText: "Risponde una persona vera.",
    why: "Ricevi questa email perché dall'account PC Tweaker collegato a questo indirizzo è stato avviato un pagamento Lifetime non completato. Un solo promemoria.",
    unsubscribe: "Non ricevere più email come questa.",
  },

  supportAck: {
    subject: "Abbiamo ricevuto la tua richiesta di assistenza PC Tweaker",
    preheader: "Il tuo messaggio è in coda. Rispondi a questa email per aggiungere un dettaglio o uno screenshot.",
    eyebrow: "Richiesta di assistenza ricevuta",
    headline: (n: string) => (n ? `Ricevuto, ${n}. È in coda.` : "Ricevuto. È in coda."),
    intro:
      "Il tuo messaggio è arrivato alla casella di assistenza di PC Tweaker. Lo legge una persona, non un bot, e la risposta arriva a questo indirizzo. La maggior parte delle risposte parte entro un giorno lavorativo; ciò che richiede di riprodurre il problema da parte nostra può richiedere un po' di più, e te lo diremo.",
    replyTo: "Rispondiamo a",
    stepsTitle: "Cosa accelera la risposta",
    steps: [
      "Rispondi a questa email con ciò che hai dimenticato: la versione dell'app, la versione di Windows e il controllo o la scansione esatti che hai usato. Un'unica conversazione tiene tutto insieme.",
      "Se un'impostazione si comporta male, apri Cronologia modifiche e dicci cosa riporta la voce. Ogni controllo applicato è elencato lì con il valore impostato e quello sostituito, che di solito è tutta la diagnosi.",
      "Gli screenshot aiutano; prima sfoca tutto ciò che è personale. Non includere mai password, token di licenza o dati della carta, e se mai sembrasse che te li chiediamo, il messaggio non è nostro.",
    ],
    wait: "Nel frattempo: se una modifica va annullata subito, Ripristina i tweak attivi in Cronologia modifiche riporta ogni impostazione registrata senza aspettarci.",
    guide: (link: string) => `La ${link} copre i casi che non raggiunge.`,
    guideLabel: "guida per annullare le modifiche",
    notYouTitle: "Non ci hai scritto tu?",
    notYou:
      "Qualcuno ha inserito questo indirizzo nel modulo di assistenza. Puoi ignorare questa email; tramite il modulo non cambia nulla su nessun account. Se continua a succedere, scrivici e bloccheremo la fonte.",
    why: "Ricevi questa email perché da questo indirizzo è stata inviata una richiesta di assistenza a PC Tweaker.",
  },

  pages: {
    error: "Errore",
    unavailable: "Questo servizio non è disponibile in questo momento.",
    missingToken: "Questo link è incompleto. Aprilo direttamente dall'email.",
    verifiedTitle: "Email verificata",
    verified: (b: string) => `La tua email è verificata. Puoi chiudere questa finestra e tornare a ${b}.`,
    alreadyVerified: (b: string) => `La tua email è già verificata. Puoi chiudere questa finestra e tornare a ${b}.`,
    expiredTitle: "Link scaduto",
    verifyExpired: "Questo link di verifica non è valido o è scaduto. Chiedine uno nuovo dall'app.",
    failed: "Qualcosa è andato storto. Riprova più tardi.",
    resetTitle: "Scegli una nuova password",
    resetLead:
      "Scegline una che non usi da nessun'altra parte. Vale per PC Tweaker, PC Tweaker Uninstaller e Tweaky Driver, e verrai disconnesso dagli altri dispositivi.",
    newPassword: "Nuova password",
    newPasswordPlaceholder: "Almeno 8 caratteri",
    passwordHint: "Usa almeno 8 caratteri e non più di 72 byte UTF-8. Le lettere accentate e le emoji possono occupare più byte.",
    confirmPassword: "Conferma la password",
    confirmPlaceholder: "Scrivila di nuovo",
    update: "Aggiorna la password",
    resetHint: "Questo link vale una sola volta e scade un'ora dopo l'invio.",
    notValidTitle: "Link non valido",
    notValidLead: "Questa pagina richiede il link dell'email di ripristino. Apri quel link direttamente invece di ricaricare la pagina.",
    passwordRule: "La password deve avere almeno 8 caratteri e non più di 72 byte UTF-8.",
    mismatch: "Le due password non coincidono.",
    resetInvalid: "Questo link di ripristino non è valido, è già stato usato o è scaduto.",
    resetFailed: "Non è stato possibile reimpostare la password. Riprova.",
    updatedTitle: "Password aggiornata",
    updated: (b: string) => `Fatto. Torna in ${b} e accedi con la nuova password.`,
    closeHint: "Puoi chiudere questa finestra.",
    emailChangedTitle: "Indirizzo email cambiato",
    emailChanged: (b: string, email: string) => `Ora il tuo account usa ${email}. Torna in ${b} e accedi con questo indirizzo.`,
    emailChangeInvalid: "Questo link non è valido, è già stato usato o è scaduto. Chiedi di nuovo la modifica dall'app.",
    emailTaken: "Questo indirizzo è già usato da un altro account. Non è cambiato nulla.",
  },

  checkout: {
    paidTitle: "Pagamento completato",
    paidBody: (app: string) =>
      `Pro è attivo sul tuo account. Torna in ${app}: il nuovo piano viene rilevato da solo al prossimo controllo della licenza.`,
    trialTitle: "La tua prova gratuita è iniziata",
    trialBody: (app: string, days: number) =>
      `Oggi non ti è stato addebitato nulla e Pro è attivo sul tuo account per ${days} giorni. Alla fine della prova il primo pagamento viene addebitato automaticamente, a meno che tu non disdica prima da Piani e prezzi in ${app}. Ti scriviamo il giorno prima.`,
    cancelTitle: "Pagamento annullato",
    cancelBody: "Non è stato addebitato nulla. Puoi riaprire il pagamento dall'app quando vuoi.",
    tipTitle: "Grazie per il tuo supporto",
    tipBody: "La tua mancia va direttamente in nuove funzioni e negli aggiornamenti quotidiani di PC Tweaker. Stripe ti invierà la ricevuta via email.",
    notedTitle: "Grazie per avercelo detto",
    notedBody: "Ci aiuta a capire dove continuare a pubblicare. Torna nell'app: il nuovo piano viene rilevato in automatico.",
    ask: "Facoltativo: come hai conosciuto PC Tweaker?",
    sources: {
      youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook",
      search: "Motore di ricerca", friend: "Un amico", other: "Altrove",
    } as Record<string, string>,
    close: "Puoi chiudere questa scheda.",
  },
};
