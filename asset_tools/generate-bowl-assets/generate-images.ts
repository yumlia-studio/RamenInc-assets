import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import { CONFIG } from "./config";

const client = new GoogleGenAI({ apiKey: CONFIG.geminiApiKey! });

// 共通スタイルプロンプトを読み込み
const commonStyle = fs.readFileSync(
  path.join(CONFIG.promptsDir, "common-style.txt"), "utf-8"
);

async function generateImage(promptText: string, outputPath: string) {
  const fullPrompt = `${commonStyle}\n\n${promptText}`;

  const response = await client.models.generateContent({
    model: CONFIG.geminiModel,
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    config: {
      responseModalities: ["image", "text"],
    },
  });

  // レスポンスから画像データを抽出
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) {
    console.error(`  No response for: ${outputPath}`);
    return;
  }

  for (const part of parts) {
    if (part.inlineData) {
      const buffer = Buffer.from(part.inlineData.data!, "base64");
      fs.writeFileSync(outputPath, buffer);
      console.log(`  Generated: ${outputPath}`);
      return;
    }
  }
  console.error(`  No image in response for: ${outputPath}`);
}

async function generateAll() {
  // ディレクトリ作成
  fs.mkdirSync(CONFIG.rawDir, { recursive: true });

  // スープベース7枚
  const soupBases = JSON.parse(
    fs.readFileSync(path.join(CONFIG.promptsDir, "soup-bases.json"), "utf-8")
  );
  for (const soup of soupBases) {
    const outputPath = path.join(CONFIG.rawDir, `soup_${soup.id}.png`);
    if (fs.existsSync(outputPath)) {
      console.log(`  Skip (exists): ${outputPath}`);
      continue;
    }
    await generateImage(soup.prompt, outputPath);
    // レートリミット対策: 2秒待機
    await new Promise(r => setTimeout(r, 2000));
  }

  // トッピング11枚
  const toppings = JSON.parse(
    fs.readFileSync(path.join(CONFIG.promptsDir, "toppings.json"), "utf-8")
  );
  for (const topping of toppings) {
    const outputPath = path.join(CONFIG.rawDir, `topping_${topping.id}.png`);
    if (fs.existsSync(outputPath)) {
      console.log(`  Skip (exists): ${outputPath}`);
      continue;
    }
    await generateImage(topping.prompt, outputPath);
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("\nAll images generated!");
}

generateAll().catch(console.error);
