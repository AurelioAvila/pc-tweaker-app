# Script video TikTok/Reels — PC Tweaker

Formato: 15-30s, verticale 9:16, screen recording dell'app + webcam/voce opzionale.
Registrazione: Win+Alt+R (Xbox Game Bar) o OBS a 1080x1920/60fps sull'app in
finestra, poi editing in CapCut (gratis, ha già i template per testo animato).

## Cosa dice la ricerca 2026 (non teoria, dati)

- **I primi 3 secondi decidono tutto**: il 65% degli utenti scorre via prima del
  quarto secondo. L'algoritmo non spinge un video che non trattiene lo spettatore
  in quella finestra. Serve un hook con 3 elementi **simultanei**: movimento
  visivo, hook parlato (10-14 parole), e lo stesso hook scritto in overlay
  (per chi guarda senza audio). ([riffkit.ai](https://riffkit.ai/blog/viral-hook-formula), [go-viral.app](https://www.go-viral.app/blog/hook-first-3-seconds/))
- **L'emozione scelta cambia tutto**: video costruiti su un trigger di
  paura/rischio ("stai sbagliando", "questo ti sta danneggiando") fanno in media
  **49 volte** le view di video costruiti su un trigger di speranza/beneficio
  generico. Le formule di hook che performano meglio nel 2026 sono *Contrarian
  Claim*, *Mistake Warning* e *List Tease*. ([thecontentlabs.app](https://thecontentlabs.app/blog/what-goes-viral-in-2026-data-study))
- **Originalità pesa più che mai**: se il sistema rileva che un video è un
  repost (incluso il watermark TikTok riportato su Instagram), la reach viene
  attivamente penalizzata — vale la pena esportare due file puliti separati,
  non lo stesso file con watermark riciclato. ([techwyse.com](https://www.techwyse.com/blog/infographic/best-short-video-platform-2026-instagram-reels-tiktok-youtube-shorts))
- **Chi è già virale in questa identica nicchia**: Chris Titus Tech Utility e
  Optimizer di Hellzerg (entrambi su GitHub) sono i tool di riferimento che
  già girano virali su TikTok con l'angolo "ottimizza il PC in 90 secondi,
  guarda FPS/boot time prima-dopo". Sono i tuoi concorrenti diretti nei
  commenti/hashtag — utile saperlo per differenziarti (loro non hanno
  rollback automatico né UI, è il tuo vantaggio competitivo reale da
  sottolineare). ([tiktok.com/@thesoaptech](https://www.tiktok.com/@thesoaptech/video/7390890131617549600))

---

## Video 1 — "Il tuo mouse ti sta sabotando la mira" (Mistake Warning + Fear)

**Hook (0-3s) — dev'essere presente TUTTO insieme: movimento + voce + testo:**
> (movimento: muovi il mouse a scatti sullo schermo) + voce: *"Il tuo mouse su
> Windows sta rovinando la tua mira e non lo sai"* + testo overlay identico

**Shot list:**
1. (0-3s) Hook come sopra — pattern-interrupt visivo (mouse a scatti) + audio + testo
2. (3-7s) Testo: "Si chiama 'Enhance Pointer Precision' — attivo di default su OGNI Windows"
3. (7-14s) Screen recording: apri PC Tweaker → categoria Gaming → toggle
   "Riduci input lag" → mostra il rollback automatico (passaci sopra, fai vedere
   che salva lo stato precedente prima di applicare)
4. (14-20s) Stesso movimento mouse di prima, ora lineare/preciso — split screen
   prima/dopo in CapCut se possibile
5. (20-24s) Testo: "Gratis, un click, reversibile al 100% — a differenza di altri tool non tocchi nulla che non puoi tornare indietro"
6. (24-28s) CTA verbale + testo: "Cerca 'PC Tweaker' — link in bio"

**Caption:**
"Windows attiva questa impostazione di default e nessuno la disattiva mai 🎯 #pcgaming #windowstips #pctweaks #gamingsetup #fps"

---

## Video 2 — "3 impostazioni che Windows attiva contro di te" (List Tease + Mistake Warning)

**Hook (0-3s):**
> voce+testo: *"Windows ha attivato 3 impostazioni che ti rallentano il PC apposta"*
> (movimento: mostra rapidamente Task Manager con CPU/RAM alte)

**Shot list:**
1. (3-9s) **#1 Xbox Game Bar** — mostra Task Manager con overlay attivo, poi il
   toggle in PC Tweaker che lo disattiva
2. (9-15s) **#2 Piano energia bilanciato** — mostra powercfg di Windows, poi
   il toggle "High Performance" in PC Tweaker
3. (15-21s) **#3 HAGS disattivato** — spiega in 2 parole (GPU scheduling),
   mostra il toggle
4. (21-26s) Testo: "Tutte e 3 in un click col preset 'Turbo Gaming'"
5. (26-28s) CTA: link in bio / winget install

**Caption:**
"Nessuna di queste te la dice Windows di sua iniziativa 👀 salvalo per dopo #windows11 #pcoptimization #techtips #gaming"

---

## Video 3 — "Non scaricare un PC optimizer prima di vedere questo" (Contrarian + fiducia)

Questo è l'angolo che intercetta chi cerca "is this optimizer safe" invece di
chi cerca solo gaming — traffico più freddo ma conversione più alta perché
arriva già con l'intento di installare qualcosa.

**Hook (0-3s):**
> voce+testo: *"Non installare NESSUN PC optimizer prima di aver visto questo trucco per riconoscerli"*

**Shot list:**
1. (3-9s) Mostra la pagina "cosa modifica ogni tweak" (chiave di registro,
   perché — se non esiste ancora, va creata prima di girare questo video)
2. (9-15s) Mostra il rollback: applica un tweak, poi annullalo con un click,
   mostra che torna esattamente al valore precedente
3. (15-21s) Mostra l'installazione via `winget install AurelioAvila.PCTweaker`
   nel terminale — winget = pubblicato tramite il package manager ufficiale
   di Microsoft, non un .exe scaricato da un sito a caso
4. (21-25s) Testo: "Regola: se un tool non ti dice ESATTAMENTE cosa modifica, non lo installi"
5. (25-28s) CTA

**Caption:**
"La differenza tra un tool serio e uno che ti frega è: puoi vedere cosa fa? #cybersecurity #windows #pctools #transparency"

---

## Video 4 — "Perché non uso [CTT/altri optimizer]" (Contrarian diretto vs concorrenza)

Nuovo, basato sulla ricerca: questa nicchia ha già tool virali affermati (Chris
Titus Tech Utility, Optimizer). Un video che li nomina onestamente (senza
disprezzarli, solo differenziando) intercetta il loro pubblico già interessato
al tema — è il video più rischioso ma anche a più alto potenziale reach perché
"aggancia" community esistenti.

**Hook (0-3s):**
> voce+testo: *"Uso ancora i tool di ottimizzazione PC più famosi? No, ed ecco perché"*

**Shot list:**
1. (3-10s) Onestà: "Sono ottimi tool, ma quasi nessuno ha un rollback vero —
   se qualcosa va storto devi reinstallare Windows"
2. (10-18s) Mostra il rollback one-click di PC Tweaker in azione
3. (18-24s) Mostra la UI (lista chiara di categorie) vs uno script da terminale
4. (24-28s) CTA

**Caption:**
"Non è meglio o peggio, è solo pensato per chi vuole poter tornare indietro senza pensieri #windowstools #pcoptimization #techtok"

---

## Aggiornamento 6 agosto 2026 — nuovo angle di attualità: ESU Windows 10

Ricerca aggiuntiva per questo giro di manutenzione. Prima di scrivere uno script
sulla scadenza ESU (13 ottobre 2026) è stato verificato lo stato attuale della
notizia — e non è più accurato:

- **Microsoft ha esteso silenziosamente il programma ESU gratuito consumer**:
  la scadenza non è più il 13 ottobre 2026 ma il **12 ottobre 2027** — un anno
  extra di aggiornamenti di sicurezza gratuiti per chi resta su Windows 10.
  L'annuncio non è stato un comunicato stampa ma una nota aggiunta il 25 giugno
  2026 alla documentazione ufficiale e a un blog post esistente — molti utenti
  ancora non lo sanno e credono (erroneamente) che la scadenza sia ottobre 2026.
  ([bleepingcomputer.com](https://www.bleepingcomputer.com/news/microsoft/microsoft-quietly-extends-free-windows-10-esu-support-to-october-2027/), [windowscentral.com](https://www.windowscentral.com/microsoft/windows-10/microsoft-quietly-extends-windows-10s-extra-security-updates-program-for-free-users-can-now-stay-on-windows-10-until-october-2027-securely), [learn.microsoft.com — pagina ufficiale ESU](https://learn.microsoft.com/en-us/windows/whats-new/extended-security-updates))
- **Perché l'ha estesa**: milioni di PC restano incompatibili con i requisiti
  hardware di Windows 11 (TPM 2.0, CPU supportate) e molti utenti rifiutano
  comunque l'upgrade per bug, invadenza dell'AI e percezione di performance
  peggiori — Microsoft ha di fatto ammesso che una fetta enorme di utenti
  resterà su Windows 10 ancora a lungo. ([windowslatest.com](https://www.windowslatest.com/2026/06/25/windows-10-support-quietly-extended-until-oct-2027-as-users-reject-windows-11/), [cybernews.com](https://cybernews.com/tech/microsoft-windows-10-update-program-extended/))
- **Perché è un angle utile per PC Tweaker**: non è "compra un PC nuovo", è
  l'opposto — un pubblico enorme (ancora su Windows 10, spesso su hardware
  più vecchio non upgradabile a Windows 11) ha bisogno di più performance dal
  proprio hardware attuale, non di sostituirlo. È il target perfetto per un
  tool di ottimizzazione. Formato "news reactor" (notizia poco nota), distinto
  dai formati Contrarian/Mistake/List Tease già usati nei Video 1-4 — alto
  potenziale reach perché intercetta chi sta cercando "Windows 10 fine
  supporto" proprio in questo periodo.
- **Nota importante**: NON usare un hook con scadenza falsa tipo "hai solo
  pochi giorni prima che il PC diventi vulnerabile" — sarebbe fattualmente
  sbagliato (la vera scadenza è ottobre 2027) e rischierebbe correzioni
  pubbliche nei commenti che danneggiano la credibilità del canale.

---

## Video 5 — "Windows 10 NON finisce a ottobre 2026 (e quasi nessuno lo sa)" (News Reactor + Mistake Warning)

Angolo di attualità (notizia di giugno-luglio 2026, ancora poco conosciuta ad
agosto): Microsoft ha silenziosamente esteso il programma ESU gratuito a
ottobre 2027. Buon potenziale per intercettare chi sta cercando in questo
periodo "Windows 10 fine supporto" / "devo aggiornare a Windows 11".

**Hook (0-3s) — dev'essere presente TUTTO insieme: movimento + voce + testo:**
> (movimento: mostra rapidamente una data "13 ottobre 2026" sbarrata e
> sostituita da "12 ottobre 2027") + voce: *"Pensi che Windows 10 smetta di
> funzionare a ottobre? Microsoft ha cambiato tutto e non te l'ha detto"* +
> testo overlay identico

**Shot list:**
1. (0-3s) Hook come sopra
2. (3-9s) Testo: "A giugno 2026 Microsoft ha esteso l'ESU gratuita di un anno —
   nessun comunicato stampa, solo una riga aggiunta a un blog post già esistente"
3. (9-15s) Testo: "Perché? Milioni di PC non riescono a fare l'upgrade a
   Windows 11 (serve TPM 2.0) e tanti altri non vogliono farlo"
4. (15-21s) Pivot al prodotto: "Se il tuo PC resta su Windows 10 ancora a
   lungo, tienilo comunque veloce" → screen recording: apri PC Tweaker,
   mostra un preset di performance (es. "Turbo Gaming" o categoria dedicata)
5. (21-26s) Mostra il rollback one-click (coerenza col resto del canale —
   messaggio "sicuro, reversibile")
6. (26-28s) CTA verbale + testo: "Cerca 'PC Tweaker' — link in bio"

**Caption:**
"Windows 10 NON finisce a ottobre 2026 come pensi (Microsoft l'ha esteso in silenzio a ottobre 2027) — ma vale comunque la pena tenerlo veloce 💻 #windows10 #windowsupdate #pctips #pcoptimization #tech"

---

## Aggiornamento 10 agosto 2026 — nuovo angle di attualità: Windows 11 26H2

Ricerca aggiuntiva per questo giro di manutenzione. Il prossimo aggiornamento
annuale di Windows 11 (26H2) è il prossimo vero catalizzatore di ricerca per
questa nicchia — storicamente ogni versione H2 fa esplodere le ricerche
"should I update" / "cosa cambia" nelle settimane del rilascio.

- **Finestra di rilascio**: fine settembre – ottobre 2026, in linea con lo
  storico delle versioni H2 precedenti (23H2 = ottobre 2023, 24H2 = ottobre
  2024, 25H2 = fine settembre 2025). Microsoft non ha confermato una data
  esatta al momento di questa ricerca. ([windowslatest.com](https://www.windowslatest.com/2026/08/05/windows-11-26h2-release-date-roll-out-time-line-and-whats-actually-new/), [pcworld.com](https://www.pcworld.com/article/3206876/windows-11-26h2-arrives-in-october-heres-why-you-shouldnt-skip-it.html))
- **Non è il grande upgrade che il nome suggerisce**: per chi è già su
  Windows 11 24H2 o 25H2, 26H2 arriva come "enablement package" — un
  pacchetto di circa 174 KB che si limita ad attivare funzionalità già
  presenti nel sistema tramite un solo riavvio, non una reinstallazione o un
  download multi-gigabyte. Sotto il cofano 25H2 e 26H2 condividono la stessa
  base di codice. ([windowscentral.com](https://www.windowscentral.com/microsoft/windows-11/windows-11-version-26h2-2026-update-10-things-to-know), [pcworld.com](https://www.pcworld.com/article/3063498/windows-11-26h2-is-coming-meet-all-the-new-features.html))
- **Perché è comunque un buon angle**: anche se il salto tecnico è piccolo, il
  volume di ricerca attorno al nome "26H2" nelle settimane del rilascio sarà
  alto (succede a ogni H2) — è il tipo di traffico che un video "news
  reactor" onesto può intercettare senza dover inventare drammaticità che il
  fatto non ha.
- **Perché NON è un angle da "compra hardware nuovo"**: a differenza di altri
  cicli, nel 2026 Nvidia non ha lanciato nuove GPU gaming (la serie RTX 60 è
  slittata al 2028) — manca quindi il trigger hardware che di solito
  accompagna un aggiornamento OS importante. Questo conferma che l'angolo
  giusto resta software/ottimizzazione, non "comprare hardware nuovo per
  26H2" — esattamente il posizionamento che il canale ha già.
  ([tomshardware.com](https://www.tomshardware.com/pc-components/gpus/report-claims-nvidia-will-not-be-releasing-any-new-rtx-gaming-gpus-in-2026-rtx-60-series-likely-debuting-in-2028))
- **Attenzione a non promettere tweak specifici per 26H2 che non esistono
  ancora**: al momento di questa ricerca 26H2 non è ancora pubblico, quindi
  nessuna nuova chiave di registro legata a 26H2 è verificabile. Il Video 6
  qui sotto usa solo funzionalità dell'app già verificate (stesse dei Video
  1-5), non inventa tweak "per 26H2" — la promessa è "qualunque versione tu
  abbia, il PC resta veloce", non un tweak nuovo specifico.

---

## Video 6 — "Windows 11 sta per aggiornarsi (26H2) — cosa cambia davvero" (News Reactor + Contrarian)

Angolo di attualità in anticipo sul rilascio (atteso fine settembre–ottobre
2026): molti video venderanno 26H2 come "il grande aggiornamento annuale" —
questo video corregge l'aspettativa (per chi è già su 24H2/25H2 è un
pacchetto minuscolo) e sposta l'attenzione su ciò che conta davvero
indipendentemente dalla versione: le prestazioni reali del PC.

**Hook (0-3s) — dev'essere presente TUTTO insieme: movimento + voce + testo:**
> (movimento: mostra rapidamente una finestra "Windows Update" che scarica)
> + voce: *"Windows 11 26H2 sta arrivando e i video che lo vendono come
> rivoluzionario ti stanno mentendo"* + testo overlay identico

**Shot list:**
1. (0-3s) Hook come sopra
2. (3-9s) Testo: "Per chi è già su 24H2 o 25H2 è un pacchetto da circa
   174 KB — un riavvio, non una reinstallazione"
3. (9-15s) Testo: "Niente nuove GPU quest'anno ad accompagnarlo (RTX 60
   rimandata al 2028) — quindi niente scusa per comprare hardware nuovo"
4. (15-21s) Pivot al prodotto: "Qualunque versione tu abbia, il tuo PC può
   essere più veloce oggi" → screen recording: apri PC Tweaker, mostra le
   categorie (Performance/Gaming/Privacy/UI)
5. (21-26s) Mostra il rollback one-click (coerenza col resto del canale)
6. (26-28s) CTA verbale + testo: "Cerca 'PC Tweaker' — link in bio"

**Caption:**
"Windows 11 26H2 arriva a fine settembre/ottobre — non è la rivoluzione che vedi in giro, ma vale comunque la pena tenere il PC veloce 🖥️ #windows11 #windowsupdate #pctips #pcoptimization #tech"

---

## Aggiornamento 12 agosto 2026 — nuovo angle di attualità: Low Latency Profile

Ricerca aggiuntiva per questo giro di manutenzione. Microsoft ha appena esteso a
tutte le app la funzione "Low Latency Profile" (parte dell'iniziativa Windows K2):
un ottimo trigger di ricerca perché è notizia di OGGI, non di settimane fa.

- **Cos'è**: lo scheduler spinge la CPU alla frequenza massima per 1-3 secondi
  nel momento esatto in cui apri un'app o un menu ("race to sleep"), poi torna
  subito in idle — Microsoft dichiara fino al **40% di lancio app più veloce**
  e fino al 70% più veloce per Start menu/flyout (dati interni Microsoft, da
  trattare come risultato best-case). ([wccftech.com](https://wccftech.com/windows-11s-new-low-latency-profile-pushes-your-cpu-into-short-overclocking-bursts-to-kill-start-menu-stutter/), [windowslatest.com — test indipendente](https://www.windowslatest.com/2026/05/08/i-tested-windows-11s-hidden-low-latency-profile-and-budget-pcs-are-about-to-feel-premium/))
- **Timeline**: era già attiva da giugno 2026 solo per gli elementi della shell
  (Start, ricerca, centro notifiche). Con l'update di sicurezza di **agosto 2026
  (KB5121003)** Microsoft l'ha estesa silenziosamente anche al lancio delle
  app normali, su Windows 11 24H2 e 25H2. ([windowslatest.com](https://www.windowslatest.com/2026/08/12/windows-11s-faster-app-launches-released-today-enable-it-using-these-steps/))
- **Punto chiave per l'hook**: è **automatica e attiva di default**, nessun
  toggle da cercare nelle Impostazioni — la maggior parte degli utenti non sa
  nemmeno che esiste, il che la rende un'ottima notizia "Windows ha appena
  fatto una cosa e non te l'ha detto", identico framing già usato per il
  Video 5 (ESU). ([windowscentral.com](https://www.windowscentral.com/microsoft/windows-11/confused-about-low-latency-profile-on-windows-11-heres-what-we-know-so-far))
- **Perché NON diventa un tweak nell'app**: prima di agosto la funzione era
  attivabile in anticipo solo via ViVeTool con feature ID sperimentali e non
  documentati ufficialmente (es. `vivetool /enable /id:58989092,60716524,...`).
  Sono flag interni che Microsoft può rimuovere o rinominare da un build
  all'altro senza preavviso, l'opposto della garanzia "reversibile e verificato"
  su cui è costruito il pool tweak dell'app (vedi `tweaks.rs`) — e comunque ora
  che il rollout è generale via Windows Update, non c'è più nulla da abilitare
  manualmente. Per questo non viene aggiunto alcun tweak/registry key legato a
  Low Latency Profile: resta solo un angle di script (nessuna azione tecnica
  rischiosa proposta agli utenti).
- **Pivot naturale al prodotto**: "Windows si è appena velocizzato da solo per
  aprire le app — ma tutto il resto che rallenta il tuo PC (avvio automatico,
  Game DVR, piano energia bilanciato) Windows non lo tocca da solo" → resta
  coerente con il posizionamento del canale, senza inventare un tweak che non
  esiste.

---

## Video 7 — "Windows si è appena velocizzato e non te l'ha detto" (News Reactor + Mistake Warning)

Angolo di attualità (notizia di agosto 2026, pubblicata proprio nei giorni in cui
si gira/pubblica): Microsoft ha esteso a tutte le app il boost "Low Latency
Profile". Buon potenziale per intercettare chi cerca "perché Windows 11 è più
veloce" / "Low Latency Profile" in questo periodo.

**Hook (0-3s) — dev'essere presente TUTTO insieme: movimento + voce + testo:**
> (movimento: doppio click rapido su un'app, si apre quasi istantaneamente) +
> voce: *"Windows si è appena velocizzato da solo e la maggior parte delle
> persone non lo sa nemmeno"* + testo overlay identico

**Shot list:**
1. (0-3s) Hook come sopra
2. (3-9s) Testo: "Si chiama Low Latency Profile — spinge la CPU al massimo per
   1-3 secondi solo quando apri un'app, poi torna a riposo. Fino al 40% di
   lancio app più veloce secondo Microsoft"
3. (9-14s) Testo: "È automatico, attivo di default con l'update di agosto 2026
   su Windows 11 24H2/25H2 — non c'è nessun interruttore da cercare"
4. (14-21s) Pivot al prodotto: "Ma tutto il resto che rallenta il PC — avvio
   automatico pieno di programmi, Game DVR, piano energia bilanciato — Windows
   non lo tocca da solo" → screen recording: apri PC Tweaker, mostra la lista
   programmi di avvio automatico o il preset "Turbo Gaming"
5. (21-26s) Mostra il rollback one-click (coerenza col resto del canale)
6. (26-28s) CTA verbale + testo: "Cerca 'PC Tweaker' — link in bio"

**Caption:**
"Windows 11 si è appena velocizzato da solo (Low Latency Profile, agosto 2026) — ma il resto tocca ancora a te 🚀 #windows11 #windowsupdate #pcoptimization #pctips #tech"

---

## Aggiornamento 13 agosto 2026 — nuovo angle di attualità: Copilot Actions / Agent Workspace

Ricerca aggiuntiva per questo giro di manutenzione (gap trovato: gli angle attuali
coprono performance/privacy "classica" ma non la nicchia "AI & Technology" che a
metà 2026 è tra le più cercate su Shorts insieme al micro-learning — qui serve
comunque un fatto verificabile, non solo il trend).

- **Cos'è**: Microsoft sta portando su Windows 11 un'AI agentica — "Copilot
  Actions" — che gira dentro un "Agent Workspace": un account Windows separato,
  a privilegi ridotti, isolato dalla sessione dell'utente, in cui l'agente può
  aprire app, cliccare, digitare, modificare file e comporre email al posto tuo.
  Annunciato ufficialmente da Microsoft in un post sul blog Windows Experience.
  ([blogs.windows.com](https://blogs.windows.com/windowsexperience/2025/10/16/securing-ai-agents-on-windows/), [bleepingcomputer.com](https://www.bleepingcomputer.com/news/microsoft/microsoft-debuts-copilot-actions-for-agentic-ai-driven-windows-tasks/))
- **Stato ad agosto 2026**: resta in preview, disponibile solo per chi è
  iscritto al programma Windows Insider — non è ancora una feature attiva per
  l'utente medio. La visione completa di "OS agentico" che Microsoft ha
  presentato non è attesa in rilascio generale prima del 2027. Importante per
  non promettere nel video qualcosa che l'utente non vede ancora sul proprio PC.
  ([bleepingcomputer.com](https://www.bleepingcomputer.com/news/microsoft/microsoft-debuts-copilot-actions-for-agentic-ai-driven-windows-tasks/))
- **Disattivata di default**: è dietro un toggle unico in Impostazioni > Sistema
  > Componenti AI > Strumenti agente > "Funzionalità agentiche sperimentali",
  richiede permessi da amministratore e si applica a tutto il dispositivo — va
  attivata volontariamente, non parte da sola. ([learn.microsoft.com — Windows 11 security book](https://learn.microsoft.com/en-us/windows/security/book/operating-system-agentic-security))
- **Perché è un angle utile**: intercetta chi cerca "AI che controlla il PC" /
  "Copilot Actions" mentre la notizia è ancora fresca (metà 2026), e la
  posizione naturale per un canale che vende "controllo e reversibilità" è
  spiegare cosa fa davvero questa funzione prima che lo faccia un titolo
  clickbait allarmistico — coerente col Video 4 (onestà verso funzionalità
  Microsoft, non disprezzo). ([techradar.com](https://www.techradar.com/computing/windows/hate-copilot-in-windows-11-free-privacy-tools-can-now-get-rid-of-the-ai))
- **Attenzione**: PC Tweaker NON ha (e questo script non deve promettere) un
  tweak per disattivare Copilot Actions — la funzione si disattiva già con un
  solo toggle nativo di Windows, quindi non serve un tweak dedicato nell'app.
  Il pivot onesto è verso la categoria **Privacy** che l'app ha già oggi (vedi
  `tweaks.rs`): dati diagnostici, advertising ID, geolocalizzazione — leve
  verificate e reversibili, non la funzione agentica in sé.

---

## Video 8 — "Windows sta testando un'AI che clicca da sola sul tuo PC" (News Reactor + Contrarian onesto)

Angolo di attualità nella nicchia AI & Technology (tra le più cercate su Shorts
a metà 2026): Microsoft sta facendo testare a un gruppo ristretto di utenti
un'intelligenza artificiale che può usare il PC al posto loro. Notizia vera,
ma va raccontata con lo stato reale (preview, opt-in, non ancora per tutti) —
niente titoli allarmistici tipo "la tua AI controlla già tutto".

**Hook (0-3s) — dev'essere presente TUTTO insieme: movimento + voce + testo:**
> (movimento: mostra un cursore che si muove e clicca da solo su un'app, come
> se nessuno stesse toccando il mouse) + voce: *"Microsoft sta testando un'AI
> che apre le tue app e clicca al posto tuo — ecco cosa sappiamo davvero"* +
> testo overlay identico

**Shot list:**
1. (0-3s) Hook come sopra
2. (3-9s) Testo: "Si chiama Copilot Actions, gira in un 'Agent Workspace' —
   un account Windows separato e isolato, non il tuo. Per ora solo per chi è
   iscritto a Windows Insider"
3. (9-15s) Testo: "È spenta di default — va attivata a mano in Impostazioni,
   un solo interruttore, richiede permessi da amministratore"
4. (15-21s) Pivot al prodotto: "Se invece vuoi ridurre subito quanto Windows
   raccoglie di te OGGI (non tra un anno)" → screen recording: apri PC Tweaker
   → categoria Privacy → mostra i toggle reali (dati diagnostici, advertising
   ID, geolocalizzazione)
5. (21-26s) Mostra il rollback one-click (coerenza col resto del canale)
6. (26-28s) CTA verbale + testo: "Cerca 'PC Tweaker' — link in bio"

**Caption:**
"Microsoft sta testando un'AI che usa il PC al posto tuo (per ora solo in preview, spenta di default) — nel frattempo tieni tu il controllo di cosa Windows raccoglie 🤖 #windows11 #ai #copilot #privacy #pctips"

---

## Aggiornamento 23 agosto 2026 — colma gap: KB5121003 nel pool automatico

Ricerca aggiuntiva per questo giro di manutenzione (gap trovato: il Video 7
copre solo il Low Latency Profile per app di questo stesso update, ma tre
altre novità concrete e verificabili di KB5121003 non erano ancora né in
questo file né — soprattutto — nel pool automatico `content.py`, l'unico che
genera davvero i video pubblicati senza ripresa manuale).

Rilascio: **KB5121003**, Patch Tuesday 11 agosto 2026, build 26100.9168
(Windows 11 24H2) / 26200.9168 (25H2). Fonti generali:
([pureinfotech.com](https://pureinfotech.com/kb5121003-windows-11-august-2026-update/), [windowscentral.com](https://www.windowscentral.com/microsoft/windows-11/biggest-changes-microsoft-is-rolling-out-in-august-for-windows-11), [windowslatest.com](https://www.windowslatest.com/2026/08/11/i-tested-windows-11-august-2026-update-heres-everything-new-improved-and-fixed/))

- **Windows Hello Enhanced Sign-in Security (ESS) su lettori di impronte
  esterni**: prima limitata ai sensori integrati, ora ESS funziona anche con
  lettori USB esterni compatibili (processore sicuro dedicato, template
  dell'impronta salvato sul dispositivo, certificato Microsoft), utile per
  desktop e PC senza sensore integrato. Richiede comunque TPM 2.0 e VBS
  attivi. ([windowsforum.com](https://windowsforum.com/windows-news.4/windows-hello-ess-now-supports-external-peripherals-in-feb-2026-update.402581/), [windowsnews.ai](https://windowsnews.ai/article/windows-11-brings-enhanced-sign-in-security-to-usb-fingerprint-readers-in-august-update.441238))
- **Disinstallazione dei modelli AI su PC Copilot+**: i PC Copilot+ arrivano
  con componenti AI on-device preinstallati (es. Image Generation); con
  KB5121003 diventano disinstallabili invece di restare installati e attivi
  anche per chi non li usa mai. Non rimuove l'app Copilot in sé, solo questi
  componenti specifici. ([windowsforum.com](https://windowsforum.com/windows-news.4/kb5121003-lets-copilot-pcs-remove-image-generation-ai.442742/), [notebookcheck.net](https://www.notebookcheck.net/Windows-11-ships-nine-AI-components-you-can-delete-one.1364313.0.html))
- **File Explorer, dimensioni file con l'unità corretta**: prima elencava
  tutto in KB indipendentemente dalla dimensione reale, ora mostra KB/MB/GB
  in modo leggibile. ([pureinfotech.com](https://pureinfotech.com/kb5121003-windows-11-august-2026-update/))
- **Click centrale per aprire una cartella in una nuova tab**: dalla barra
  degli indirizzi o dalla Home di File Explorer, il click centrale ora apre
  la cartella in una tab invece di sostituire quella corrente.
  ([pureinfotech.com](https://pureinfotech.com/kb5121003-windows-11-august-2026-update/))

Aggiunti a `content.py` (pool automatico): nuovo topic list-tease
`windows_2026_update` con tutti e quattro i punti sopra più il Low Latency
Profile del Video 7, più due item singoli (mistakewarning: disinstallazione
AI Copilot+; beforeafter: Low Latency Profile sui lanci app) — stesso schema
già usato per Copilot/Recall il 2026-08-20.

---

## Video 9 — "L'update di Windows 11 di agosto ha cambiato più cose di quanto pensi" (List Tease + News Reactor)

Angolo di attualità (KB5121003, notizia dei giorni immediatamente precedenti
alla ripresa) — copre i quattro punti sopra in formato lista, coerente col
Video 2 (List Tease è tra le formule con le performance migliori nel 2026).

**Hook (0-3s) — dev'essere presente TUTTO insieme: movimento + voce + testo:**
> (movimento: scorri velocemente le nuove Impostazioni di Windows 11) + voce:
> *"L'ultimo aggiornamento di Windows 11 ha cambiato più cose di quanto
> pensi"* + testo overlay identico

**Shot list:**
1. (0-3s) Hook come sopra
2. (3-9s) "Numero uno: ora puoi usare un lettore di impronte USB esterno per
   il login sicuro, non solo quello integrato nel laptop"
3. (9-14s) "Numero due: sui PC Copilot+ puoi finalmente disinstallare i
   modelli AI che non usi, non restano più lì a occupare spazio"
4. (14-19s) "Numero tre: File Explorer finalmente mostra le dimensioni in
   KB, MB o GB invece che tutto in KB"
5. (19-24s) Pivot al prodotto: "Ma le impostazioni che rallentano davvero il
   PC — avvio automatico, piano energia, Game DVR — restano da sistemare tu"
   → screen recording: apri PC Tweaker
6. (24-27s) CTA verbale + testo: "Cerca 'PC Tweaker' — link in bio"

**Caption:**
"L'update di agosto 2026 di Windows 11 (KB5121003) ha cambiato più cose di quanto sembri — impronte esterne, AI disinstallabile su Copilot+, File Explorer finalmente leggibile 📋 #windows11 #windowsupdate #pctips #techtok #windows11tips"

---

## Note di pubblicazione

- Posta Video 1 per primo (hook più forte secondo i dati, bassa barriera di ripresa).
- Esporta **due file separati** per TikTok e Instagram (niente watermark riciclato,
  penalizza la reach su IG) — stesso contenuto, hashtag diverse (IG: 5-8 mirate).
- Durata: resta su 15-30s nonostante la tendenza 2026 a premiare sessioni più
  lunghe — per una nicchia "quick tip" il completion rate conta più della
  durata assoluta.
- Orario consigliato: 19-21 (target gamer/PC enthusiast, dopo cena/scuola-lavoro).
- Se un video prende trazione, rispondi ai commenti nelle prime 2 ore — l'algoritmo
  premia l'engagement rapido più di quello tardivo.
- Video 4 è il più delicato: nomina la concorrenza solo se ti senti a tuo agio,
  non è obbligatorio — funziona anche saltandolo.
- Video 5 è legato a una notizia (estensione ESU) — girarlo e pubblicarlo
  entro poche settimane da quando leggi questo, prima che la notizia sia
  troppo vecchia o troppo nota per fare da hook efficace.
- Video 6 è legato al rilascio di Windows 11 26H2 (fine settembre–ottobre
  2026) — pubblicarlo nelle 1-2 settimane prima della data stimata di
  rilascio, quando il volume di ricerca sul nome della versione inizia a
  salire ma prima che sia saturo di contenuti simili.
- Video 7 è legato a una notizia freschissima (KB5121003, agosto 2026) —
  girarlo e pubblicarlo nei prossimi giorni, prima che smetta di essere
  notizia recente e diventi risaputo.
- Video 8 è sulla nicchia AI & Technology (Copilot Actions/Agent Workspace):
  la funzione è ancora in preview Insider ad agosto 2026, quindi il video
  resta valido più a lungo dei Video 5/7 (non è legato a una finestra di poche
  settimane) — ma se Microsoft la porta in rilascio generale, va ricontrollato
  lo stato prima di ripubblicarlo o riproporlo.

## Fonti

- [The Viral Hook Formula: Win a TikTok's First 3 Seconds](https://riffkit.ai/blog/viral-hook-formula)
- [The First 3 Seconds: How to Hook Viewers on TikTok & Reels](https://www.go-viral.app/blog/hook-first-3-seconds/)
- [We Analyzed 4,000 TikTok & Instagram Videos — what goes viral in 2026](https://thecontentlabs.app/blog/what-goes-viral-in-2026-data-study)
- [Instagram Reels vs TikTok vs YouTube Shorts 2026](https://www.techwyse.com/blog/infographic/best-short-video-platform-2026-instagram-reels-tiktok-youtube-shorts)
- [Esempio di contenuto virale esistente nella stessa nicchia](https://www.tiktok.com/@thesoaptech/video/7390890131617549600)
- [Microsoft quietly extends free Windows 10 ESU support to October 2027 — BleepingComputer](https://www.bleepingcomputer.com/news/microsoft/microsoft-quietly-extends-free-windows-10-esu-support-to-october-2027/)
- [Microsoft quietly extends Windows 10's extra security updates program for free until Oct 2027 — Windows Central](https://www.windowscentral.com/microsoft/windows-10/microsoft-quietly-extends-windows-10s-extra-security-updates-program-for-free-users-can-now-stay-on-windows-10-until-october-2027-securely)
- [Extended Security Updates (ESU) program for Windows 10 — pagina ufficiale Microsoft Learn](https://learn.microsoft.com/en-us/windows/whats-new/extended-security-updates)
- [Windows 10 support quietly extended until Oct 2027, as users reject Windows 11 — Windows Latest](https://www.windowslatest.com/2026/06/25/windows-10-support-quietly-extended-until-oct-2027-as-users-reject-windows-11/)
- [Microsoft extends Windows 10 update program as users refuse to upgrade — Cybernews](https://cybernews.com/tech/microsoft-windows-10-update-program-extended/)
- [Here's when Windows 11 26H2 will roll out, and what's actually new on existing PCs — Windows Latest](https://www.windowslatest.com/2026/08/05/windows-11-26h2-release-date-roll-out-time-line-and-whats-actually-new/)
- [Windows 11 26H2 arrives in October. Here's why you shouldn't skip it — PCWorld](https://www.pcworld.com/article/3206876/windows-11-26h2-arrives-in-october-heres-why-you-shouldnt-skip-it.html)
- [Windows 11 26H2 is coming: Meet all the new features — PCWorld](https://www.pcworld.com/article/3063498/windows-11-26h2-is-coming-meet-all-the-new-features.html)
- [Windows 11's annual 2026 update is almost here — 10 things you need to know before upgrading — Windows Central](https://www.windowscentral.com/microsoft/windows-11/windows-11-version-26h2-2026-update-10-things-to-know)
- [Report claims Nvidia will not be releasing any new RTX gaming GPUs in 2026, RTX 60 series likely debuting in 2028 — Tom's Hardware](https://www.tomshardware.com/pc-components/gpus/report-claims-nvidia-will-not-be-releasing-any-new-rtx-gaming-gpus-in-2026-rtx-60-series-likely-debuting-in-2028)
- [Windows 11's New Low Latency Profile Pushes Your CPU Into Short Overclocking Bursts To Kill Start Menu Stutter — Wccftech](https://wccftech.com/windows-11s-new-low-latency-profile-pushes-your-cpu-into-short-overclocking-bursts-to-kill-start-menu-stutter/)
- [I tested Windows 11's hidden Low Latency Profile, and budget PCs are about to feel premium — Windows Latest](https://www.windowslatest.com/2026/05/08/i-tested-windows-11s-hidden-low-latency-profile-and-budget-pcs-are-about-to-feel-premium/)
- [Windows 11's faster app launches released today, enable it using these steps — Windows Latest](https://www.windowslatest.com/2026/08/12/windows-11s-faster-app-launches-released-today-enable-it-using-these-steps/)
- [Confused about Windows 11's Low Latency Profile? Here is what it actually does — Windows Central](https://www.windowscentral.com/microsoft/windows-11/confused-about-low-latency-profile-on-windows-11-heres-what-we-know-so-far)
- [Securing AI agents on Windows — Windows Experience Blog (Microsoft, ufficiale)](https://blogs.windows.com/windowsexperience/2025/10/16/securing-ai-agents-on-windows/)
- [Microsoft debuts Copilot Actions for agentic AI-driven Windows tasks — BleepingComputer](https://www.bleepingcomputer.com/news/microsoft/microsoft-debuts-copilot-actions-for-agentic-ai-driven-windows-tasks/)
- [Windows 11 security book — Operating system agentic security — Microsoft Learn](https://learn.microsoft.com/en-us/windows/security/book/operating-system-agentic-security)
- [Hate Copilot in Windows 11? Free privacy tools can now get rid of the AI — TechRadar](https://www.techradar.com/computing/windows/hate-copilot-in-windows-11-free-privacy-tools-can-now-get-rid-of-the-ai)
- [Windows 11 August 2026 update KB5121003 is packed with useful improvements, and here's everything new — Pureinfotech](https://pureinfotech.com/kb5121003-windows-11-august-2026-update/)
- [Windows 11's August Patch Tuesday update is rolling out today — Windows Central](https://www.windowscentral.com/microsoft/windows-11/biggest-changes-microsoft-is-rolling-out-in-august-for-windows-11)
- [I tested Windows 11 August 2026 update, here's everything new, improved, and fixed — Windows Latest](https://www.windowslatest.com/2026/08/11/i-tested-windows-11-august-2026-update-heres-everything-new-improved-and-fixed/)
- [Windows Hello ESS Now Supports External Peripherals in Feb 2026 Update — Windows Forum](https://windowsforum.com/windows-news.4/windows-hello-ess-now-supports-external-peripherals-in-feb-2026-update.402581/)
- [Windows 11 Brings Enhanced Sign-in Security to USB Fingerprint Readers in August Update — Windows News](https://windowsnews.ai/article/windows-11-brings-enhanced-sign-in-security-to-usb-fingerprint-readers-in-august-update.441238)
- [KB5121003 Lets Copilot+ PCs Remove Image Generation AI — Windows Forum](https://windowsforum.com/windows-news.4/kb5121003-lets-copilot-pcs-remove-image-generation-ai.442742/)
- [Windows 11 ships nine AI components, you can delete one — Notebookcheck](https://www.notebookcheck.net/Windows-11-ships-nine-AI-components-you-can-delete-one.1364313.0.html)
