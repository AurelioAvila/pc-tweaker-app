// Instagram's Graph API needs a publicly reachable `video_url` to create a
// Reels media container - it does not accept a direct file upload like
// YouTube/TikTok's APIs do. Mirrors the getcertsprint bot's
// github_asset_host.py: hosts the mp4 as a GitHub Release asset in a small
// dedicated PUBLIC repo, hands Instagram that public URL, then deletes the
// release once publishing succeeds.
//
// Needs its own public repo (e.g. "pc-tweaker-marketing-assets", created
// once with at least one commit - an empty repo makes GitHub's Releases
// API 422 with "Repository is empty") and a PAT with `repo` scope, via:
//   ASSETS_REPO=owner/pc-tweaker-marketing-assets
//   ASSETS_REPO_TOKEN=...

const fs = require("fs");
const path = require("path");

const API_BASE = "https://api.github.com";
const UPLOAD_BASE = "https://uploads.github.com";

function headers() {
  return {
    Authorization: `Bearer ${process.env.ASSETS_REPO_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function uploadVideo(videoPath) {
  const repo = process.env.ASSETS_REPO;
  const tag = `reel-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const createResp = await fetch(`${API_BASE}/repos/${repo}/releases`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ tag_name: tag, name: tag, draft: false, prerelease: false }),
  });
  const release = await createResp.json();
  if (!createResp.ok) {
    throw new Error(`Release creation failed: ${JSON.stringify(release)}`);
  }

  const filename = path.basename(videoPath);
  const videoBytes = fs.readFileSync(videoPath);
  const uploadResp = await fetch(
    `${UPLOAD_BASE}/repos/${repo}/releases/${release.id}/assets?${new URLSearchParams({ name: filename })}`,
    {
      method: "POST",
      headers: { ...headers(), "Content-Type": "video/mp4" },
      body: videoBytes,
    },
  );
  const asset = await uploadResp.json();
  if (!uploadResp.ok) {
    throw new Error(`Asset upload failed: ${JSON.stringify(asset)}`);
  }

  return { url: asset.browser_download_url, releaseId: release.id };
}

async function deleteRelease(releaseId) {
  const repo = process.env.ASSETS_REPO;
  try {
    await fetch(`${API_BASE}/repos/${repo}/releases/${releaseId}`, { method: "DELETE", headers: headers() });
  } catch (err) {
    console.error("[github-host] cleanup failed (non-fatal):", err.message);
  }
}

module.exports = { uploadVideo, deleteRelease };
