// ===============================
// Smash Bros Thumbnail Generator
// ===============================

let bgImg, fgImg;
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

// どの端末で書き出しても同じ見た目になるよう、Webフォントを明示する
const FONT_NAME = "Noto Serif JP";
const FONT_SMALL = "Nunito Sans";

const MODES = {
  main: { bg: "assets/oku.png", fg: "assets/temae.png", colorPlayer: "#E8FAFC", colorSmall: "#E8FAFC" },
  pre: { bg: "assets/oku2.png", fg: "assets/temae2.png", colorPlayer: "#FFF3FF", colorSmall: "#FFF3FF" },
};

// =========================================================
// 予測変換用のキャラクターリスト
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
  "banjo_and_kazooie", "terry", "byleth", "min_min", "steve", "sephiroth", "pyra", "mythra", "pyra_and_mythra",
  "kazuya", "sora", "mii_brawler", "mii_swordfighter", "mii_gunner"
];

// 別名 -> 正規名（server.js の ALIASES と揃えること）
const ALIASES = {
  "minmin": "min_min",
  "black_pit": "dark_pit",
  "ice_climber": "ice_climbers",
  "boeser_jr": "bowser_jr",
  "homura": "pyra",
  "hikari": "mythra",
  "pyra_mythra": "pyra_and_mythra",
};

// =========================================================
// 🟣 ローカル立ち絵キャラ定義
// =========================================================
// fallbackRemote: ローカル画像が無ければ公式画像を探しにいく
const LOCAL_CHARACTER_CONFIG = {
  mii_brawler: { hasColor: false },
  mii_swordfighter: { hasColor: false },
  mii_gunner: { hasColor: false },
  mythra: { hasColor: true, fallbackRemote: true },
  pyra: { hasColor: true, fallbackRemote: true },
};

// =========================================================
// 画像スロット（立ち絵2枚 + ストックアイコン4枚）
// =========================================================
const SLOTS = {
  p1Char: { color: "p1Color", type: "char", player: 1 },
  p2Char: { color: "p2Color", type: "char", player: 2 },
  p1Icon1: { color: "p1Icon1Color", type: "icon" },
  p1Icon2: { color: "p1Icon2Color", type: "icon" },
  p2Icon1: { color: "p2Icon1Color", type: "icon" },
  p2Icon2: { color: "p2Icon2Color", type: "icon" },
};
Object.values(SLOTS).forEach((slot) => {
  slot.img = null;
  slot.token = 0;       // 古いリクエストの結果を捨てるための番号
  slot.loadedKey = null; // 最後に読み込みを始めた "名前|カラー"
  slot.imgKey = null;    // 今表示している画像の "名前|カラー"
  slot.failed = null;
});

const PLAYER_FIELDS = ["Char", "Color", "Icon1", "Icon1Color", "Icon2", "Icon2Color", "Name", "Team"];
const FIELD_IDS = [
  ...PLAYER_FIELDS.map((f) => `p1${f}`),
  ...PLAYER_FIELDS.map((f) => `p2${f}`),
  "matchNum", "round", "date",
];

let pendingLoads = 0;

// =========================================================
// 🔧 保存データ（キャラ補正・入力内容）
// =========================================================
const storage = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  },
};

let charAdjustments = storage.get("charAdjustments", {});

// =========================================================
// 画像読み込み
// =========================================================
function preload() {
  currentMode = storage.get("thumbMode", "main") === "pre" ? "pre" : "main";
  bgImg = loadImage(MODES[currentMode].bg);
  fgImg = loadImage(MODES[currentMode].fg);
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

  setupAutocomplete();
  restoreFields();
  applyModeStyle();

  setupInputs();
  setupSliders();
  setupButtons();

  Object.keys(SLOTS).forEach((id) => loadSlot(id));
  refreshText();
}

// =========================================================
// 予測変換リスト作成関数
// =========================================================
function setupAutocomplete() {
  const dataList = document.createElement("datalist");
  dataList.id = "character-suggestions";
  SMASH_CHARACTERS.forEach((char) => {
    const option = document.createElement("option");
    option.value = char;
    dataList.appendChild(option);
  });
  document.body.appendChild(dataList);
}

// =========================================================
// 入力欄：文字はリアルタイム反映、ファイターは入力が止まったら読み込み
// =========================================================
function setupInputs() {
  FIELD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => {
      saveFields();
      refreshText();
    });
  });

  Object.entries(SLOTS).forEach(([id, slot]) => {
    let timer = null;
    const schedule = (delay) => {
      clearTimeout(timer);
      timer = setTimeout(() => loadSlot(id), delay);
    };
    [id, slot.color].forEach((inputId) => {
      const el = document.getElementById(inputId);
      el.addEventListener("input", () => schedule(600));
      el.addEventListener("change", () => schedule(0));
    });
  });
}

// =========================================================
// ボタン類
// =========================================================
function setupButtons() {
  document.getElementById("exportBtn").addEventListener("click", exportPng);
  document.getElementById("swapBtn").addEventListener("click", swapPlayers);
  document.getElementById("mainBtn").addEventListener("click", () => switchMode("main"));
  document.getElementById("preBtn").addEventListener("click", () => switchMode("pre"));
  document.getElementById("clearBtn").addEventListener("click", clearFields);

  document.getElementById("todayBtn").addEventListener("click", () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    document.getElementById("date").value = `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
    saveFields();
    refreshText();
  });

  document.querySelectorAll(".reset-btn").forEach((btn) => {
    btn.addEventListener("click", () => resetAdjustment(btn.dataset.player));
  });
}

// =========================================================
// 本戦・予選モード切り替え
// =========================================================
function switchMode(mode) {
  currentMode = mode;
  storage.set("thumbMode", mode);
  bgImg = loadImage(MODES[mode].bg, redraw);
  fgImg = loadImage(MODES[mode].fg, redraw);
  applyModeStyle();
  redraw();
}

function applyModeStyle() {
  CONFIG.colorPlayer = MODES[currentMode].colorPlayer;
  CONFIG.colorSmall = MODES[currentMode].colorSmall;
  document.getElementById("mainBtn").classList.toggle("active", currentMode === "main");
  document.getElementById("preBtn").classList.toggle("active", currentMode === "pre");
}

// =========================================================
// 入力内容の保存・復元（ブラウザを更新しても残る）
// =========================================================
function saveFields() {
  const values = {};
  FIELD_IDS.forEach((id) => (values[id] = document.getElementById(id).value));
  storage.set("thumbFields", values);
}

function restoreFields() {
  const values = storage.get("thumbFields", {});
  FIELD_IDS.forEach((id) => {
    if (typeof values[id] === "string") document.getElementById(id).value = values[id];
  });
}

function clearFields() {
  if (!confirm("入力内容を初期状態に戻しますか？（ファイターごとの位置・倍率は残ります）")) return;
  FIELD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    el.value = el.defaultValue;
  });
  storage.remove("thumbFields");
  Object.keys(SLOTS).forEach((id) => loadSlot(id));
  refreshText();
}

// =========================================================
// 1P ⇄ 2P 入れ替え
// =========================================================
function swapPlayers() {
  PLAYER_FIELDS.forEach((f) => {
    const a = document.getElementById(`p1${f}`);
    const b = document.getElementById(`p2${f}`);
    [a.value, b.value] = [b.value, a.value];
  });

  [["p1Char", "p2Char"], ["p1Icon1", "p2Icon1"], ["p1Icon2", "p2Icon2"]].forEach(([x, y]) => {
    const a = SLOTS[x], b = SLOTS[y];
    // 読み込み中のリクエストは無効にして、読み込み済みの画像だけを入れ替える
    a.token++;
    b.token++;
    [a.img, b.img] = [b.img, a.img];
    [a.imgKey, b.imgKey] = [b.imgKey, a.imgKey];
    [a.failed, b.failed] = [b.failed, a.failed];
    a.loadedKey = a.imgKey;
    b.loadedKey = b.imgKey;
    document.getElementById(x).classList.toggle("invalid", !!a.failed);
    document.getElementById(y).classList.toggle("invalid", !!b.failed);
    // 読み込み途中だったものはここで読み直す（済んでいるものは何もしない）
    loadSlot(x);
    loadSlot(y);
  });

  restoreSliders(1);
  restoreSliders(2);
  saveFields();
  updateStatus();
  refreshText();
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
        updateSliderLabels(num);
        saveAdjustment(num);
        redraw();
      });
    });
    updateSliderLabels(num);
  });
}

function updateSliderLabels(num) {
  const scale = document.getElementById(`scaleSlider${num}`).value;
  document.getElementById(`scaleSlider${num}Val`).textContent = `×${Number(scale).toFixed(2)}`;
  ["xOffset", "yOffset"].forEach((type) => {
    document.getElementById(`${type}Slider${num}Val`).textContent =
      document.getElementById(`${type}Slider${num}`).value;
  });
}

function getAdjustment(num) {
  return {
    scale: parseFloat(document.getElementById(`scaleSlider${num}`).value),
    xOffset: parseFloat(document.getElementById(`xOffsetSlider${num}`).value),
    yOffset: parseFloat(document.getElementById(`yOffsetSlider${num}`).value),
  };
}

// =========================================================
// 補正値の保存・復元
// =========================================================
function saveAdjustment(num) {
  const charName = canonicalChar(getVal(`p${num}Char`));
  if (!charName) return;

  charAdjustments[charName] = getAdjustment(num);
  storage.set("charAdjustments", charAdjustments);
}

function restoreSliders(num) {
  const raw = getVal(`p${num}Char`);
  const adj = charAdjustments[canonicalChar(raw)] ?? charAdjustments[raw];
  document.getElementById(`scaleSlider${num}`).value = adj?.scale ?? 1.0;
  document.getElementById(`xOffsetSlider${num}`).value = adj?.xOffset ?? 0;
  document.getElementById(`yOffsetSlider${num}`).value = adj?.yOffset ?? 0;
  updateSliderLabels(num);
}

function resetAdjustment(num) {
  delete charAdjustments[canonicalChar(getVal(`p${num}Char`))];
  storage.set("charAdjustments", charAdjustments);
  restoreSliders(num);
  redraw();
}

// =========================================================
// 名前の表記ゆれ対策（例: "Mr. Game & Watch" -> "mr_game_and_watch"）
// =========================================================
function canonicalChar(char) {
  const c = String(char)
    .trim()
    .toLowerCase()
    .replace(/&/g, "_and_")
    .replace(/\./g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return ALIASES[c] || c;
}

// =========================================================
// 画像パス決定
// =========================================================
function getProxy() {
  const host = location.hostname;
  return host === "localhost" || host === "127.0.0.1"
    ? location.origin
    : "https://smash-thumb-1.onrender.com";
}

// 候補を順番に試すため、配列で返す
function getCharacterImageSources(char, color) {
  const remote = `${getProxy()}/image?char=${encodeURIComponent(char)}&color=${encodeURIComponent(color)}`;
  const localConfig = LOCAL_CHARACTER_CONFIG[char];
  if (!localConfig) return [remote];

  const local = localConfig.hasColor
    ? `assets/characters/${char}_${color}.png`
    : `assets/characters/${char}.png`;
  return localConfig.fallbackRemote ? [local, remote] : [local];
}

function getStockIconPath(char, color) {
  return `${getProxy()}/stock-icon?char=${encodeURIComponent(char)}&color=${encodeURIComponent(color)}`;
}

// =========================================================
// キャラ画像・各種アイコン読み込み
// =========================================================
function loadSlot(id) {
  const slot = SLOTS[id];
  const input = document.getElementById(id);
  const char = canonicalChar(input.value);
  const color = getVal(slot.color) || "1";
  const key = `${char}|${color}`;

  if (slot.type === "char") restoreSliders(slot.player);
  if (key === slot.loadedKey) return;

  const token = ++slot.token;
  slot.loadedKey = key;

  // 空欄なら即クリア（アイコン用）
  if (!char) {
    finishSlot(id, null, null);
    return;
  }

  const sources = slot.type === "char"
    ? getCharacterImageSources(char, color)
    : [getStockIconPath(char, color)];

  pendingLoads++;
  updateStatus();

  const tryLoad = (i) => {
    loadImage(
      sources[i],
      (img) => {
        pendingLoads--;
        if (token === slot.token) finishSlot(id, img, null);
        else updateStatus();
      },
      () => {
        console.warn("❌ Image load failed:", sources[i]);
        if (i + 1 < sources.length) return tryLoad(i + 1);
        pendingLoads--;
        if (token === slot.token) {
          slot.loadedKey = null; // 次回また試せるように
          finishSlot(id, null, input.value.trim());
        } else {
          updateStatus();
        }
      }
    );
  };
  tryLoad(0);
}

function finishSlot(id, img, failedName) {
  const slot = SLOTS[id];
  slot.img = img;
  slot.imgKey = failedName ? null : slot.loadedKey;
  slot.failed = failedName;
  document.getElementById(id).classList.toggle("invalid", !!failedName);
  updateStatus();
  redraw();
}

function updateStatus() {
  const el = document.getElementById("status");
  const failed = Object.values(SLOTS).map((s) => s.failed).filter(Boolean);

  if (pendingLoads > 0) {
    el.textContent = "画像を読み込み中…";
    el.classList.remove("error");
  } else if (failed.length) {
    el.textContent = `画像が見つかりません: ${[...new Set(failed)].join(", ")}（名前・カラー番号を確認してください）`;
    el.classList.add("error");
  } else {
    el.textContent = "";
    el.classList.remove("error");
  }
}

// =========================================================
// フォント読み込み後に描画（日本語は必要な文字だけ読み込まれるため）
// =========================================================
function loadFonts() {
  const names = ["p1Team", "p1Name", "p2Team", "p2Name"].map(getVal).join("") || "あ";
  const small = ["round", "date", "matchNum"].map(getVal).join("") || "A";
  return Promise.all([
    document.fonts.load(`${CONFIG.playerSize}px "${FONT_NAME}"`, names),
    document.fonts.load(`40px "${FONT_SMALL}"`, small),
  ]).catch(() => {});
}

function refreshText() {
  redraw();
  loadFonts().then(() => redraw());
}

// =========================================================
// PNG書き出し
// =========================================================
async function exportPng() {
  await loadFonts();
  redraw();

  const parts = [getVal("matchNum"), getVal("round"), `${getVal("p1Name")}_vs_${getVal("p2Name")}`];
  const fileName = parts
    .filter(Boolean)
    .join("_")
    .replace(/[\\/:*?"<>|\s]+/g, "_")
    .slice(0, 120);

  saveCanvas(fileName || "smash-thumbnail", "png");
}

// =========================================================
// 描画
// =========================================================
function draw() {
  clear();
  background(0);

  if (bgImg) image(bgImg, 0, 0, width, height);

  drawCharacter(1, SLOTS.p1Char.img, CONFIG.leftCenterX);
  drawCharacter(2, SLOTS.p2Char.img, CONFIG.rightCenterX);

  if (fgImg) image(fgImg, 0, 0, width, height);

  // アイコンの縦位置は名前の少し下に固定
  const textBaseY = CONFIG.charCenterY - CONFIG.charH / 2 - CONFIG.nameOffsetAboveChar;
  const iconY = textBaseY + 120;

  // 横の位置：画面の中央(width / 2) から、左右に「200」ずつ離す
  drawPlayerIcons(SLOTS.p1Icon1.img, SLOTS.p1Icon2.img, (width / 2) - 200, iconY, -1);
  drawPlayerIcons(SLOTS.p2Icon1.img, SLOTS.p2Icon2.img, (width / 2) + 200, iconY, 1);

  drawAllText();
}

// =========================================================
// キャラ描画（倍率・位置補正）
// =========================================================
function drawCharacter(num, img, baseX) {
  if (!img) return;

  const adj = getAdjustment(num);
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
// プレイヤーごとのアイコン描画：①を固定し、指定された方向（左か右）に②を配置する
// =========================================================
function drawPlayerIcons(img1, img2, centerX, baseY, direction = 1) {
  const size = 100;
  const gap = 12; // アイコン同士の隙間

  const activeImgs = [img1, img2].filter(Boolean);

  // ①の絶対位置（不動のアンカー）
  const startX = centerX - size / 2;

  if (activeImgs.length >= 1) {
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

  textFont(FONT_SMALL);
  fill(CONFIG.colorSmall);
  drawingContext.letterSpacing = "2px";

  textAlign(LEFT, BASELINE);
  textSize(dFont);
  text(date, CONFIG.bottomLeft.x, dateY);
  textSize(rFont);
  text(round, CONFIG.bottomLeft.x, roundY);

  textAlign(RIGHT, BASELINE);
  textSize(mFont);
  text(matchNum, CONFIG.bottomRight.x, CONFIG.bottomRight.y);

  drawingContext.letterSpacing = "0px";
}

// =========================================================
// チーム名・プレイヤー名
// =========================================================
function drawNameBlock(centerX, baseY, teamText, playerText) {
  push();

  drawingContext.letterSpacing = "2px";
  textFont(FONT_NAME);

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

  drawingContext.letterSpacing = "0px";
  pop();
}

// =========================================================
// 値取得
// =========================================================
function getVal(id) {
  return document.getElementById(id)?.value.trim() || "";
}
