// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import url from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// CORSを許可（ローカルでのHTMLからアクセスできるように）
app.use(cors());

// 画像フォルダのパス（Renderにassetsを含めてデプロイしておく）
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "assets");

// /image?char=xxx&color=1 → assetsフォルダから該当ファイルを返す
app.get("/image", async (req, res) => {
  try {
    const { char, color } = req.query;
    if (!char) return res.status(400).send("Missing 'char' parameter");

    // 外部画像URLの生成（例: あなたの既存サーバーのURL構造に合わせる）
    const url = `https://www.smashmateapi.com/assets/${encodeURIComponent(char)}_${encodeURIComponent(color)}.png`;

    // 画像を取得
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

    // レスポンスを画像として返却
    res.set("Content-Type", "image/png");
    response.body.pipe(res);

  } catch (err) {
    console.error("❌ Image fetch failed:", err);
    res.status(500).send("Image fetch failed");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Smash Thumbnail Server Running on ${PORT}`));

// Renderが生存確認で使うルート
app.get("/", (req, res) => {
  res.send("Smash Thumbnail Server Running ✅");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
