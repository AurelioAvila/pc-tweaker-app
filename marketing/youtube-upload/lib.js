const fs = require("fs");
const path = require("path");
const http = require("http");
const { exec } = require("child_process");
const { google } = require("googleapis");

const DIR = __dirname;
const TOKEN_PATH = path.join(DIR, "token.json");
const PORT = 51789;
const REDIRECT_URI = `http://localhost:${PORT}`;
// yt-analytics.readonly aggiunto 2026-08-04: la scope "youtube" sopra da'
// upload/lettura Data API ma non la YouTube Analytics API (retention/watch-
// time per video, la metrica che decide se un video viene spinto oltre il
// pool di test iniziale - vedi project_growth_algorithm_research_2026_08_04
// in memoria). Va abilitata anche "YouTube Analytics API" nello stesso
// progetto Google Cloud, altrimenti le chiamate falliscono con "API not
// enabled" anche con lo scope giusto sul token.
const SCOPES = [
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

function findClientSecretFile() {
  const file = fs.readdirSync(DIR).find((f) => f.startsWith("client_secret") && f.endsWith(".json"));
  if (!file) {
    throw new Error("No client_secret_*.json found in this folder. Download it from Google Cloud Console.");
  }
  return path.join(DIR, file);
}

function loadOAuthClient() {
  const raw = JSON.parse(fs.readFileSync(findClientSecretFile(), "utf8"));
  const creds = raw.installed || raw.web;
  return new google.auth.OAuth2(creds.client_id, creds.client_secret, REDIRECT_URI);
}

function getNewToken(oauth2Client) {
  return new Promise((resolve, reject) => {
    const authUrl = oauth2Client.generateAuthUrl({ access_type: "offline", scope: SCOPES, prompt: "consent" });

    const server = http.createServer(async (req, res) => {
      if (!req.url.startsWith("/")) return;
      const url = new URL(req.url, REDIRECT_URI);
      const code = url.searchParams.get("code");
      if (!code) return;
      res.end("Login completed — you can close this tab and go back to the terminal.");
      server.close();
      try {
        const { tokens } = await oauth2Client.getToken(code);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        oauth2Client.setCredentials(tokens);
        resolve(oauth2Client);
      } catch (err) {
        reject(err);
      }
    });

    server.listen(PORT, () => {
      console.log("Opening browser for one-time Google login...");
      console.log(authUrl);
      const opener = process.platform === "win32" ? `start "" "${authUrl}"` : `open "${authUrl}"`;
      exec(opener);
    });
  });
}

async function getAuthorizedClient() {
  const oauth2Client = loadOAuthClient();
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
  }
  return getNewToken(oauth2Client);
}

async function uploadVideo({ videoPath, title, description, tags = [], privacyStatus = "unlisted", thumbnailPath = null }) {
  const auth = await getAuthorizedClient();
  const youtube = google.youtube({ version: "v3", auth });
  // Trasparenza AI (2026-08-05): EU AI Act art. 50, applicabile dal 2 agosto
  // 2026 - il contenuto generato da AI va reso identificabile con marcatura
  // machine-readable. Questi video sono generati (script + voce TTS):
  // containsSyntheticMedia e' il campo che l'API espone apposta, "#ai" la
  // parte visibile a chi legge.
  if (!tags.some((t) => t.toLowerCase() === "ai")) tags = [...tags, "ai"];
  if (!description.toLowerCase().includes("#ai")) description = `${description.trimEnd()}\n\n#ai`;
  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: { title, description, tags, categoryId: "28" },
      status: { privacyStatus, selfDeclaredMadeForKids: false, containsSyntheticMedia: true },
    },
    media: { body: fs.createReadStream(videoPath) },
  });

  // Miniatura personalizzata (in pratica solo i long-form: sugli Shorts il
  // feed parte in autoplay e la miniatura conta pochissimo). Non deve MAI
  // far fallire una pubblicazione gia' andata a buon fine: i canali senza
  // numero di telefono verificato non possono impostarla e l'API rifiuta.
  if (thumbnailPath) {
    try {
      await youtube.thumbnails.set({
        videoId: res.data.id,
        media: { body: fs.createReadStream(thumbnailPath) },
      });
      console.log(`[thumbnail] miniatura personalizzata impostata su ${res.data.id}`);
    } catch (err) {
      console.warn(`[thumbnail] non impostata (${err.message}) - resta quella automatica`);
    }
  }

  return { id: res.data.id, url: `https://youtube.com/shorts/${res.data.id}` };
}

async function postComment({ videoId, text }) {
  // NOTA: la YouTube Data API v3 non espone un modo per FISSARE (pin) un
  // commento in cima - quello resta un passo manuale da YouTube Studio
  // (apri il video -> Commenti -> Fissa sul commento appena postato). Qui
  // possiamo solo pubblicarlo, non fissarlo.
  const auth = await getAuthorizedClient();
  const youtube = google.youtube({ version: "v3", auth });
  const res = await youtube.commentThreads.insert({
    part: ["snippet"],
    requestBody: {
      snippet: {
        videoId,
        topLevelComment: { snippet: { textOriginal: text } },
      },
    },
  });
  return res.data.id;
}

module.exports = { getAuthorizedClient, uploadVideo, postComment };
