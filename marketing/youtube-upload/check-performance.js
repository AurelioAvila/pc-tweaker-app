// Legge le view/like reali degli ultimi video pubblicati sul canale
// (usa lo stesso token.json con scope pieno "youtube" gia' usato da upload.js)
// e stampa una diagnosi views/ora, stessa logica di check_performance.py
// nel repo youtube-shorts-bot.
//
// Usage: node check-performance.js [maxResults]

const { google } = require("googleapis");
const { getAuthorizedClient } = require("./lib");

async function main() {
  const maxResults = parseInt(process.argv[2] || "20", 10);
  const auth = await getAuthorizedClient();
  const youtube = google.youtube({ version: "v3", auth });

  const channelRes = await youtube.channels.list({ part: ["contentDetails"], mine: true });
  const uploadsPlaylistId = channelRes.data.items[0].contentDetails.relatedPlaylists.uploads;

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

  console.log("Video pubblici (piu' recente prima):");
  for (const v of videos) {
    console.log(
      `  ${v.id}  ${v.published.toISOString().slice(0, 16).replace("T", " ")} UTC  ` +
        `${v.ageHours.toFixed(1)}h  ${v.views} views  (${v.vph.toFixed(2)}/h)  ${v.title}`
    );
  }

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
