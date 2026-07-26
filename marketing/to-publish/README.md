# Come pubblicare un nuovo video

Metti in questa cartella due file con lo stesso nome:

- `nome-video.mp4`
- `nome-video.json`

Esempio di `nome-video.json`:

```json
{
  "title": "PC Tweaker - real tweaks for Windows",
  "description": "Every tweak has automatic rollback.\n\nSearch 'PC Tweaker' - link in bio.\n\n#Shorts #Windows #PCOptimization",
  "tags": ["windows tweak", "pc optimizer", "windows optimization", "gaming performance"]
}
```

Ogni 30 minuti un'attività pianificata di Windows ("PCTweakerYouTubeUpload")
controlla questa cartella. Se trova una coppia `.mp4`+`.json`, carica il
video su YouTube come **pubblico da subito** (nessuna revisione manuale,
scelta esplicita per automazione completa), poi sposta entrambi i file in
`marketing/published/` così non viene ricaricato.

Lo stesso file viene letto anche da `marketing/tiktok-upload/` e (una volta
completato il setup Instagram - vedi `marketing/instagram-upload/`) da
`marketing/instagram-upload/`: ognuno tiene il proprio log e pubblica in
autonomia, senza spostare/cancellare i file (solo lo script YouTube possiede
quel ciclo di vita).

Per controllare manualmente in qualsiasi momento, senza aspettare:

```bash
cd marketing/youtube-upload
node auto-upload.js
```

Log di tutti gli upload (video ID, URL, data): `marketing/youtube-upload/uploaded-log.json`.
