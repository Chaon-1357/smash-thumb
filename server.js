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
  "pyra": "ホムラ", "mythra": "ヒカリ", "homura": "ホムラ", "hikari": "ヒカリ", "kazuya": "カズヤ", "sora": "ソラ",
  "mii_brawler": "Mii格闘", "mii_swordfighter": "Mii剣術", "mii_gunner": "Mii射撃"
};

// =========================================================
// 公式画像のパスを探す処理
// =========================================================
function buildCandidateUrls(char, color) {
  const c = String(char).trim().toLowerCase();
  const col = String(color).trim();
  const candidates = [];

  if (col) {
    candidates.push(`https://www.smashbros.com/assets_v2/img/fighter/${encodeURIComponent(c)}/main${encodeURIComponent(col)}.png`);
    candidates.push(`https://www.smashbros.com/assets_v2/img/fighter/${encodeURIComponent(c)}/main_${encodeURIComponent(col)}.png`);
    candidates.push(`https://www.smashbros.com/assets_v2/img/fighter/${encodeURIComponent(c)}/main0${encodeURIComponent(col)}.png`);
  }
  candidates.push(`https://www.smashbros.com/assets_v2/img/fighter/${encodeURIComponent(c)}/main.png`);
  candidates.push(`https://www.smashbros.com/assets/img/fighter/${encodeURIComponent(c)}/main.png`);

  return [...new Set(candidates)];
}

async function fetchFirstOk(urls) {
  for (const u of urls) {
    try {
      const resp = await fetch(u, { 
        method: "GET",
        headers: { "User-Agent": "SmashThumbGenerator/1.0" }
      });
      if (resp.ok && resp.headers.get("content-type")?.startsWith("image")) {
        return { resp, url: u };
      }
    } catch (err) {}
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
      return res.status(404).send("Character image not found");
    }

    const { resp } = result;
    res.set("Content-Type", resp.headers.get("content-type") || "image/png");
    resp.body.pipe(res);
  } catch (err) {
    res.status(500).send("Image fetch failed");
  }
});

// =========================================================
// SmashWikiからストックアイコンを取得するルート
// =========================================================
app.get("/stock-icon", async (req, res) => {
  const { char, color } = req.query;
  if (!char) return res.status(400).send("Missing 'char' parameter");

  try {
    const jaChar = EN_TO_JA[char.toLowerCase()] || char;
    const colNum = String(color || "1").padStart(2, "0");
    const fileName = `ファイル:頭アイコン_SP_${jaChar}_${colNum}.png`;
    const apiUrl = `https://smashwiki.info/api.php?action=query&titles=${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url&format=json`;

    console.log(`🔍 API Trying: ${apiUrl}`);

    const apiResp = await fetch(apiUrl, {
      headers: { "User-Agent": "SmashThumbGenerator/1.0" }
    });
    
    const apiData = await apiResp.json();
    const pages = apiData.query.pages;
    const pageId = Object.keys(pages)[0];

    if (pageId === "-1" || !pages[pageId].imageinfo) {
      console.warn(`❌ Wiki Icon not found for: ${jaChar} (Color: ${colNum})`);
      return res.status(404).send("Icon not found on Wiki");
    }

    const imageUrl = pages[pageId].imageinfo[0].url;
    console.log(`✅ Found Icon URL: ${imageUrl}`);

    const imgResp = await fetch(imageUrl, {
      headers: { "User-Agent": "SmashThumbGenerator/1.0" }
    });

    res.set("Content-Type", imgResp.headers.get("content-type") || "image/png");
    imgResp.body.pipe(res);

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