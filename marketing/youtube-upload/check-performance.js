// Legge le view/like reali degli ultimi video pubblicati sul canale
// (usa lo stesso token.json con scope pieno "youtube" gia' usato da upload.js)
// e stampa una diagnosi views/ora, stessa logica di check_performance.py
// nel repo youtube-shorts-bot.
//
// Usage: node check-performance.js [maxResults]

const { google } = require("googleapis");
const { getAuthorizedClient } = require("./lib");

const YPP_SUBSCRIBER_TARGET = 1000;
const YPP_SHORTS_VIEWS_TARGET = 10_000_000; // views su Shorts pubblici, ultimi 90gg
const YPP_WATCH_HOURS_TARGET = 4000; // alternativa long-form, ultimi 12 mesi - non tracciabile qui (serve YouTube Analytics API)

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

  const subs = parseInt(channelStats.subscriberCount || "0", 10);
  const views90dApprox = videos.reduce((sum, v) => sum + v.views, 0);
  const subsPct = Math.min(100, Math.round((100 * subs) / YPP_SUBSCRIBER_TARGET));
  const viewsPct = Math.min(100, Math.round((100 * views90dApprox) / YPP_SHORTS_VIEWS_TARGET));
  console.log(`\n=== Progresso monetizzazione (YPP) - ${channelTitle} ===`);
  console.log(`Iscritti: ${subs}/${YPP_SUBSCRIBER_TARGET} (${subsPct}%)`);
  console.log(`Views Shorts (~ultimi 90gg, approssimato su ${videos.length} video): ${views90dApprox.toLocaleString()}/${YPP_SHORTS_VIEWS_TARGET.toLocaleString()} (${viewsPct}%)`);
  console.log("Nota: serve raggiungere ENTRAMBE le soglie (o l'alternativa 4000 ore long-form, non tracciata qui - richiede l'Analytics API separata). Su questo canale i video non sono tutti Short puri, quindi il percorso 4000 ore potrebbe essere piu' realistico di quello Shorts.\n");

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
