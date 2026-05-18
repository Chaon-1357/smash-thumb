// ===============================
// Smash Bros Thumbnail Generator
// ===============================

// ★修正：4つの独立したアイコン用変数を用意
let bgImg, fgImg, char1Img = null, char2Img = null;
let p1Icon1Img = null, p1Icon2Img = null, p2Icon1Img = null, p2Icon2Img = null;
let currentMode = "main"; // 'main' = 本戦, 'pre' = 予選

// =========================================================
// 🟢 設定
// =========================================================
const CONFIG = {
  leftCenterX: 470,
  rightCenterX: 1480,
  charCenterY: 600,
  charW: 820,
  charH: 820,
  nameOffsetAboveChar: 60,
  teamSize: 40,
  playerSize: 76,
  colorTeam: "#D9EF59",
  colorPlayer: "#E8FAFC",
  colorSmall: "#E8FAFC",
  blockGap: 14,
  bottomLeft: { x: 140, y: 1020 },
  bottomRight: { x: 1780, y: 1020 },
};

// =========================================================
// ★追加：予測変換用のキャラクターリスト（よく使う英語名）
// =========================================================
const SMASH_CHARACTERS = [
  "mario", "donkey_kong", "link", "samus", "dark_samus", "yoshi", "kirby", "fox", "pikachu", "luigi",
  "ness", "captain_falcon", "jigglypuff", "peach", "daisy", "bowser", "ice_climbers", "sheik", "zelda",
  "dr_mario", "pichu", "falco", "marth", "lucina", "young_link", "ganondorf", "mewtwo", "roy", "chrom",
  "mr_game_and_watch", "meta_knight", "pit", "dark_pit", "zero_suit_samus", "wario", "snake", "ike",
  "pokemon_trainer", "diddy_kong", "lucas", "sonic", "king_dedede", "olimar", "lucario", "rob", "toon_link",
  "wolf", "villager", "mega_man", "wii_fit_trainer", "rosalina_and_luma", "little_mac", "greninja", "palutena",
  "pac_man", "robin", "shulk", "bowser_jr", "duck_hunt", "ryu", "ken", "cloud", "corrin", "bayonetta", "inkling",
  "ridley", "simon", "richter", "king_k_rool", "isabelle", "incineroar", "piranha_plant", "joker", "hero",
  "banjo_and_kazooie", "terry", "byleth", "min_min", "steve", "sephiroth", "pyra", "mythra", "kazuya", "sora",
  "mii_brawler", "mii_swordfighter", "mii_gunner", "homura", "hikari"
];

// =========================================================
// 🔧 保存用キャラ補正データ
// =========================================================
let charAdjustments = JSON.parse(
  localStorage.getItem("charAdjustments") || "{}"
);

// =========================================================
// 🟣 ver1.1.0 追加：ローカル立ち絵キャラ定義
// =========================================================
const LOCAL_CHARACTER_CONFIG = {
  mii_brawler: { hasColor: false },
  mii_swordfighter: { hasColor: false },
  mii_gunner: { hasColor: false },
  mythra: { hasColor: true },
  pyra: { hasColor: true },
};

// =========================================================
// 画像読み込み
// =========================================================
function preload() {
  bgImg = loadImage("assets/oku.png");
  fgImg = loadImage("assets/temae.png");
}

// =========================================================
// 初期化
// =========================================================
function setup() {
  const canvas = createCanvas(1920, 1080);
  canvas.parent("canvas-container");
  imageMode(CORNER);
  textAlign(CENTER, BASELINE);
  noLoop();

  // ★追加：予測変換リストをHTMLに自動生成する処理を呼び出す
  setupAutocomplete();

  document.getElementById("updateBtn").addEventListener("click", () => {
    loadCharacterImages();
    redraw();
  });

  document.getElementById("exportBtn").addEventListener("click", () =>
    saveCanvas("smash-thumbnail", "png")
  );

  // 本戦／予選 切り替え
  document
    .getElementById("mainBtn")
    .addEventListener("click", () => switchMode("main"));
  document
    .getElementById("preBtn")
    .addEventListener("click", () => switchMode("pre"));

  setupSliders();
  loadCharacterImages();
  redraw();
}

// =========================================================
// ★追加：予測変換リスト作成関数
// =========================================================
function setupAutocomplete() {
  const dataList = document.createElement('datalist');
  dataList.id = 'character-suggestions';
  SMASH_CHARACTERS.forEach(char => {
    const option = document.createElement('option');
    option.value = char;
    dataList.appendChild(option);
  });
  document.body.appendChild(dataList);
}

// =========================================================
// 本戦・予選モード切り替え
// =========================================================
function switchMode(mode) {
  currentMode = mode;

  if (mode === "main") {
    bgImg = loadImage("assets/oku.png", redraw);
    fgImg = loadImage("assets/temae.png", redraw);
    CONFIG.colorTeam = "#D9EF59";
    CONFIG.colorPlayer = "#E8FAFC";
    CONFIG.colorSmall = "#E8FAFC";
  } else {
    bgImg = loadImage("assets/oku2.png", redraw);
    fgImg = loadImage("assets/temae2.png", redraw);
    CONFIG.colorTeam = "#D9EF59";
    CONFIG.colorPlayer = "#FFF3FF";
    CONFIG.colorSmall = "#FFF3FF";
  }

  redraw();
}

// =========================================================
// スライダー設定
// =========================================================
function setupSliders() {
  ["1", "2"].forEach((num) => {
    ["scale", "xOffset", "yOffset"].forEach((type) => {
      const slider = document.getElementById(`${type}Slider${num}`);
      if (!slider) return;

      slider.addEventListener("input", () => {
        saveAdjustment(num);
        redraw();
      });
    });
  });
}

// =========================================================
// 補正値の保存
// =========================================================
function saveAdjustment(num) {
  const charName = document
    .getElementById(`p${num}Char`)
    ?.value.trim();
  if (!charName) return;

  charAdjustments[charName] = {
    scale: parseFloat(
      document.getElementById(`scaleSlider${num}`).value
    ),
    xOffset: parseFloat(
      document.getElementById(`xOffsetSlider${num}`).value
    ),
    yOffset: parseFloat(
      document.getElementById(`yOffsetSlider${num}`).value
    ),
  };

  localStorage.setItem(
    "charAdjustments",
    JSON.stringify(charAdjustments)
  );
}

// =========================================================
// ver1.1.0 追加：キャラ画像パス決定
// =========================================================
function getCharacterImagePath(char, color) {
  const localConfig = LOCAL_CHARACTER_CONFIG[char];

  if (localConfig) {
    if (localConfig.hasColor) {
      return `assets/characters/${char}_${color}.png`;
    } else {
      return `assets/characters/${char}.png`;
    }
  }

  const proxy =
    location.hostname === "localhost"
      ? "http://localhost:3000"
      : "https://smash-thumb-1.onrender.com";

  return `${proxy}/image?char=${encodeURIComponent(
    char
  )}&color=${encodeURIComponent(color)}`;
}

// =========================================================
// ★追加：ストックアイコンのパス取得
// =========================================================
function getStockIconPath(char, color) {
  const proxy =
    location.hostname === "localhost"
      ? "http://localhost:3000"
      : "https://smash-thumb-1.onrender.com";

  return `${proxy}/stock-icon?char=${encodeURIComponent(
    char
  )}&color=${encodeURIComponent(color)}`;
}

// =========================================================
// キャラ画像・各種アイコン読み込み＋補正復元
// =========================================================
function loadCharacterImages() {
  const load = (num, char, color, setter) => {
    const src = getCharacterImagePath(char, color);

    loadImage(
      src,
      setter,
      () => {
        console.warn("❌ Image load failed:", src);
        setter(null);
      }
    );

    const adj = charAdjustments[char];
    document.getElementById(`scaleSlider${num}`).value =
      adj?.scale ?? 1.0;
    document.getElementById(`xOffsetSlider${num}`).value =
      adj?.xOffset ?? 0;
    document.getElementById(`yOffsetSlider${num}`).value =
      adj?.yOffset ?? 0;
  };

  // アイコン読み込み用のヘルパー（空欄なら即nullにする）
  const loadIcon = (char, color, setter) => {
    if (!char) {
      setter(null);
      return;
    }
    const src = getStockIconPath(char, color);
    loadImage(src, setter, () => {
      console.warn("❌ Icon load failed:", src);
      setter(null);
    });
  };

  // 1P・2Pの立ち絵読み込み
  load(1, getVal("p1Char"), getVal("p1Color"), (img) => { char1Img = img; redraw(); });
  load(2, getVal("p2Char"), getVal("p2Color"), (img) => { char2Img = img; redraw(); });

  // ★修正：4つの独立したアイコン入力をそれぞれ読み込む
  loadIcon(getVal("p1Icon1"), getVal("p1Icon1Color"), (img) => { p1Icon1Img = img; redraw(); });
  loadIcon(getVal("p1Icon2"), getVal("p1Icon2Color"), (img) => { p1Icon2Img = img; redraw(); });
  loadIcon(getVal("p2Icon1"), getVal("p2Icon1Color"), (img) => { p2Icon1Img = img; redraw(); });
  loadIcon(getVal("p2Icon2"), getVal("p2Icon2Color"), (img) => { p2Icon2Img = img; redraw(); });
}

// =========================================================
// 描画ループ
// =========================================================
function draw() {
  clear();
  background(0);

  if (bgImg) image(bgImg, 0, 0, width, height);

  drawCharacter(1, char1Img, CONFIG.leftCenterX);
  drawCharacter(2, char2Img, CONFIG.rightCenterX);

  if (fgImg) image(fgImg, 0, 0, width, height);

  // ★修正：プレイヤーごとのアイコン描画関数を呼び出す（位置は名前の少し上）
  // ★修正：縦の高さは textBaseY + 100 に固定
  const textBaseY = CONFIG.charCenterY - CONFIG.charH / 2 - CONFIG.nameOffsetAboveChar;
  const iconY = textBaseY + 120;

  // ★横の位置：画面の中央(width / 2) から、左右に「200」ずつ離す
  drawPlayerIcons(p1Icon1Img, p1Icon2Img, (width / 2) - 200, iconY, -1);
  drawPlayerIcons(p2Icon1Img, p2Icon2Img, (width / 2) + 200, iconY, 1);

  drawAllText();
}

// =========================================================
// キャラ描画（倍率・位置補正）
// =========================================================
function drawCharacter(num, img, baseX) {
  if (!img) return;

  const name = getVal(`p${num}Char`);
  const adj = charAdjustments[name] || {
    scale: 1,
    xOffset: 0,
    yOffset: 0,
  };

  const aspect = img.width / img.height;
  const h = CONFIG.charH * adj.scale;
  const w = h * aspect;

  image(
    img,
    baseX - w / 2 + adj.xOffset,
    CONFIG.charCenterY - h / 2 + adj.yOffset,
    w,
    h
  );
}

// =========================================================
// ★追加：プレイヤーごとの複数アイコン自動整列描画
// =========================================================
// =========================================================
// ★修正：①を固定し、指定された方向（左か右）に②を配置する
// =========================================================
function drawPlayerIcons(img1, img2, centerX, baseY, direction = 1) {
  const size = 100; // 
  const gap = 12;   // アイコン同士の隙間

  let activeImgs = [];
  if (img1) activeImgs.push(img1);
  if (img2) activeImgs.push(img2);

  // ①の絶対位置（不動のアンカー）
  const startX = centerX - size / 2;

  if (activeImgs.length >= 1) {
    // 1個目のアイコンを描画
    image(activeImgs[0], startX, baseY - size / 2, size, size);
  }
  
  if (activeImgs.length >= 2) {
    // 2個目のアイコンを、指定された方向（-1なら左、1なら右）に配置
    const offsetX = (size + gap) * direction;
    image(activeImgs[1], startX + offsetX, baseY - size / 2, size, size);
  }
}
// =========================================================
// テキスト描画
// =========================================================
function drawAllText() {
  const t1 = getVal("p1Team"),
    n1 = getVal("p1Name");
  const t2 = getVal("p2Team"),
    n2 = getVal("p2Name");
  const round = getVal("round"),
    date = getVal("date"),
    matchNum = getVal("matchNum");

  const topY =
    CONFIG.charCenterY - CONFIG.charH / 2 - CONFIG.nameOffsetAboveChar;

  drawNameBlock(CONFIG.leftCenterX, topY, t1, n1);
  drawNameBlock(CONFIG.rightCenterX, topY, t2, n2);

  const rFont = 26,
    dFont = 26,
    mFont = 40,
    gap = 5;
  const roundY = CONFIG.bottomLeft.y;
  const dateY = roundY - (rFont + gap);

  textFont("sans-serif");
  fill(CONFIG.colorSmall);
  drawingContext.letterSpacing = 2;

  textAlign(LEFT, BASELINE);
  textSize(dFont);
  text(date, CONFIG.bottomLeft.x, dateY);
  textSize(rFont);
  text(round, CONFIG.bottomLeft.x, roundY);

  textAlign(RIGHT, BASELINE);
  textSize(mFont);
  text(matchNum, CONFIG.bottomRight.x, CONFIG.bottomRight.y);

  drawingContext.letterSpacing = 0;
}

// =========================================================
// チーム名・プレイヤー名
// =========================================================
function drawNameBlock(centerX, baseY, teamText, playerText) {
  push();

  drawingContext.letterSpacing = 2;
  textFont("serif");

  textSize(CONFIG.teamSize);
  const teamW = textWidth(teamText || "");

  textSize(CONFIG.playerSize);
  const playerW = textWidth(playerText || "");

  const gap = CONFIG.blockGap;
  const total = teamW + gap + playerW;
  const left = centerX - total / 2;

  const teamX = left + teamW / 2;
  const playerX = left + teamW + gap + playerW / 2;

  textSize(CONFIG.teamSize);
  fill(CONFIG.colorTeam);
  textAlign(CENTER, BASELINE);
  text(teamText || "", teamX, baseY);

  textSize(CONFIG.playerSize);
  fill(CONFIG.colorPlayer);
  text(playerText || "", playerX, baseY);

  drawingContext.letterSpacing = 0;
  pop();
}

// =========================================================
// 値取得
// =========================================================
function getVal(id) {
  return document.getElementById(id)?.value.trim() || "";
}