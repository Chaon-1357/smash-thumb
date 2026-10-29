// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import url from "url";

const app = express();
app.use(cors());

// __dirname の正しい取得（ESM）
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// このフォルダの中にあるHTMLや画像をサーバーとして配信する
app.use(express.static(__dirname));
app.use(express.json({ limit: "2kb" }));

const USER_AGENT = "SmashThumbGenerator/1.0";
const CACHE_HEADER = "public, max-age=86400"; // ブラウザ側に1日キャッシュさせる

// =========================================================
// キャラ名辞書（characters.json をブラウザ側と共有）
// =========================================================
const CHARACTERS = JSON.parse(fs.readFileSync(path.join(__dirname, "characters.json"), "utf-8"));
const EN_TO_JA = CHARACTERS.fighters;
const OFFICIAL_SLUGS = CHARACTERS.officialSlugs;

// =========================================================
// 表記ゆれ対策（sketch.js の normalizeChar と同じ処理にすること）
// =========================================================
// 例: "Mr. Game & Watch" -> "mr_game_and_watch"、"まりお" -> "マリオ"
function normalizeChar(char) {
  return String(char)
    .normalize("NFKC") // 全角英数・記号を半角に
    .trim()
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60)) // ひらがな -> カタカナ
    .replace(/[・･]/g, "")
    .replace(/&/g, "_and_")
    .replace(/\./g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// 英語名・日本語名・別名 -> 正規名 の検索表
const NAME_LOOKUP = {};
for (const [en, ja] of Object.entries(EN_TO_JA)) {
  NAME_LOOKUP[normalizeChar(en)] = en;
  NAME_LOOKUP[normalizeChar(ja)] = en;
}
for (const [alias, en] of Object.entries(CHARACTERS.aliases)) {
  NAME_LOOKUP[normalizeChar(alias)] = en;
}

function canonicalChar(char) {
  const c = normalizeChar(char);
  return NAME_LOOKUP[c] || c;
}

// 一度見つかったURLは覚えておき、2回目以降の試行錯誤を省く
const resolvedUrlCache = new Map();

// =========================================================
// 公式画像のパスを探す処理
// =========================================================
function buildCandidateUrls(char, color) {
  const c = encodeURIComponent(OFFICIAL_SLUGS[char] || char);
  const col = encodeURIComponent(String(color).trim());
  const candidates = [];

  if (col) {
    candidates.push(`https://www.smashbros.com/assets_v2/img/fighter/${c}/main${col}.png`);
    candidates.push(`https://www.smashbros.com/assets_v2/img/fighter/${c}/main_${col}.png`);
    candidates.push(`https://www.smashbros.com/assets_v2/img/fighter/${c}/main0${col}.png`);
  }
  candidates.push(`https://www.smashbros.com/assets_v2/img/fighter/${c}/main.png`);
  candidates.push(`https://www.smashbros.com/assets/img/fighter/${c}/main.png`);

  return [...new Set(candidates)];
}

async function fetchImage(u) {
  try {
    const resp = await fetch(u, { headers: { "User-Agent": USER_AGENT } });
    if (resp.ok && resp.headers.get("content-type")?.startsWith("image")) {
      return resp;
    }
  } catch (err) {}
  return null;
}

async function fetchFirstOk(urls) {
  for (const u of urls) {
    const resp = await fetchImage(u);
    if (resp) return { resp, url: u };
  }
  return null;
}

function sendImage(res, resp) {
  res.set("Content-Type", resp.headers.get("content-type") || "image/png");
  res.set("Cache-Control", CACHE_HEADER);
  resp.body.pipe(res);
}

app.get("/image", async (req, res) => {
  const { char, color } = req.query;
  if (!char) return res.status(400).send("Missing 'char' parameter");

  try {
    const c = canonicalChar(char);
    const cacheKey = `image:${c}:${color || ""}`;

    const cachedUrl = resolvedUrlCache.get(cacheKey);
    if (cachedUrl) {
      const resp = await fetchImage(cachedUrl);
      if (resp) return sendImage(res, resp);
      resolvedUrlCache.delete(cacheKey);
    }

    const result = await fetchFirstOk(buildCandidateUrls(c, color || ""));
    if (!result) {
      return res.status(404).send("Character image not found");
    }

    resolvedUrlCache.set(cacheKey, result.url);
    sendImage(res, result.resp);
  } catch (err) {
    res.status(500).send("Image fetch failed");
  }
});

// =========================================================
// SmashWikiからストックアイコンを取得するルート
// =========================================================
async function findStockIconUrl(c, colNum) {
  const jaChar = EN_TO_JA[c] || c;
  const fileName = `ファイル:頭アイコン_SP_${jaChar}_${colNum}.png`;
  const apiUrl = `https://smashwiki.info/api.php?action=query&titles=${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url&format=json`;

  console.log(`🔍 API Trying: ${apiUrl}`);

  const apiResp = await fetch(apiUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!apiResp.ok) return null;

  const apiData = await apiResp.json();
  const pages = apiData?.query?.pages;
  if (!pages) return null;

  const page = pages[Object.keys(pages)[0]];
  return page?.imageinfo?.[0]?.url || null;
}

app.get("/stock-icon", async (req, res) => {
  const { char, color } = req.query;
  if (!char) return res.status(400).send("Missing 'char' parameter");

  try {
    const c = canonicalChar(char);
    const colNum = String(color || "1").padStart(2, "0");
    const cacheKey = `icon:${c}:${colNum}`;

    let imageUrl = resolvedUrlCache.get(cacheKey);
    if (!imageUrl) {
      imageUrl = await findStockIconUrl(c, colNum);
      if (!imageUrl) {
        console.warn(`❌ Wiki Icon not found for: ${c} (Color: ${colNum})`);
        return res.status(404).send("Icon not found on Wiki");
      }
      resolvedUrlCache.set(cacheKey, imageUrl);
      console.log(`✅ Found Icon URL: ${imageUrl}`);
    }

    const imgResp = await fetchImage(imageUrl);
    if (!imgResp) {
      resolvedUrlCache.delete(cacheKey);
      return res.status(502).send("Icon fetch failed");
    }

    sendImage(res, imgResp);
  } catch (err) {
    console.error("❌ Stock Icon fetch failed:", err);
    res.status(500).send("Icon fetch failed");
  }
});

// =========================================================
// キャラごとの倍率・位置（全端末で共有）
// =========================================================
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN が設定されていれば Upstash Redis に保存する。
// 未設定ならサーバー内の adjustments.json に保存する（Renderの無料プランでは再起動で消える）。
const KV_URL = process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KV_HASH = "charAdjustments";
const ADJ_FILE = path.join(__dirname, "adjustments.json");

const ADJ_LIMITS = {
  scale: [0.1, 5],
  xOffset: [-1000, 1000],
  yOffset: [-1000, 1000],
};

async function kv(command) {
  const resp = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!resp.ok) throw new Error(`KV ${resp.status}`);
  return (await resp.json()).result;
}

function createFileStore() {
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(ADJ_FILE, "utf-8"));
  } catch (err) {}
  const persist = () => fs.promises.writeFile(ADJ_FILE, JSON.stringify(data, null, 2));

  return {
    async getAll() { return data; },
    async set(c, adj) { data[c] = adj; await persist(); },
    async remove(c) { delete data[c]; await persist(); },
  };
}

const adjustmentStore = KV_URL && KV_TOKEN
  ? {
      async getAll() {
        const flat = (await kv(["HGETALL", KV_HASH])) || [];
        const result = {};
        for (let i = 0; i < flat.length; i += 2) {
          try {
            result[flat[i]] = JSON.parse(flat[i + 1]);
          } catch (err) {}
        }
        return result;
      },
      async set(c, adj) { await kv(["HSET", KV_HASH, c, JSON.stringify(adj)]); },
      async remove(c) { await kv(["HDEL", KV_HASH, c]); },
    }
  : createFileStore();

console.log(`💾 Adjustments store: ${KV_URL && KV_TOKEN ? "Upstash Redis" : "adjustments.json"}`);

// 実在するファイターだけ受け付ける
function adjustmentChar(raw) {
  const c = canonicalChar(raw);
  return Object.hasOwn(EN_TO_JA, c) ? c : null;
}

function validAdjustment(body) {
  const adj = {};
  for (const [key, [min, max]] of Object.entries(ADJ_LIMITS)) {
    const v = Number(body?.[key]);
    if (!Number.isFinite(v)) return null;
    adj[key] = Math.min(max, Math.max(min, v));
  }
  return adj;
}

app.get("/adjustments", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await adjustmentStore.getAll());
  } catch (err) {
    console.error("❌ Adjustments load failed:", err);
    res.status(500).json({});
  }
});

app.put("/adjustments/:char", async (req, res) => {
  const c = adjustmentChar(req.params.char);
  const adj = validAdjustment(req.body);
  if (!c || !adj) return res.status(400).send("Invalid adjustment");

  try {
    await adjustmentStore.set(c, adj);
    res.json({ [c]: adj });
  } catch (err) {
    console.error("❌ Adjustment save failed:", err);
    res.status(500).send("Save failed");
  }
});

app.delete("/adjustments/:char", async (req, res) => {
  const c = adjustmentChar(req.params.char);
  if (!c) return res.status(400).send("Invalid character");

  try {
    await adjustmentStore.remove(c);
    res.status(204).end();
  } catch (err) {
    console.error("❌ Adjustment delete failed:", err);
    res.status(500).send("Delete failed");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Smash Thumbnail Server running on port ${PORT}`);
  console.log(`👉 画面を開くにはここをクリック: http://localhost:${PORT}`);
});
