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

// このフォルダの中にあるHTMLや画像をサーバーとして配信する
app.use(express.static(__dirname));

const USER_AGENT = "SmashThumbGenerator/1.0";
const CACHE_HEADER = "public, max-age=86400"; // ブラウザ側に1日キャッシュさせる

// =========================================================
// 英語キャラ名 -> 日本語キャラ名（SmashWiki用）の変換辞書（全86キャラ完全版）
// =========================================================
const EN_TO_JA = {
  "mario": "マリオ", "donkey_kong": "ドンキーコング", "link": "リンク", "samus": "サムス", "dark_samus": "ダークサムス",
  "yoshi": "ヨッシー", "kirby": "カービィ", "fox": "フォックス", "pikachu": "ピカチュウ", "luigi": "ルイージ",
  "ness": "ネス", "captain_falcon": "キャプテン・ファルコン", "jigglypuff": "プリン", "peach": "ピーチ", "daisy": "デイジー",
  "bowser": "クッパ", "ice_climbers": "アイスクライマー", "sheik": "シーク", "zelda": "ゼルダ", "dr_mario": "Dr.マリオ",
  "pichu": "ピチュー", "falco": "ファルコ", "marth": "マルス", "lucina": "ルキナ", "young_link": "こどもリンク",
  "ganondorf": "ガノンドロフ", "mewtwo": "ミュウツー", "roy": "ロイ", "chrom": "クロム", "mr_game_and_watch": "Mr.ゲーム&ウォッチ",
  "meta_knight": "メタナイト", "pit": "ピット", "dark_pit": "ブラックピット", "zero_suit_samus": "ゼロスーツサムス", "wario": "ワリオ",
  "snake": "スネーク", "ike": "アイク", "pokemon_trainer": "ポケモントレーナー", "diddy_kong": "ディディーコング", "lucas": "リュカ",
  "sonic": "ソニック", "king_dedede": "デデデ", "olimar": "ピクミン&オリマー", "lucario": "ルカリオ", "rob": "ロボット",
  "toon_link": "トゥーンリンク", "wolf": "ウルフ", "villager": "むらびと", "mega_man": "ロックマン", "wii_fit_trainer": "Wii Fitトレーナー",
  "rosalina_and_luma": "ロゼッタ&チコ", "little_mac": "リトル・マック", "greninja": "ゲッコウガ", "palutena": "パルテナ", "pac_man": "パックマン",
  "robin": "ルフレ", "shulk": "シュルク", "bowser_jr": "クッパJr.", "duck_hunt": "ダックハント", "ryu": "リュウ",
  "ken": "ケン", "cloud": "クラウド", "corrin": "カムイ", "bayonetta": "ベヨネッタ", "inkling": "インクリング",
  "ridley": "リドリー", "simon": "シモン", "richter": "リヒター", "king_k_rool": "キングクルール", "isabelle": "しずえ",
  "incineroar": "ガオガエン", "piranha_plant": "パックンフラワー", "joker": "ジョーカー", "hero": "勇者", "banjo_and_kazooie": "バンジョー&カズーイ",
  "terry": "テリー", "byleth": "ベレト", "min_min": "ミェンミェン", "steve": "スティーブ", "sephiroth": "セフィロス",
  "pyra": "ホムラ", "mythra": "ヒカリ", "pyra_and_mythra": "ホムラ&ヒカリ", "kazuya": "カズヤ", "sora": "ソラ",
  "mii_brawler": "Mii格闘", "mii_swordfighter": "Mii剣術", "mii_gunner": "Mii射撃"
};

// =========================================================
// 表記ゆれ対策
// =========================================================
// 入力された名前を "小文字 + アンダースコア区切り" の正規形に揃える
// 例: "Mr. Game & Watch" -> "mr_game_and_watch"
function normalizeChar(char) {
  return String(char)
    .trim()
    .toLowerCase()
    .replace(/&/g, "_and_")
    .replace(/\./g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

// 別名 -> 正規名（予測変換・SmashWiki側の名前に統一する）
const ALIASES = {
  "minmin": "min_min",
  "black_pit": "dark_pit",
  "ice_climber": "ice_climbers",
  "boeser_jr": "bowser_jr",
  "homura": "pyra",
  "hikari": "mythra",
  "pyra_mythra": "pyra_and_mythra",
};

// 公式サイトの画像URLで名前が異なるもの（正規名 -> 公式URL上の名前）
const OFFICIAL_SLUGS = {
  "min_min": "minmin",
  "pyra_and_mythra": "pyra",
};

function canonicalChar(char) {
  const c = normalizeChar(char);
  return ALIASES[c] || c;
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Smash Thumbnail Server running on port ${PORT}`);
  console.log(`👉 画面を開くにはここをクリック: http://localhost:${PORT}`);
});
