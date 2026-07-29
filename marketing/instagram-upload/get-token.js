// Run ONCE, locally, to get a long-lived Instagram Page access token +
// IG_USER_ID to save as credentials.
//
// Prerequisites (you do these, not automatable - see the getcertsprint
// bot's SETUP.md for the detailed click-by-click version, the steps below
// are the short version since a lot can be REUSED instead of redone):
// 1. Convert the PC Tweaker Instagram account to a Business account.
// 2. Create (or reuse an existing) Facebook Page and link it to that
//    Instagram account (Meta Business Suite -> Impostazioni -> Account
//    Instagram -> Aggiungi -> collega alla Pagina PC Tweaker).
// 3. Reuse the SAME Meta developer app already created for CertSprint
//    (developers.facebook.com/apps) if it's already been through the
//    "API Setup with Facebook login" wizard for permissions
//    instagram_basic / instagram_content_publish / pages_show_list /
//    pages_read_engagement (those permissions apply per-app, not
//    per-Page, so a second Page doesn't need to repeat that setup) -
//    OR create a second app if you'd rather keep the two products fully
//    separate. Either works.
// 4. Generate a short-lived User Access Token via Graph API Explorer
//    (developers.facebook.com/tools/explorer) with the same 4
//    permissions, for whichever app you used in step 3.
// 5. Set env vars before running this script:
//    APP_ID=...
//    APP_SECRET=...
//    SHORT_TOKEN=...
//
// NB: needs the Page to actually show a linked Instagram Business Account
// (Graph API field instagram_business_account) - if the getcertsprint bot
// hit Meta's device-trust hold when linking a fresh Page to Instagram,
// expect the same possibility here on a new/less-used device.

const fs = require("fs");
const path = require("path");

const API_BASE = "https://graph.facebook.com/v21.0";
const CREDENTIALS_PATH = path.join(__dirname, "credentials.json");

async function exchangeLongLivedToken(appId, appSecret, shortToken) {
  const resp = await fetch(
    `${API_BASE}/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortToken,
    })}`,
  );
  const data = await resp.json();
  if (!data.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function listPagesWithIgAccounts(longLivedUserToken) {
  const resp = await fetch(`${API_BASE}/me/accounts?${new URLSearchParams({ access_token: longLivedUserToken })}`);
  const data = await resp.json();
  const pages = data.data || [];

  const results = [];
  for (const page of pages) {
    const igResp = await fetch(
      `${API_BASE}/${page.id}?${new URLSearchParams({
        fields: "instagram_business_account",
        access_token: page.access_token,
      })}`,
    );
    const igData = await igResp.json();
    results.push({
      pageName: page.name,
      pageId: page.id,
      pageToken: page.access_token,
      igUserId: igData.instagram_business_account ? igData.instagram_business_account.id : null,
    });
  }
  return results;
}

async function getPageDirectly(longLivedUserToken, pageId) {
  // Bypasses /me/accounts, which can come back empty for Business
  // Portfolio-managed Pages even when you ARE an admin - queries this
  // specific Page's own access_token and linked Instagram account
  // directly instead. Discovered while setting up the getcertsprint bot.
  const resp = await fetch(
    `${API_BASE}/${pageId}?${new URLSearchParams({
      fields: "name,access_token,instagram_business_account",
      access_token: longLivedUserToken,
    })}`,
  );
  const data = await resp.json();
  return {
    pageName: data.name || pageId,
    pageId,
    pageToken: data.access_token,
    igUserId: data.instagram_business_account ? data.instagram_business_account.id : null,
  };
}

async function main() {
  const appId = process.env.APP_ID;
  const appSecret = process.env.APP_SECRET;
  const shortToken = process.env.SHORT_TOKEN;
  const pageId = process.env.PAGE_ID;
  if (!appId || !appSecret || !shortToken) {
    console.error("Set APP_ID, APP_SECRET and SHORT_TOKEN env vars first.");
    process.exit(1);
  }

  const longLived = await exchangeLongLivedToken(appId, appSecret, shortToken);
  const pages = pageId ? [await getPageDirectly(longLived, pageId)] : await listPagesWithIgAccounts(longLived);

  if (pages.length === 0 || !pages[0].pageToken) {
    console.log("No Facebook Pages found for this token. Make sure the token has pages_show_list scope,");
    console.log("or set PAGE_ID=<numeric Page ID> to query a Business-managed Page directly.");
    return;
  }

  let saved = null;
  for (const p of pages) {
    console.log(`Page: ${p.pageName} (${p.pageId})`);
    if (p.igUserId) {
      console.log(`  IG_USER_ID = ${p.igUserId}`);
      console.log(`  IG_ACCESS_TOKEN = ${p.pageToken}`);
      saved = p;
    } else {
      console.log("  No Instagram Business Account linked to this Page.");
    }
  }

  if (saved) {
    fs.writeFileSync(
      CREDENTIALS_PATH,
      JSON.stringify({ igUserId: saved.igUserId, igAccessToken: saved.pageToken }, null, 2),
    );
    console.log("\n=== Saved to credentials.json (used automatically by upload.js / auto-upload.js) ===");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
