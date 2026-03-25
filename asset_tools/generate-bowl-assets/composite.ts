import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { CONFIG } from "./config";

// スープベースのマッピング（出汁+タレ → スープベースID）
const SOUP_MAP: Record<string, string> = {
  "tori_paitan+shio": "s1_white_cream",
  "tori_paitan+tonkotsu_tare": "s1_white_cream",
  "tonkotsu+shio": "s1_white_cream",
  "tonkotsu+tonkotsu_tare": "s1_white_cream",
  "tori_paitan+shoyu": "s2_cream_brown",
  "tonkotsu+shoyu": "s2_cream_brown",
  "gyokai+shoyu": "s3_clear_dark_amber",
  "tori_gyokai+shoyu": "s4_golden_brown",
  "yasai+shoyu": "s4_golden_brown",
  "tori_gyokai+miso": "s4_golden_brown",
  "tori_paitan+miso": "s5_miso_amber",
  "tonkotsu+miso": "s5_miso_amber",
  "gyokai+miso": "s5_miso_amber",
  "yasai+miso": "s5_miso_amber",
  "gyokai+shio": "s6_clear_light_gold",
  "tori_gyokai+shio": "s6_clear_light_gold",
  "yasai+shio": "s7_almost_clear",
  "gyokai+tonkotsu_tare": "s7_almost_clear",
  "yasai+tonkotsu_tare": "s7_almost_clear",
  "tori_gyokai+tonkotsu_tare": "s7_almost_clear",
};

// トッピング配置座標（丼幅に対する比率）
// リアルなラーメンの盛り付けを参考:
//   丼のスープ面は約 x:0.15~0.85, y:0.20~0.55 の楕円エリア
//   奥(y小)→手前(y大)、左(x小)→右(x大)
// 海苔は3枚重ねで配置するため、配列で定義
type ToppingPlacement = {
  x: number; y: number; w: number; h: number;
  rotate?: number; layer?: "back" | "front";
};
const TOPPING_LAYOUT: Record<string, ToppingPlacement[]> = {
  // チャーシュー: 左寄り中央、存在感のあるメインの具
  chashu:       [{ x: 0.14, y: 0.26, w: 0.34, h: 0.26 }],
  // 味玉: チャーシューの右隣、卵2つでしっかり見える
  ajitama:      [{ x: 0.42, y: 0.28, w: 0.30, h: 0.24 }],
  // 海苔: 奥の右側に3枚立てかけ、リムに沿って存在感
  nori:         [
    { x: 0.52, y: 0.06, w: 0.22, h: 0.34, rotate: 5, layer: "back" },
    { x: 0.58, y: 0.08, w: 0.20, h: 0.32, rotate: -4, layer: "back" },
    { x: 0.48, y: 0.10, w: 0.21, h: 0.33, rotate: 10, layer: "back" },
  ],
  // メンマ: チャーシューの奥に添える
  menma:        [{ x: 0.18, y: 0.20, w: 0.20, h: 0.18 }],
  // ネギ: 中央手前に散らす、実際のラーメンではパラパラだが見えるサイズに
  negi:         [{ x: 0.28, y: 0.38, w: 0.20, h: 0.12 }],
  // 白髪ネギ: 中央にふわっと山盛り、トッピングの上に載る感じ
  shiraga_negi: [{ x: 0.24, y: 0.26, w: 0.32, h: 0.24 }],
  // もやし: 右寄り中央にどっさり、味噌ラーメンの主役級
  moyashi:      [{ x: 0.32, y: 0.20, w: 0.42, h: 0.30 }],
  // バター: もやしの上にドンと載る、溶けかけで存在感
  butter:       [{ x: 0.44, y: 0.30, w: 0.18, h: 0.14 }],
  // コーン: もやしの手前に小山で盛る、黄色で目を引く
  corn:         [{ x: 0.30, y: 0.36, w: 0.24, h: 0.16 }],
  // 柚子皮: 小さなアクセント、スープの色とコントラスト出る位置
  yuzu:         [{ x: 0.40, y: 0.36, w: 0.12, h: 0.10 }],
  // きくらげ: チャーシュー右上あたり、中程度
  kikurage:     [{ x: 0.42, y: 0.24, w: 0.22, h: 0.18 }],
};

interface CompositeRequest {
  broth: string;       // 出汁ID
  tare: string;        // タレID
  toppings: string[];  // トッピングIDの配列
  outputName: string;  // 出力ファイル名
}

function composeBowl(request: CompositeRequest) {
  const soupKey = `${request.broth}+${request.tare}`;
  const soupId = SOUP_MAP[soupKey];
  if (!soupId) {
    console.error(`  Unknown soup combo: ${soupKey}`);
    return;
  }

  const soupPath = path.join(CONFIG.partsDir, `soup_${soupId}.png`);
  const outputPath = path.join(CONFIG.composedDir, `${request.outputName}.png`);

  // トッピングを展開（海苔のように複数配置があるものを展開）
  const allPlacements: { id: string; path: string; x: number; y: number; w: number; h: number; rotate?: number; layer?: string }[] = [];
  for (const id of request.toppings) {
    const placements = TOPPING_LAYOUT[id];
    if (!placements) continue;
    for (const p of placements) {
      allPlacements.push({
        id,
        path: path.join(CONFIG.partsDir, `topping_${id}.png`),
        ...p,
      });
    }
  }

  // back/frontレイヤーに分離
  const backPlacements = allPlacements.filter(t => t.layer === "back");
  const frontPlacements = allPlacements.filter(t => t.layer !== "back");
  const toppingData = [...backPlacements, ...frontPlacements];

  const pythonScript = `
import json, sys
from PIL import Image

# Load bowl base
bowl = Image.open("${soupPath}").convert("RGBA")
bw = bowl.width
result = bowl.copy()

# Toppings
toppings = json.loads('''${JSON.stringify(toppingData)}''')

for tp in toppings:
    try:
        img = Image.open(tp["path"]).convert("RGBA")
        tw = int(bw * tp["w"])
        th = int(bw * tp["h"])
        img_r = img.resize((tw, th), Image.LANCZOS)
        if tp.get("rotate"):
            img_r = img_r.rotate(tp["rotate"], expand=True, resample=Image.BICUBIC)
        px = int(bw * tp["x"])
        py = int(bw * tp["y"])
        result.paste(img_r, (px, py), img_r)
        print(f"  + {tp['id']}")
    except Exception as e:
        print(f"  ! {tp['id']}: {e}")

# Resize to output size
result = result.resize((${CONFIG.outputSize}, ${CONFIG.outputSize}), Image.LANCZOS)
result.save("${outputPath}")
print(f"  Saved: ${outputPath}")
`;

  execSync(`python3 -c '${pythonScript.replace(/'/g, "'\\''")}'`);
}

// ゲーム内で使用するプリセット合成パターン
function composePresets() {
  fs.mkdirSync(CONFIG.composedDir, { recursive: true });

  const presets: CompositeRequest[] = [
    // 代表的な組み合わせ
    { broth: "tori_paitan", tare: "shio", toppings: ["nori", "chashu", "ajitama", "negi", "yuzu"], outputName: "bowl_tori_paitan_shio" },
    { broth: "tonkotsu", tare: "tonkotsu_tare", toppings: ["chashu", "negi", "nori"], outputName: "bowl_tonkotsu_classic" },
    { broth: "gyokai", tare: "shoyu", toppings: ["nori", "chashu", "ajitama", "menma", "negi"], outputName: "bowl_gyokai_shoyu" },
    { broth: "yasai", tare: "miso", toppings: ["moyashi", "chashu", "corn", "butter", "negi"], outputName: "bowl_yasai_miso" },
    { broth: "tori_gyokai", tare: "shoyu", toppings: ["chashu", "ajitama", "nori", "menma", "negi"], outputName: "bowl_tori_gyokai_shoyu" },
    { broth: "gyokai", tare: "shio", toppings: ["chashu", "yuzu", "shiraga_negi"], outputName: "bowl_gyokai_shio" },
    { broth: "tonkotsu", tare: "miso", toppings: ["chashu", "kikurage", "corn", "butter", "negi"], outputName: "bowl_tonkotsu_miso" },
  ];

  for (const preset of presets) {
    console.log(`\nComposing: ${preset.outputName}`);
    composeBowl(preset);
  }
}

composePresets();
