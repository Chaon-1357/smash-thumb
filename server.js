// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import url from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CORSを許可（ローカルやRenderのWebアプリからアクセス可能に）
app.use(cors());

// ✅ assetsフォルダのパス（Renderにも含めておく）
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "assets");

// ============================================================
// 🔹 キャラクター画像取得API
// ============================================================
app.get("/image", async (req, res) => {
  try {
    const { char, color } = req.query;
    if (!char) return res.status(400).send("Missing 'char' parameter");

    // 🔸 Smashmateなど外部ソースから画像を取得
    const imageUrl = `https://www.smashmateapi.com/assets/${encodeURIComponent(char)}_${encodeURIComponent(color)}.png`;

    console.log(`🖼️ Fetching: ${imageUrl}`);

    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

    // 画像データをストリームとして転送
    res.set("Content-Type", "image/png");
    response.body.pipe(res);

  } catch (err) {
    console.error("❌ Image fetch failed:", err);
    res.status(500).send("Image fetch failed");
  }
});

// ============================================================
// 🔹 Renderの正常稼働確認用ルート
// ============================================================
app.get("/", (req, res) => {
  res.send("✅ Smash Thumbnail Server Running");
});

// ============================================================
// 🔹 サーバー起動
// ============================================================
app.listen(PORT, () => {
  console.log(`🚀 Smash Thumbnail Server running on port ${PORT}`);
});
