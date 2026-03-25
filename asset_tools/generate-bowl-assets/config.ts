import * as path from "path";
import * as dotenv from "dotenv";

const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

export const CONFIG = {
  // Gemini API
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: "gemini-2.5-flash-image",

  // 画像設定
  imageSize: 1024,       // 生成画像のサイズ
  outputSize: 512,       // 最終出力サイズ（アプリ用）

  // パス
  rawDir: path.join(ROOT, "assets/bowl/raw"),
  partsDir: path.join(ROOT, "assets/bowl/parts"),
  composedDir: path.join(ROOT, "assets/bowl/composed"),
  promptsDir: path.join(__dirname, "prompts"),

  // 背景除去
  whiteThreshold: 235,   // この値以上のRGBを透過にする

  // 合成設定
  composite: {
    bowlFillRatio: 0.75, // 丼が画像の75%を占める
    toppingPositions: {
      // 各トッピングの配置位置（丼幅に対する比率）
      chashu:       { x: 0.12, y: 0.32, w: 0.38, h: 0.28 },
      ajitama:      { x: 0.42, y: 0.36, w: 0.36, h: 0.27 },
      nori:         { x: 0.50, y: 0.18, w: 0.30, h: 0.23, rotate: 10, layer: "back" as const },
      menma:        { x: 0.35, y: 0.30, w: 0.20, h: 0.22 },
      negi:         { x: 0.32, y: 0.42, w: 0.18, h: 0.08 },
      shiraga_negi: { x: 0.30, y: 0.38, w: 0.22, h: 0.14 },
      moyashi:      { x: 0.28, y: 0.34, w: 0.24, h: 0.16 },
      butter:       { x: 0.40, y: 0.38, w: 0.14, h: 0.10 },
      corn:         { x: 0.36, y: 0.44, w: 0.16, h: 0.10 },
      yuzu:         { x: 0.44, y: 0.40, w: 0.10, h: 0.07 },
      kikurage:     { x: 0.48, y: 0.34, w: 0.18, h: 0.14 },
    }
  }
};
