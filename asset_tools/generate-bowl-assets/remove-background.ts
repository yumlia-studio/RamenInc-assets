import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { CONFIG } from "./config";

function removeBackground() {
  fs.mkdirSync(CONFIG.partsDir, { recursive: true });

  const rawFiles = fs.readdirSync(CONFIG.rawDir)
    .filter(f => f.endsWith(".png"));

  for (const file of rawFiles) {
    const input = path.join(CONFIG.rawDir, file);
    const output = path.join(CONFIG.partsDir, file);

    if (fs.existsSync(output)) {
      console.log(`  Skip: ${file}`);
      continue;
    }

    // スープベースは背景除去せずそのままコピー（白い丼が消えるため）
    if (file.startsWith("soup_")) {
      fs.copyFileSync(input, output);
      console.log(`  Copy (soup): ${file}`);
      continue;
    }

    // トッピングのみ: flood fill方式で外側の白背景だけ除去
    // （素材内部の白は保持する）
    const script = `
from PIL import Image
import numpy as np

img = Image.open('${input}').convert('RGBA')
arr = np.array(img)
h, w = arr.shape[:2]
threshold = ${CONFIG.whiteThreshold}

# Create mask: start from edges and flood fill white pixels
is_white = (arr[:,:,0] > threshold) & (arr[:,:,1] > threshold) & (arr[:,:,2] > threshold)

# Create border-connected mask
visited = np.zeros((h, w), dtype=bool)
from collections import deque
queue = deque()

# Seed from all 4 edges
for x in range(w):
    if is_white[0, x]:
        queue.append((0, x))
        visited[0, x] = True
    if is_white[h-1, x]:
        queue.append((h-1, x))
        visited[h-1, x] = True
for y in range(h):
    if is_white[y, 0]:
        queue.append((y, 0))
        visited[y, 0] = True
    if is_white[y, w-1]:
        queue.append((y, w-1))
        visited[y, w-1] = True

# BFS flood fill
while queue:
    cy, cx = queue.popleft()
    for dy, dx in [(-1,0),(1,0),(0,-1),(0,1)]:
        ny, nx = cy+dy, cx+dx
        if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_white[ny, nx]:
            visited[ny, nx] = True
            queue.append((ny, nx))

# Only make border-connected white pixels transparent
arr[visited, 3] = 0
Image.fromarray(arr).save('${output}')
print('  ${file}')
`.trim();

    execSync(`python3 -c "${script.replace(/"/g, '\\"')}"`, { timeout: 30000 });
  }

  console.log("\nAll backgrounds removed!");
}

removeBackground();
