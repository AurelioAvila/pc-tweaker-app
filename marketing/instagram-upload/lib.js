// Instagram Graph API client (mirrors the getcertsprint bot's
// src/instagram_upload.py). Credentials come from (in order of priority):
// 1. credentials.json in this folder (written by get-token.js)
// 2. env vars PCTWEAKER_IG_ACCESS_TOKEN / PCTWEAKER_IG_USER_ID
//
// Flow: create media container (video_url + caption) -> poll status ->
// publish. video_url must be a publicly reachable URL - see github-host.js
// for how a local mp4 gets one.

const fs = require("fs");
const path = require("path");

// This bot uses the Instagram API with Instagram Login (Instagram Business
// Login) rather than the older Facebook-Login-for-Business flow - the
// account was added as an "Instagram tester" on the Meta app and its token
// was generated directly from the app's API Setup panel, bypassing the
// Page-to-Instagram linking step entirely (that link kept failing with a
// persistent Meta-side "collegamento non disponibile" error unrelated to
// permissions). Tokens from this flow are scoped to graph.instagram.com,
// NOT graph.facebook.com, and use an app-scoped IG user ID that differs
// from the legacy Facebook-linked Instagram Business Account ID.
const API_BASE = "https://graph.instagram.com/v21.0";
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");
const POLL_INTERVAL_MS = 10000;
const POLL_TIMEOUT_MS = 300000;

// L'account a cui questo uploader DEVE pubblicare. Vedi assertAccount().
const EXPECTED_USERNAME = "pctweaker10";

// PRIORITA' INVERTITA + NOMI CON PREFISSO (2026-08-06). Il bug piu' costoso
// di tutto l'ecosistema stava in queste righe: le variabili d'ambiente si
// chiamavano IG_ACCESS_TOKEN/IG_USER_ID, nomi GENERICI condivisi con
// certsprint-bot e solofounded-bot, e vincevano su credentials.json. Su
// questa macchina esistono come variabili utente di Windows e contengono le
// credenziali di @solo_founded (impostate per un test locale di quel bot):
// dal 2026-08-01 OGNI Reel di PC Tweaker e' stato pubblicato su
// @solo_founded, con HTTP 200, media_id valido e log "[OK] Published".
// Verificato risolvendo i media_id "fantasma" col token d'ambiente: erano
// Reel PC Tweaker (#windows11 #pcoptimization) sul profilo sbagliato.
// Il file credentials.json, che e' per definizione specifico di QUESTA
// cartella e di QUESTO account, ha ora la precedenza; le env var restano
// come ripiego ma solo con un nome che non puo' collidere con altri bot.
function loadCredentials() {
  if (fs.existsSync(CREDENTIALS_PATH)) {
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  }
  if (process.env.PCTWEAKER_IG_ACCESS_TOKEN && process.env.PCTWEAKER_IG_USER_ID) {
    return {
      igAccessToken: process.env.PCTWEAKER_IG_ACCESS_TOKEN,
      igUserId: process.env.PCTWEAKER_IG_USER_ID,
    };
  }
  throw new Error(
    "No Instagram credentials found: run get-token.js to write credentials.json, or set PCTWEAKER_IG_ACCESS_TOKEN/PCTWEAKER_IG_USER_ID.",
  );
}

// Rete di sicurezza indipendente dal punto sopra: prima di pubblicare
// chiediamo all'API a CHI appartiene davvero il token e ci fermiamo se non
// e' l'account atteso. Una credenziale sbagliata e' altrimenti
// indistinguibile da una giusta - l'API risponde 200 e pubblica felicemente
// altrove, che e' esattamente come il bug e' rimasto invisibile per giorni.
// Costa una GET per Reel: nulla, rispetto a pubblicare su un altro profilo.
async function assertAccount(igUserId, igAccessToken) {
  const resp = await fetch(`${API_BASE}/${igUserId}?fields=username`, {
    headers: authHeaders(igAccessToken),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Impossibile verificare l'account Instagram: ${JSON.stringify(data)}`);
  }
  if (data.username !== EXPECTED_USERNAME) {
    throw new Error(
      `ACCOUNT SBAGLIATO: le credenziali puntano a @${data.username}, non a @${EXPECTED_USERNAME}. ` +
        `Pubblicazione annullata. Controlla credentials.json in ${CREDENTIALS_PATH}.`,
    );
  }
}

// AUTENTICAZIONE (corretta il 2026-08-04): il token va nell'header
// "Authorization: Bearer", NON come campo access_token nel body.
//
// Il flusso "Instagram API with Instagram Login" (host graph.instagram.com,
// token con prefisso IGAA - quello che usa questo account) vuole l'header
// Bearer; passare access_token come parametro e' lo stile del vecchio flusso
// Facebook-Page-linked su graph.facebook.com. Le chiamate di LETTURA
// tollerano entrambi, ed e' per questo che il bug e' rimasto invisibile:
// media, insights e perfino la creazione del container rispondevano
// correttamente.
//
// media_publish invece NO: con l'auth in stile legacy rispondeva HTTP 200
// con un media_id dall'aria valida, ma il post non veniva mai creato -
// nessuna eccezione, log "[OK] Published", e nulla sull'account. Verificato
// il 2026-08-04: 15+ pubblicazioni consecutive dal 2026-08-01 tutte
// fantasma, media_count fermo a 11, content_publishing_limit con
// quota_usage 0 (Instagram non contava nemmeno un tentativo), mentre una
// pubblicazione manuale dall'app funzionava perfettamente. certsprint-bot e
// i brand Shopify, che usano da sempre l'header Bearer, non hanno mai avuto
// il problema.
function authHeaders(igAccessToken) {
  return { Authorization: `Bearer ${igAccessToken}` };
}

async function createContainer(igUserId, igAccessToken, videoUrl, caption) {
  // is_ai_generated: "true" (2026-08-05): l'AI Act europeo (Articolo 50) e'
  // legalmente vincolante dal 2026-08-02 (multe fino a 15M euro o 3% del
  // fatturato) per contenuto generato/manipolato da IA non etichettato -
  // ogni Reel qui usa voce sintetica e script generati. E' il parametro
  // NATIVO documentato da Meta, non solo un hashtag: Instagram applica da
  // solo l'etichetta "AI info" visibile sul post.
  const resp = await fetch(`${API_BASE}/${igUserId}/media`, {
    method: "POST",
    headers: {
      ...authHeaders(igAccessToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    // audio_name (2026-08-06): l'algoritmo tratta l'audio come un tag di
    // metadati con una propria pagina che raccoglie tutti i reel che lo
    // usano - un nome brandizzato coerente la trasforma in un hub del
    // brand e aggiunge la keyword "Windows" alla ricerca. La musica di
    // libreria via API non esiste: va incorporata nel file video.
    body: new URLSearchParams({
      media_type: "REELS",
      video_url: videoUrl,
      caption,
      is_ai_generated: "true",
      audio_name: "PC Tweaker Windows Tips",
    }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Media container creation failed (${resp.status}): ${JSON.stringify(data)}`);
  }
  return data.id;
}

async function pollContainerStatus(creationId, igAccessToken) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const resp = await fetch(
      `${API_BASE}/${creationId}?${new URLSearchParams({ fields: "status_code" })}`,
      { headers: authHeaders(igAccessToken) },
    );
    const data = await resp.json();
    if (data.status_code === "FINISHED" || data.status_code === "ERROR") return data.status_code;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return "TIMEOUT";
}

async function publish(igUserId, igAccessToken, creationId) {
  const resp = await fetch(`${API_BASE}/${igUserId}/media_publish`, {
    method: "POST",
    headers: {
      ...authHeaders(igAccessToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ creation_id: creationId }),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`media_publish failed (${resp.status}): ${JSON.stringify(data)}`);
  }
  return data.id;
}

async function uploadReel({ videoUrl, caption }) {
  const { igAccessToken, igUserId } = loadCredentials();
  await assertAccount(igUserId, igAccessToken);

  const creationId = await createContainer(igUserId, igAccessToken, videoUrl, caption);
  const status = await pollContainerStatus(creationId, igAccessToken);
  if (status !== "FINISHED") {
    throw new Error(`Instagram media container did not finish processing (status=${status})`);
  }

  const mediaId = await publish(igUserId, igAccessToken, creationId);
  console.log(`[OK] Published to Instagram: media_id=${mediaId}`);
  return { mediaId };
}

module.exports = { uploadReel };
