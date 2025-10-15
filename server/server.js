// server/server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 静的ファイル（フロントエンド）
app.use(express.static(path.join(__dirname, "../")));

// キャラ画像取得API（例: /image?char=lucas&color=1）
app.get("/image", (req, res) => {
  const { char, color } = req.query;
  // 例: assets/lucas_1.png を返す
  const imgPath = path.join(__dirname, "../assets", `${char}_${color}.png`);
  res.sendFile(imgPath, (err) => {
    if (err) res.status(404).send("キャラ画像が見つかりません");
  });
});

// Renderで動作させる
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});