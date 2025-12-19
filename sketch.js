// ===============================
// Smash Bros Thumbnail Generator
// ===============================

let bgImg, fgImg, char1Img = null, char2Img = null;
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
// 🔧 保存用キャラ補正データ
// =========================================================
let charAdjustments = JSON.parse(
  localStorage.getItem("charAdjustments") || "{}"
);

// =========================================================
// 🟣 ver1.1.0 追加：ローカル立ち絵キャラ定義
// =========================================================
const LOCAL_CHARACTER_CONFIG = {
  // カラー非対応
  mii_brawler: { hasColor: false },
  mii_swordfighter: { hasColor: false },
  mii_gunner: { hasColor: false },

  // 将来用（現時点では assets に無くても問題なし）
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
    CONFIG.colorTeam = "#D9EF59"; // チーム名は共通
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

  // ローカル立ち絵を使うキャラ
  if (localConfig) {
    if (localConfig.hasColor) {
      return `assets/characters/${char}_${color}.png`;
    } else {
      return `assets/characters/${char}.png`;
    }
  }

  // ver1.0.0 の挙動（Render 経由）を完全維持
  const proxy =
    location.hostname === "localhost"
      ? "http://localhost:3000"
      : "https://smash-thumb-1.onrender.com";

  return `${proxy}/image?char=${encodeURIComponent(
    char
  )}&color=${encodeURIComponent(color)}`;
}

// =========================================================
// キャラ画像読み込み＋補正復元
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

  load(
    1,
    getVal("p1Char"),
    getVal("p1Color"),
    (img) => {
      char1Img = img;
      redraw();
    }
  );

  load(
    2,
    getVal("p2Char"),
    getVal("p2Color"),
    (img) => {
      char2Img = img;
      redraw();
    }
  );
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
