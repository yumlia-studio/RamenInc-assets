import { execSync } from "child_process";
import * as path from "path";

const scriptsDir = __dirname;

function run(label: string, script: string) {
  console.log(`\n========================================`);
  console.log(`  ${label}`);
  console.log(`========================================\n`);
  execSync(`npx ts-node ${path.join(scriptsDir, script)}`, {
    stdio: "inherit",
    cwd: path.resolve(scriptsDir, ".."),
  });
}

async function main() {
  console.log("Ramen Inc. - Bowl Asset Pipeline\n");

  run("Step 1: Gemini API で画像生成", "generate-images.ts");
  run("Step 2: 白背景除去", "remove-background.ts");
  run("Step 3: パーツ合成", "composite.ts");

  console.log("\n========================================");
  console.log("  All steps completed!");
  console.log("========================================\n");
}

main().catch(console.error);
