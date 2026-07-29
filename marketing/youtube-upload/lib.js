const fs = require("fs");
const path = require("path");
const http = require("http");
const { exec } = require("child_process");
const { google } = require("googleapis");

const DIR = __dirname;
const TOKEN_PATH = path.join(DIR, "token.json");
const PORT = 51789;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPES = ["https://www.googleapis.com/auth/youtube"];

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

async function uploadVideo({ videoPath, title, description, tags = [], privacyStatus = "unlisted" }) {
  const auth = await getAuthorizedClient();
  const youtube = google.youtube({ version: "v3", auth });
  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: { title, description, tags, categoryId: "28" },
      status: { privacyStatus, selfDeclaredMadeForKids: false },
    },
    media: { body: fs.createReadStream(videoPath) },
  });
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
