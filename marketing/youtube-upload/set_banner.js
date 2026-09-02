// Carica il channel banner (channelBanners.insert + brandingSettings.update).
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const DIR = __dirname;
const bannerPath = process.argv[2];
if (!bannerPath) {
  console.error("Uso: node set_banner.js <path-immagine-2560x1440>");
  process.exit(1);
}

function loadOAuthClient() {
  const secretFile = fs.readdirSync(DIR).find((f) => f.startsWith("client_secret") && f.endsWith(".json"));
  const raw = JSON.parse(fs.readFileSync(path.join(DIR, secretFile), "utf8"));
  const creds = raw.installed || raw.web;
  const client = new google.auth.OAuth2(creds.client_id, creds.client_secret, "http://localhost:51789");
  const tokens = JSON.parse(fs.readFileSync(path.join(DIR, "token.json"), "utf8"));
  client.setCredentials(tokens);
  return client;
}

async function main() {
  const auth = loadOAuthClient();
  const youtube = google.youtube({ version: "v3", auth });

  const channelsRes = await youtube.channels.list({ part: "id,snippet", mine: true });
  const channel = channelsRes.data.items[0];
  console.log("Canale:", channel.snippet.title, channel.id);

  const bannerRes = await youtube.channelBanners.insert({
    media: { body: fs.createReadStream(bannerPath) },
  });
  const bannerUrl = bannerRes.data.url;
  console.log("Banner caricato:", bannerUrl);

  await youtube.channels.update({
    part: ["brandingSettings"],
    requestBody: {
      id: channel.id,
      brandingSettings: {
        channel: {},
        image: { bannerExternalUrl: bannerUrl },
      },
    },
  });
  console.log("[OK] Channel art aggiornata.");
}

main().catch((err) => {
  console.error("Errore:", JSON.stringify(err.response ? err.response.data : err.message, null, 2));
  if (err.response) console.error("Config inviata:", JSON.stringify(err.response.config?.data));
  process.exit(1);
});
