// Run ONCE, locally, to get a TikTok refresh token to save as secrets.
//
// Prerequisites (you do these, not automatable):
// 1. developers.tiktok.com -> create a new app for PC Tweaker (separate from
//    the getcertsprint one)
// 2. Add product "Login Kit" (Redirect URI, Web tab):
//    https://pc-tweaker-app-production.up.railway.app/tiktok-callback
// 3. Add product "Content Posting API", enable "Direct Post"
// 4. Set env vars before running this script:
//    TIKTOK_CLIENT_KEY=...
//    TIKTOK_CLIENT_SECRET=...
//
// NB: until the app passes TikTok's "Direct Post" audit, published videos
// stay SELF_ONLY (private draft) regardless of what's requested.

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { exec } = require("child_process");

const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");

const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT_URI = "https://pc-tweaker-app-production.up.railway.app/tiktok-callback";
const SCOPES = "user.info.basic,video.publish";

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

async function main() {
  if (!CLIENT_KEY || !CLIENT_SECRET) {
    console.error("Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET first.");
    process.exit(1);
  }

  const state = Math.random().toString(36).slice(2);
  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({
    client_key: CLIENT_KEY,
    scope: SCOPES,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    state,
  })}`;

  console.log("Opening browser for TikTok login...");
  const opener = process.platform === "win32" ? `start "" "${authUrl}"` : `open "${authUrl}"`;
  exec(opener);

  const code = (await prompt("\nAfter login, paste the 'code' shown on the callback page here: ")).trim();
  if (!code) {
    console.error("No code entered.");
    process.exit(1);
  }

  const tokenResp = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });
  const data = await tokenResp.json();

  if (!data.refresh_token) {
    console.error("TikTok did not return a refresh token. Check the app configuration and authorization.");
    return;
  }

  fs.writeFileSync(
    CREDENTIALS_PATH,
    JSON.stringify({ clientKey: CLIENT_KEY, clientSecret: CLIENT_SECRET, refreshToken: data.refresh_token }, null, 2),
  );

  // Never print credentials, including partial values or raw token responses.
  console.log("\n=== Saved to credentials.json (used automatically by upload.js / auto-upload.js) ===");
}

main();
