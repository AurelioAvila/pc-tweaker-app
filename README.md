# PC Tweaker

Un'app desktop per Windows (e in futuro macOS) che applica tweak di sistema —
performance, privacy, gaming, manutenzione — con **rollback automatico**:
ogni modifica salva il valore originale prima di essere applicata, così puoi
sempre tornare indietro con un click.

> Stato: prototipo funzionante, in sviluppo attivo. Non ancora distribuito
> pubblicamente — vedi [Download](#download) più sotto.

## Cosa fa

Ogni tweak è reale (nessun placeholder finto): legge/scrive il registro di
Windows, il piano di alimentazione, i DNS di rete o pulisce file — sempre con
uno snapshot precedente salvato per il ripristino.

- **Performance** — priorità processore, piano "Prestazioni elevate",
  disattivazione Xbox Game Bar/Game DVR
- **Gaming** — Pianificazione GPU con accelerazione hardware (HAGS),
  riduzione del ritardo di input (disattiva l'accelerazione del puntatore),
  Turbo Boost del processore, preset "Turbo Gaming" che li combina tutti
- **Privacy** — disattivazione ID pubblicitario, tracciamento posizione,
  ricerca Bing nel menu Start, riduzione telemetria, DNS privati (Cloudflare)
- **Manutenzione** — pulizia file temporanei e cache Windows Update (spostati
  nel Cestino, mai cancellati in modo definitivo), ricerca file duplicati per
  hash con revisione manuale prima dell'eliminazione
- **UI** — modalità scura, mostra file nascosti

Ogni tweak che richiede privilegi amministrativi chiede un consenso UAC
esplicito **solo per quell'azione** — l'app stessa gira sempre senza
privilegi elevati.

## Multi-lingua e temi

L'interfaccia è disponibile in **italiano, inglese, francese, spagnolo e
tedesco**, con più di 10 temi di colore selezionabili dal menu account.

## Modello Free / Pro

Tweak singoli gratuiti, tweak avanzati e applicazione in batch riservati a
Pro — pagamento unico, nessun abbonamento (via Stripe Checkout). Account con
email e password per sincronizzare lo stato Pro tra installazioni.

## Download

**[⬇ Scarica l'ultima release (v0.1.0)](../../releases/latest)** — installer
`.msi` o `.exe` per Windows x64.

Il repository è **privato**: il link funziona solo se hai accesso a questo
repo (per ora solo tu). L'installer non è ancora firmato digitalmente
(Authenticode) — Windows SmartScreen mostrerà un avviso ("Windows ha
protetto il tuo PC") alla prima esecuzione: è normale per un eseguibile non
firmato, clicca "Ulteriori informazioni" → "Esegui comunque".

Quando sarai pronto per una distribuzione pubblica reale: rendi il
repository pubblico, firma il pacchetto con un certificato Authenticode (per
far sparire l'avviso SmartScreen), ed eventualmente pubblica il link di
download anche sul tuo sito — posso occuparmi sia della pipeline di build
automatica ad ogni release che della pagina di download quando vuoi
procedere.

## Sviluppo

```bash
npm install
npm run tauri dev     # avvia l'app in modalità sviluppo
npm run tauri build   # produce l'installer .msi in src-tauri/target/release/bundle/
```

Richiede Rust (tramite [rustup](https://rustup.rs)) e, su Windows, i
[Build Tools per Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
con il workload "Sviluppo di applicazioni desktop con C++".

## Backend

Il backend Node.js/Express per account e pagamenti Stripe è in
[`backend/`](backend/) — vedi [`backend/README.md`](backend/README.md) per la
guida al deployment su Railway e alla configurazione di Stripe.

## Stack tecnico

[Tauri 2](https://tauri.app) (Rust) · React + TypeScript · Tailwind CSS 4 ·
Express + PostgreSQL + Stripe (backend)
