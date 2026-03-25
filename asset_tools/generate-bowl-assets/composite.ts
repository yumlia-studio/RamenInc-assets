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
// 海苔は3枚重ねで配置するため、配列で定義
type ToppingPlacement = {
  x: number; y: number; w: number; h: number;
  rotate?: number; layer?: "back" | "front";
};
const TOPPING_LAYOUT: Record<string, ToppingPlacement[]> = {
  chashu:       [{ x: 0.10, y: 0.28, w: 0.40, h: 0.30 }],
  ajitama:      [{ x: 0.40, y: 0.30, w: 0.38, h: 0.30 }],
  nori:         [
    { x: 0.52, y: 0.10, w: 0.32, h: 0.30, rotate: 8, layer: "back" },
    { x: 0.56, y: 0.12, w: 0.30, h: 0.28, rotate: -5, layer: "back" },
    { x: 0.48, y: 0.14, w: 0.31, h: 0.29, rotate: 12, layer: "back" },
  ],
  menma:        [{ x: 0.32, y: 0.24, w: 0.28, h: 0.28 }],
  negi:         [{ x: 0.28, y: 0.40, w: 0.26, h: 0.14 }],
  shiraga_negi: [{ x: 0.26, y: 0.34, w: 0.30, h: 0.20 }],
  moyashi:      [{ x: 0.16, y: 0.30, w: 0.32, h: 0.22 }],
  butter:       [{ x: 0.40, y: 0.36, w: 0.20, h: 0.14 }],
  corn:         [{ x: 0.34, y: 0.40, w: 0.22, h: 0.14 }],
  yuzu:         [{ x: 0.42, y: 0.38, w: 0.16, h: 0.12 }],
  kikurage:     [{ x: 0.44, y: 0.30, w: 0.26, h: 0.20 }],
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
    { broth: "yasai", tare: "miso", toppings: ["chashu", "corn", "butter", "moyashi", "negi"], outputName: "bowl_yasai_miso" },
    { broth: "tori_gyokai", tare: "shoyu", toppings: ["chashu", "ajitama", "nori", "menma", "negi"], outputName: "bowl_tori_gyokai_shoyu" },
    { broth: "gyokai", tare: "shio", toppings: ["chashu", "yuzu", "shiraga_negi"], outputName: "bowl_gyokai_shio" },
    { broth: "tonkotsu", tare: "miso", toppings: ["chashu", "corn", "butter", "negi", "kikurage"], outputName: "bowl_tonkotsu_miso" },
  ];

  for (const preset of presets) {
    console.log(`\nComposing: ${preset.outputName}`);
    composeBowl(preset);
  }
}

composePresets();
