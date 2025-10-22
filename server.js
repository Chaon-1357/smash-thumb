// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";
import url from "url";

const app = express();
app.use(cors());

// __dirname の正しい取得（ESM）
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Helper: 試す URL のリストを作る（char, color を受けて優先度高→低の候補を返す）
function buildCandidateUrls(char, color) {
  // normalize
  const c = String(char).trim().toLowerCase();
  const col = String(color).trim();

  // 公式観察に基づく候補パターン（優先順）
  // 1) main{color}.png  (例 main1.png / main3.png)
  // 2) main{color} without underscore if needed (not necessary here)
  // 3) main.png (some characters only have main.png)
  // 4) main_01.png fallback variants (older patterns)
  const candidates = [];

  // try main{color}.png if color provided and non-empty
  if (col) {
    candidates.push(`https://www.smashbros.com/assets_v2/img/fighter/${encodeURIComponent(c)}/main${encodeURIComponent(col)}.png`);
    // also try without direct number (e.g. main_01 or main_01? older variants)
    candidates.push(`https://www.smashbros.com/assets_v2/img/fighter/${encodeURIComponent(c)}/main_${encodeURIComponent(col)}.png`);
    // sometimes the numbering is like main01
    candidates.push(`https://www.smashbros.com/assets_v2/img/fighter/${encodeURIComponent(c)}/main0${encodeURIComponent(col)}.png`);
  }

  // try plain main.png
  candidates.push(`https://www.smashbros.com/assets_v2/img/fighter/${encodeURIComponent(c)}/main.png`);

  // final fallback: older path style (if any)
  candidates.push(`https://www.smashbros.com/assets/img/fighter/${encodeURIComponent(c)}/main.png`);

  // remove duplicates
  return [...new Set(candidates)];
}

// Fetch helper: try candidate urls in order and return first successful Response
async function fetchFirstOk(urls) {
  for (const u of urls) {
    try {
      console.log(`Trying: ${u}`);
      const resp = await fetch(u, { method: "GET" });
      console.log(` -> status ${resp.status} for ${u}`);
      if (resp.ok && resp.headers.get("content-type")?.startsWith("image")) {
        return { resp, url: u };
      }
    } catch (err) {
      console.warn(`Fetch error for ${u}:`, err.message || err);
      // continue to next candidate
    }
  }
  return null;
}

app.get("/image", async (req, res) => {
  const { char, color } = req.query;
  if (!char) return res.status(400).send("Missing 'char' parameter");

  try {
    const candidates = buildCandidateUrls(char, color || "");
    const result = await fetchFirstOk(candidates);

    if (!result) {
      console.error("❌ No candidate image succeeded. Tried:", candidates);
      return res.status(404).send("Character image not found");
    }

    const { resp, url: okUrl } = result;
    console.log(`✅ Found image at ${okUrl} (status ${resp.status})`);
    // stream the image back to client
    res.set("Content-Type", resp.headers.get("content-type") || "image/png");
    // pipe the readable stream
    resp.body.pipe(res);
  } catch (err) {
    console.error("❌ Image fetch failed (server error):", err);
    res.status(500).send("Image fetch failed");
  }
});

// health / root
app.get("/", (req, res) => {
  res.send("Smash Thumbnail Server Running ✅");
});

// single listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Smash Thumbnail Server running on port ${PORT}`);
});
