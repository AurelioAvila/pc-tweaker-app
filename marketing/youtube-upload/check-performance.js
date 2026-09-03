// Reads the real views/likes of the most recently published videos on the
// channel (using the same token.json with the full "youtube" scope upload.js
// already uses) and prints a views/hour diagnosis, the same logic as
// check_performance.py in the youtube-shorts-bot repo.
//
// Usage: node check-performance.js [maxResults]

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { getAuthorizedClient } = require("./lib");

const YPP_SUBSCRIBER_TARGET = 1000;
const YPP_SHORTS_VIEWS_TARGET = 10_000_000; // views on public Shorts, last 90 days
const YPP_WATCH_HOURS_TARGET = 4000; // long-form alternative, last 12 months - not trackable here (needs the YouTube Analytics API)

// Added 2026-08-15: there was no persistence before, every run printed only
// the current snapshot with no way to see the trend over time. Same
// key-per-video shape as marketing/instagram-upload/check-performance.js
// (ig_performance_log.json), here for YouTube.
const LOG_PATH = path.join(__dirname, "yt_performance_log.json");

function loadLog() {
  if (!fs.existsSync(LOG_PATH)) return {};
  return JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
}

function saveLog(log) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

async function main() {
  const maxResults = parseInt(process.argv[2] || "20", 10);
  const auth = await getAuthorizedClient();
  const youtube = google.youtube({ version: "v3", auth });

  const channelRes = await youtube.channels.list({ part: ["contentDetails", "statistics", "snippet"], mine: true });
  const uploadsPlaylistId = channelRes.data.items[0].contentDetails.relatedPlaylists.uploads;
  const channelStats = channelRes.data.items[0].statistics;
  const channelTitle = channelRes.data.items[0].snippet.title;

  const itemsRes = await youtube.playlistItems.list({
    part: ["contentDetails"],
    playlistId: uploadsPlaylistId,
    maxResults,
  });
  const videoIds = itemsRes.data.items.map((i) => i.contentDetails.videoId);
  if (videoIds.length === 0) {
    console.log("Nessun video trovato.");
    return;
  }

  const videosRes = await youtube.videos.list({ part: ["snippet", "statistics", "status"], id: videoIds });
  const now = Date.now();

  const videos = videosRes.data.items
    .filter((v) => v.status.privacyStatus === "public")
    .map((v) => {
      const published = new Date(v.snippet.publishedAt);
      const ageHours = Math.max((now - published.getTime()) / 3600000, 0.1);
      const views = parseInt(v.statistics.viewCount || "0", 10);
      return {
        id: v.id,
        title: v.snippet.title,
        published,
        ageHours,
        views,
        likes: parseInt(v.statistics.likeCount || "0", 10),
        comments: parseInt(v.statistics.commentCount || "0", 10),
        vph: views / ageHours,
      };
    })
    .sort((a, b) => b.published - a.published);

  // Fixed TWICE on 2026-07-29: 1) summing only the videos returned in a
  // limited window undercounted, 2) channelStats.viewCount looked like the
  // right fix but updates with a real lag behind the per-video viewCount
  // (measured: 290 against a real 754 when summing the 5 videos). Fixed by
  // summing per-video views (the default maxResults is 20, already more than
  // this channel's real videoCount).
  const subs = parseInt(channelStats.subscriberCount || "0", 10);
  const totalViews = videos.reduce((sum, v) => sum + v.views, 0);
  const subsPct = Math.min(100, Math.round((100 * subs) / YPP_SUBSCRIBER_TARGET));
  const viewsPct = Math.min(100, Math.round((100 * totalViews) / YPP_SHORTS_VIEWS_TARGET));
  console.log(`\n=== Progresso monetizzazione (YPP) - ${channelTitle} ===`);
  console.log(`Iscritti: ${subs}/${YPP_SUBSCRIBER_TARGET} (${subsPct}%)`);
  console.log(`Views totali canale (somma di tutti i ${videos.length} video, accurato finche' il canale ha meno di 90gg di vita): ${totalViews.toLocaleString()}/${YPP_SHORTS_VIEWS_TARGET.toLocaleString()} (${viewsPct}%)`);
  console.log("Note: BOTH thresholds have to be reached (or the 4000-hour long-form alternative, not tracked here - it needs the separate Analytics API). Not every video on this channel is a pure Short, so the 4000-hour route may be more realistic than the Shorts one.\n");

  console.log("Video pubblici (piu' recente prima):");
  const now_iso = new Date().toISOString();
  const log = loadLog();
  for (const v of videos) {
    console.log(
      `  ${v.id}  ${v.published.toISOString().slice(0, 16).replace("T", " ")} UTC  ` +
        `${v.ageHours.toFixed(1)}h  ${v.views} views  (${v.vph.toFixed(2)}/h)  ${v.title}`
    );
    log[v.id] = {
      title: v.title,
      published: v.published.toISOString(),
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      vph: v.vph,
      checked_at: now_iso,
    };
  }
  saveLog(log);

  const mature = videos.filter((v) => v.ageHours >= 10);
  if (mature.length === 0) {
    console.log("\nNessun video abbastanza vecchio da valutare ancora.");
    return;
  }
  const vphs = mature.map((v) => v.vph).sort((a, b) => a - b);
  const medianVph = vphs[Math.floor(vphs.length / 2)];
  const threshold = medianVph * 0.4;
  const underperforming = mature.filter((v) => v.vph < threshold);

  console.log(`\nVideo valutati: ${mature.length} (mediana canale: ${medianVph.toFixed(2)} views/ora)`);
  console.log(`Sotto-performanti: ${underperforming.length}/${mature.length}\n`);
  for (const v of underperforming) {
    console.log(`  - ${v.title} -> ${v.views} views in ${v.ageHours.toFixed(0)}h (${v.vph.toFixed(2)}/h)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
