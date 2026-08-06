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
