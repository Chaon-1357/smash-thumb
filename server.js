// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

// ✅ キャラクター画像プロキシ
app.get("/image", async (req, res) => {
  const { char, color } = req.query;
  if (!char) return res.status(400).send("No character specified");

  try {
    // 例：Smash APIから画像を取得
    const url = `https://smash-api.example.com/${encodeURIComponent(char)}_${color || 1}.png`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Image not found");
    const buffer = await response.arrayBuffer();
    res.set("Content-Type", "image/png");
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error(err);
    res.status(500).send("Image fetch failed");
  }
});

app.get("/", (req, res) => res.send("Smash Thumbnail Server Running ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
